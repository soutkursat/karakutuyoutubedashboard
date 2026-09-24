/**
 * VERİ KATMANI (Supabase)
 * -----------------------
 * Uygulamanın geri kalanı SADECE bu dosyadaki fonksiyonları kullanır.
 *
 * - Okumalar senkrondur: sunucudan gelen veri bellekte tutulur (state), sayfalar oradan okur.
 * - Yazmalar asenkrondur: sunucuya gider, ardından önbellek yenilenir.
 * - Asıl güvenlik ve iş kuralları sunucudadır (supabase/schema.sql → RLS + fonksiyonlar).
 *   Buradaki doğrulamalar kullanıcıya hızlı ve anlaşılır hata göstermek içindir.
 */
import { emit } from './storage'
import { isConfigured, supabase } from './supabase'
import type { Appointment, AppointmentStatus, Busy, Settings, User } from './types'
import { AppError, EMAIL_RE, clean, isMeetLink, normalizePhone } from './validation'
import { isValidDateKey, isValidTime, toMinutes } from './time'

export const DEFAULT_SETTINGS: Settings = {
  weekly: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
  blockedDates: [],
  slotMinutes: 45,
  bufferMinutes: 15,
  minNoticeHours: 12,
  maxDaysAhead: 21,
  maxActivePerStudent: 2,
  cancelLimitHours: 6,
  whatsappNumber: '905377935090',
  defaultMeetLink: '',
  autoConfirm: false,
  registrationOpen: true,
  inviteCode: '',
  topics: ['Kanal analizi', 'Diğer'],
}

// ---------- önbellek ----------
interface State {
  ready: boolean
  me: User | null
  users: User[]
  appts: Appointment[]
  busy: Busy[]
  settings: Settings
  publicConfig: { registrationOpen: boolean; inviteRequired: boolean }
  /** Hesap askıya alındıysa girişte gösterilecek mesaj */
  blockedReason: string
}

let state: State = {
  ready: !isConfigured,
  me: null,
  users: [],
  appts: [],
  busy: [],
  settings: DEFAULT_SETTINGS,
  publicConfig: { registrationOpen: true, inviteRequired: false },
  blockedReason: '',
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  emit()
}

// ---------- satır ↔ nesne dönüşümü ----------
interface ProfileRow {
  id: string
  role: User['role']
  name: string
  email: string
  username: string | null
  phone: string
  status: User['status']
  admin_note: string
  created_at: string
}
interface ApptRow {
  id: string
  code: string
  student_id: string
  start_at: string
  end_at: string
  topic: string
  note: string
  status: AppointmentStatus
  meet_link: string | null
  whatsapp_notified_at: string | null
  cancel_reason: string | null
  cancelled_by: 'student' | 'admin' | null
  created_at: string
  updated_at: string
}

const iso = (s: string) => new Date(s).toISOString()

const toUser = (r: ProfileRow): User => ({
  id: r.id,
  role: r.role,
  name: r.name,
  email: r.email,
  username: r.username ?? undefined,
  phone: r.phone,
  status: r.status,
  adminNote: r.admin_note || undefined,
  createdAt: r.created_at,
})

const toAppt = (r: ApptRow): Appointment => ({
  id: r.id,
  code: r.code,
  studentId: r.student_id,
  start: iso(r.start_at),
  end: iso(r.end_at),
  topic: r.topic,
  note: r.note,
  status: r.status,
  meetLink: r.meet_link ?? undefined,
  whatsappNotifiedAt: r.whatsapp_notified_at ?? undefined,
  cancelReason: r.cancel_reason ?? undefined,
  cancelledBy: r.cancelled_by ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

function mergeSettings(data: Partial<Settings> | null | undefined, inviteCode = ''): Settings {
  const d = data ?? {}
  return { ...DEFAULT_SETTINGS, ...d, weekly: { ...DEFAULT_SETTINGS.weekly, ...(d.weekly ?? {}) }, inviteCode }
}

// ---------- hata çevirisi ----------
interface AnyError {
  message?: string
  code?: string
  status?: number
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  const err = (e ?? {}) as AnyError
  const m = err.message ?? ''
  if (/Invalid login credentials/i.test(m)) return new AppError('Bilgiler hatalı. Lütfen tekrar dene.')
  if (/Email not confirmed/i.test(m)) return new AppError('E-posta adresini henüz onaylamadın. Gelen kutuna gelen linke tıkla.')
  if (/already (been )?registered/i.test(m)) return new AppError('Bu e-posta ile kayıtlı bir hesap zaten var.')
  if (/Password should/i.test(m)) return new AppError('Şifre en az 6 karakter olmalı.')
  if (/rate limit|too many/i.test(m)) return new AppError('Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.')
  if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(m)) {
    return new AppError('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.')
  }
  if (/JWT expired|session.*(missing|expired)/i.test(m)) return new AppError('Oturumun sona erdi. Tekrar giriş yap.')
  if (/Database error saving new user/i.test(m)) return new AppError('Kayıt tamamlanamadı. Bilgilerini kontrol edip tekrar dene.')
  if (err.code === '23505') return new AppError('Bu bilgi başka bir hesapta kayıtlı.')
  if (err.code === '42501') return new AppError('Bu işlem için yetkin yok.')
  // Sunucudaki fonksiyonlarımızın (raise exception) mesajları zaten Türkçe ve kullanıcıya uygun
  if (err.code === 'P0001' && m) return new AppError(m)
  return new AppError(m || 'Beklenmeyen bir hata oluştu.')
}

/** Hata varsa anlaşılır AppError fırlatır, yoksa veriyi döner. */
function must<D>(res: { data: D | null; error: unknown }): D {
  if (res.error) throw toAppError(res.error)
  return res.data as D
}

/** Satır olmayabilir (maybeSingle) */
function maybe<D>(res: { data: D | null; error: unknown }): D | null {
  if (res.error) throw toAppError(res.error)
  return res.data
}

interface BusyRow {
  start_at: string
  end_at: string
  mine: boolean
}

// ---------- yükleme ----------
let loadSeq = 0

async function loadAll(userId: string) {
  const seq = ++loadSeq
  const prof = maybe(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<ProfileRow>())
  if (!prof || prof.status !== 'active') {
    await supabase.auth.signOut()
    setState({
      me: null,
      users: [],
      appts: [],
      busy: [],
      blockedReason: prof ? 'Hesabın askıya alınmış. Lütfen bizimle iletişime geç.' : 'Hesap bulunamadı.',
    })
    return
  }
  const me = toUser(prof)
  const settingsRow = maybe(await supabase.from('app_settings').select('data').eq('id', 1).maybeSingle<{ data: Partial<Settings> }>())

  if (me.role === 'admin') {
    const [users, appts, secrets] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).returns<ProfileRow[]>(),
      supabase.from('appointments').select('*').order('start_at').returns<ApptRow[]>(),
      supabase.from('app_secrets').select('invite_code').eq('id', 1).maybeSingle<{ invite_code: string }>(),
    ])
    if (seq !== loadSeq) return
    setState({
      me,
      users: must(users).map(toUser),
      appts: must(appts).map(toAppt),
      busy: [],
      settings: mergeSettings(settingsRow?.data, maybe(secrets)?.invite_code ?? ''),
      blockedReason: '',
    })
  } else {
    const settings = mergeSettings(settingsRow?.data)
    const now = Date.now()
    const [appts, busy] = await Promise.all([
      supabase.from('appointments').select('*').eq('student_id', me.id).order('start_at').returns<ApptRow[]>(),
      supabase
        .rpc('busy_slots', {
          p_from: new Date(now).toISOString(),
          p_to: new Date(now + (settings.maxDaysAhead + 2) * 86400_000).toISOString(),
        }),
    ])
    if (seq !== loadSeq) return
    setState({
      me,
      users: [me],
      appts: must(appts).map(toAppt),
      busy: ((must(busy) ?? []) as BusyRow[]).map((b) => ({ start: iso(b.start_at), end: iso(b.end_at), mine: b.mine })),
      settings,
      blockedReason: '',
    })
  }
}

async function loadPublicConfig() {
  const { data } = await supabase.rpc('public_config')
  if (data) setState({ publicConfig: data as State['publicConfig'] })
}

/** Sunucudan güncel veriyi çek (hata olursa sessizce eski veriyle devam). */
export async function refresh() {
  const id = state.me?.id
  if (!id) return
  try {
    await loadAll(id)
  } catch (e) {
    console.warn('Yenileme başarısız', e)
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined
const scheduleRefresh = () => {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refresh, 400)
}

function clearUser() {
  setState({ me: null, users: [], appts: [], busy: [], settings: DEFAULT_SETTINGS })
}

/** Uygulama açılışında bir kez çağrılır. */
export async function init() {
  if (!isConfigured) return
  void loadPublicConfig()
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) await loadAll(data.session.user.id)
  } catch (e) {
    console.warn('Oturum yüklenemedi', e)
  } finally {
    setState({ ready: true })
  }

  supabase.auth.onAuthStateChange((event, session) => {
    // Supabase uyarısı: bu callback içinde doğrudan başka supabase çağrısı yapma → setTimeout
    if (event === 'SIGNED_OUT' || !session) {
      clearUser()
      return
    }
    if (session.user.id !== state.me?.id && event !== 'INITIAL_SESSION') {
      setTimeout(() => void refreshFor(session.user.id), 0)
    }
  })

  // Yeni randevular anında görünsün (yönetici tüm randevuları, öğrenci kendi randevularını alır)
  supabase
    .channel('appointments-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, scheduleRefresh)
    .subscribe()

  // Diğer öğrencilerin aldığı saatler için düzenli yenileme + sekmeye dönünce yenileme
  setInterval(() => document.visibilityState === 'visible' && refresh(), 60_000)
  window.addEventListener('focus', scheduleRefresh)
}

async function refreshFor(userId: string) {
  try {
    await loadAll(userId)
  } catch (e) {
    console.warn(e)
  }
}

// ---------- okuma (senkron) ----------
export const isReady = () => state.ready
export const getUsers = () => state.users
export const getStudents = () => state.users.filter((u) => u.role === 'student')
export const getUser = (id: string) => state.users.find((u) => u.id === id)
export const getAppointments = () => state.appts
export const getBusy = () => state.busy
export const getSettings = () => state.settings
export const getPublicConfig = () => state.publicConfig
export const currentUser = () => state.me

// ---------- doğrulama ----------
function validateStudentFields(input: { name: string; email: string; phone: string }) {
  const name = clean(input.name, 80)
  const email = input.email.trim().toLowerCase()
  if (name.length < 3) throw new AppError('Ad soyad en az 3 karakter olmalı.')
  if (!EMAIL_RE.test(email)) throw new AppError('Geçerli bir e-posta adresi gir.')
  const phone = normalizePhone(input.phone)
  if (!phone) throw new AppError('Geçerli bir telefon numarası gir (ör. 0537 000 00 00).')
  return { name, email, phone }
}

function validatePassword(pw: string) {
  if (pw.length < 6) throw new AppError('Şifre en az 6 karakter olmalı.')
  if (pw.length > 72) throw new AppError('Şifre çok uzun.')
}

// ---------- kimlik ----------
export async function login(identifier: string, password: string): Promise<User> {
  let email = identifier.trim().toLowerCase()
  if (!email || !password) throw new AppError('Kullanıcı adı / e-posta ve şifre gerekli.')
  if (!email.includes('@')) {
    const { data, error } = await supabase.rpc('resolve_login', { p_identifier: email })
    if (error) throw toAppError(error)
    if (!data) throw new AppError('Bilgiler hatalı. Lütfen tekrar dene.')
    email = data as string
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw toAppError(error)
  await loadAll(data.user.id)
  if (!state.me) throw new AppError(state.blockedReason || 'Giriş yapılamadı.')
  return state.me
}

export async function logout() {
  await supabase.auth.signOut()
  clearUser()
}

export interface RegisterInput {
  name: string
  email: string
  phone: string
  password: string
  inviteCode?: string
}

/** needsConfirm: Supabase'de e-posta onayı açıksa kullanıcı önce e-postasını onaylamalı. */
export async function register(input: RegisterInput): Promise<{ needsConfirm: boolean }> {
  const f = validateStudentFields(input)
  validatePassword(input.password)
  const invite = (input.inviteCode ?? '').trim()
  // Supabase kayıt hatalarını gizlediği için önce anlaşılır kontrolü yap
  const pre = must(await supabase.rpc('check_signup', { p_email: f.email, p_phone: f.phone, p_invite: invite }))
  if (pre) throw new AppError(pre as string)
  const { data, error } = await supabase.auth.signUp({
    email: f.email,
    password: input.password,
    options: { data: { name: f.name, phone: f.phone, invite_code: invite }, emailRedirectTo: window.location.origin },
  })
  if (error) throw toAppError(error)
  if (!data.session || !data.user) return { needsConfirm: true }
  await loadAll(data.user.id)
  return { needsConfirm: false }
}

// ---------- profil ----------
export async function updateProfile(_userId: string, patch: { name: string; phone: string }) {
  const name = clean(patch.name, 80)
  if (name.length < 2) throw new AppError('Ad soyad en az 2 karakter olmalı.')
  const phone = normalizePhone(patch.phone)
  if (!phone) throw new AppError('Geçerli bir telefon numarası gir.')
  must(await supabase.rpc('update_my_profile', { p_name: name, p_phone: phone }))
  await refresh()
}

export async function changePassword(_userId: string, current: string, next: string) {
  const me = state.me
  if (!me) throw new AppError('Oturum bulunamadı.')
  validatePassword(next)
  const check = await supabase.auth.signInWithPassword({ email: me.email, password: current })
  if (check.error) throw new AppError('Mevcut şifre hatalı.')
  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) throw toAppError(error)
}

// ---------- randevu (öğrenci) ----------
export interface BookInput {
  studentId: string
  start: string
  topic: string
  note: string
}

export async function bookAppointment(input: BookInput): Promise<Appointment> {
  const topic = clean(input.topic, 80)
  if (!topic) throw new AppError('Görüşme konusunu seç.')
  try {
    const row = must(
      await supabase
        .rpc('book_appointment', { p_start: input.start, p_topic: topic, p_note: input.note.trim().slice(0, 600) })
        .single<ApptRow>(),
    )
    return toAppt(row)
  } finally {
    // Başarılı ya da başarısız: dolu saatleri tazele
    await refresh()
  }
}

export function canStudentCancel(a: Appointment, now = Date.now()) {
  return (
    (a.status === 'pending' || a.status === 'confirmed') &&
    new Date(a.start).getTime() - now >= state.settings.cancelLimitHours * 3600_000
  )
}

export async function cancelByStudent(_studentId: string, apptId: string, reason: string): Promise<Appointment> {
  const row = must(await supabase.rpc('cancel_my_appointment', { p_id: apptId, p_reason: clean(reason, 300) }).single<ApptRow>())
  await refresh()
  return toAppt(row)
}

/** Bildirim işareti kritik değil: hata olursa kullanıcıyı rahatsız etme. */
export async function markWhatsappNotified(apptId: string) {
  try {
    must(await supabase.rpc('mark_whatsapp_notified', { p_id: apptId }))
    await refresh()
  } catch (e) {
    console.warn(e)
  }
}

// ---------- yönetim ----------
export async function setAppointmentStatus(apptId: string, status: AppointmentStatus, reason = '') {
  must(await supabase.rpc('admin_set_appointment_status', { p_id: apptId, p_status: status, p_reason: clean(reason, 300) }))
  await refresh()
}

export async function setMeetLink(apptId: string, link: string) {
  const v = link.trim()
  if (v && !isMeetLink(v)) throw new AppError('Geçerli bir Google Meet linki gir (https://meet.google.com/...).')
  must(await supabase.from('appointments').update({ meet_link: v || null }).eq('id', apptId))
  await refresh()
}

/** Kullanıcı oluşturma/silme gibi işlemler gizli anahtar gerektirir → Vercel sunucu fonksiyonu (api/admin.ts) */
async function adminApi(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AppError('Oturumun sona erdi. Tekrar giriş yap.')
  let res: Response
  try {
    res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AppError('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.')
  }
  if (res.status === 404) {
    throw new AppError('Bu işlem sunucu fonksiyonu gerektirir; sadece Vercel üzerinde (veya "vercel dev" ile) çalışır.')
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new AppError(json.error || 'İşlem başarısız oldu.')
  await refresh()
}

export async function adminCreateStudent(input: RegisterInput) {
  const f = validateStudentFields(input)
  validatePassword(input.password)
  await adminApi({ action: 'create', ...f, password: input.password })
}

export async function adminUpdateStudent(id: string, patch: { name: string; email: string; phone: string; adminNote?: string }) {
  const f = validateStudentFields(patch)
  await adminApi({ action: 'update', id, ...f, adminNote: clean(patch.adminNote ?? '', 500) })
}

export async function adminResetPassword(id: string, next: string) {
  validatePassword(next)
  await adminApi({ action: 'password', id, password: next })
}

export async function deleteStudent(id: string) {
  await adminApi({ action: 'delete', id })
}

export async function setUserStatus(id: string, status: 'active' | 'disabled') {
  must(await supabase.rpc('admin_set_user_status', { p_id: id, p_status: status }))
  await refresh()
}

export async function saveSettings(next: Settings) {
  // Kaydetmeden önce her şeyi doğrula: bozuk ayar tüm takvimi bozar
  for (let d = 0; d < 7; d++) {
    const ranges = [...(next.weekly[d] ?? [])].sort((a, b) => a.start.localeCompare(b.start))
    ranges.forEach((r, i) => {
      if (!isValidTime(r.start) || !isValidTime(r.end)) throw new AppError('Saatler SS:DD biçiminde olmalı.')
      if (toMinutes(r.end) <= toMinutes(r.start)) throw new AppError('Bitiş saati başlangıçtan sonra olmalı.')
      if (toMinutes(r.end) - toMinutes(r.start) < next.slotMinutes) {
        throw new AppError(`${r.start}-${r.end} aralığı bir görüşme süresinden (${next.slotMinutes} dk) kısa.`)
      }
      if (i > 0 && toMinutes(r.start) < toMinutes(ranges[i - 1].end)) throw new AppError('Aynı gün içinde saat aralıkları çakışıyor.')
    })
    next.weekly[d] = ranges
  }
  if (next.blockedDates.some((k) => !isValidDateKey(k))) throw new AppError('Geçersiz kapalı gün tarihi.')
  const num = (v: number, min: number, max: number, label: string) => {
    if (!Number.isInteger(v) || v < min || v > max) throw new AppError(`${label} ${min}-${max} arasında bir tam sayı olmalı.`)
  }
  num(next.slotMinutes, 15, 180, 'Görüşme süresi')
  num(next.bufferMinutes, 0, 120, 'Ara süre')
  num(next.minNoticeHours, 0, 168, 'Minimum bildirim süresi')
  num(next.maxDaysAhead, 1, 90, 'İleri tarih limiti')
  num(next.maxActivePerStudent, 1, 10, 'Aktif randevu limiti')
  num(next.cancelLimitHours, 0, 168, 'İptal limiti')
  const wa = normalizePhone(next.whatsappNumber)
  if (!wa) throw new AppError('WhatsApp numarası geçersiz.')
  if (next.defaultMeetLink.trim() && !isMeetLink(next.defaultMeetLink)) throw new AppError('Varsayılan Meet linki geçersiz.')
  const topics = [...new Set(next.topics.map((t) => clean(t, 60)).filter(Boolean))]
  if (!topics.length) throw new AppError('En az bir görüşme konusu olmalı.')

  const { inviteCode, ...rest } = next
  const data = {
    ...rest,
    whatsappNumber: wa,
    defaultMeetLink: next.defaultMeetLink.trim(),
    topics,
    blockedDates: [...new Set(next.blockedDates)].sort(),
  }
  must(await supabase.from('app_settings').update({ data }).eq('id', 1))
  must(await supabase.from('app_secrets').update({ invite_code: inviteCode.trim() }).eq('id', 1))
  await Promise.all([refresh(), loadPublicConfig()])
}

// ---------- yedek ----------
export function exportData() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), users: state.users, appointments: state.appts, settings: state.settings }, null, 2)
}
