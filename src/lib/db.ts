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
import type { Appointment, AppointmentStatus, Busy, Channel, ContentFormat, Settings, User } from './types'
import { AppError, EMAIL_RE, clean, isMeetLink, normalizePhone, normalizeChannelUrl } from './validation'
import { dateKey, isValidDateKey, isValidTime, toMinutes } from './time'

export const DEFAULT_SETTINGS: Settings = {
  weekly: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
  blockedDates: [],
  slotMinutes: 45,
  bufferMinutes: 15,
  minNoticeHours: 12,
  maxDaysAhead: 21,
  maxActivePerStudent: 2,
  introBookings: 4,
  introGapDays: 7,
  regularGapDays: 14,
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
  channels: Channel[]
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
  channels: [],
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
  skool_member?: boolean
  veteran?: boolean
  intro_used_extra?: number
  quota_reset_at?: string | null
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
  skoolMember: !!r.skool_member,
  veteran: !!r.veteran,
  introUsedExtra: r.intro_used_extra ?? 0,
  quotaResetAt: r.quota_reset_at ?? null,
  createdAt: r.created_at,
})

interface ChannelRow {
  id: string
  student_id: string
  url: string
  monetized: boolean
  started_on: string | null
  upload_days?: number[] | null
  video_count?: number | null
  niche?: string | null
  content_format?: ContentFormat | null
  challenge?: string | null
  upload_note?: string | null
  competitor_urls?: string[] | null
  created_at: string
}
const toChannel = (r: ChannelRow): Channel => ({
  id: r.id,
  studentId: r.student_id,
  url: r.url,
  monetized: r.monetized,
  startedOn: r.started_on,
  uploadDays: (r.upload_days ?? []).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)),
  videoCount: r.video_count ?? null,
  niche: r.niche ?? '',
  contentFormat: r.content_format ?? null,
  challenge: r.challenge ?? '',
  uploadNote: r.upload_note ?? '',
  competitorUrls: r.competitor_urls ?? [],
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
  if (err.code === '23514') return new AppError('Girilen bilgilerden biri geçersiz. Kontrol edip tekrar dene.')
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
      channels: [],
      blockedReason: prof ? 'Hesabın askıya alınmış. Lütfen bizimle iletişime geç.' : 'Hesap bulunamadı.',
    })
    return
  }
  const me = toUser(prof)
  const settingsRow = maybe(await supabase.from('app_settings').select('data').eq('id', 1).maybeSingle<{ data: Partial<Settings> }>())
  // Yönetici tüm kanalları, öğrenci sadece kendi kanallarını görür (RLS).
  // Şema henüz güncellenmediyse panel yine açılsın diye hata yumuşak karşılanır.
  const chRes = await supabase.from('student_channels').select('*').order('created_at').returns<ChannelRow[]>()
  if (chRes.error) console.warn('Kanallar yüklenemedi (supabase/schema.sql tekrar çalıştırılmalı):', chRes.error.message)
  const channels = (chRes.data ?? []).map(toChannel)

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
      channels,
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
      channels,
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
  setState({ me: null, users: [], appts: [], busy: [], channels: [], settings: DEFAULT_SETTINGS })
}

/** Uygulama açılışında bir kez çağrılır. */
export async function init() {
  if (!isConfigured) return
  void loadPublicConfig()
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      await loadAll(data.session.user.id)
      kickSync(false)
    }
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
  setInterval(() => {
    if (document.visibilityState !== 'visible') return
    void refresh()
    kickSync(false)
  }, 60_000)
  window.addEventListener('focus', scheduleRefresh)
}

async function refreshFor(userId: string) {
  try {
    await loadAll(userId)
    kickSync(false)
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
export const getChannels = (studentId: string) => state.channels.filter((c) => c.studentId === studentId)
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
export async function updateProfile(_userId: string, patch: { name: string; phone: string; skoolMember?: boolean }) {
  const name = clean(patch.name, 80)
  if (name.length < 2) throw new AppError('Ad soyad en az 2 karakter olmalı.')
  const phone = normalizePhone(patch.phone)
  if (!phone) throw new AppError('Geçerli bir WhatsApp numarası gir (ör. 0537 000 00 00).')
  must(await supabase.rpc('update_my_profile', { p_name: name, p_phone: phone, p_skool: patch.skoolMember ?? null }))
  await refresh()
}

// ---------- kanallar ----------
export interface ChannelInput {
  url: string
  monetized: boolean
  startedOn: string
}

function validateChannel(input: ChannelInput) {
  const url = normalizeChannelUrl(input.url)
  if (!url) throw new AppError('Geçerli bir YouTube kanal linki gir (ör. https://www.youtube.com/@kanaladi).')
  const startedOn = input.startedOn || null
  if (startedOn) {
    if (!isValidDateKey(startedOn)) throw new AppError('Başlangıç tarihi geçersiz.')
    if (startedOn < '2005-01-01' || startedOn > dateKey()) {
      throw new AppError('Başlangıç tarihi bugünden ileri ya da 2005’ten önce olamaz.')
    }
  }
  return { url, monetized: !!input.monetized, started_on: startedOn }
}

/** İsteğe bağlı kanal detayları (sadece öğrencinin kendi formundan) */
export interface ChannelDetails {
  uploadDays: number[]
  videoCount: string
  niche: string
  contentFormat: ContentFormat | null
  challenge: string
  uploadNote: string
  competitorUrls: string[]
}

function validateDetails(d: ChannelDetails) {
  const days = [...new Set(d.uploadDays)].filter((x) => Number.isInteger(x) && x >= 0 && x <= 6)
  let videoCount: number | null = null
  if (d.videoCount.trim()) {
    videoCount = Number(d.videoCount.replace(/[.\s]/g, ''))
    if (!Number.isInteger(videoCount) || videoCount < 0 || videoCount > 100000) throw new AppError('Video sayısı 0 ile 100.000 arasında bir tam sayı olmalı.')
  }
  const format = d.contentFormat && ['long', 'shorts', 'both'].includes(d.contentFormat) ? d.contentFormat : null
  const competitors: string[] = []
  for (const raw of d.competitorUrls.map((x) => x.trim()).filter(Boolean)) {
    const u = normalizeChannelUrl(raw)
    if (!u) throw new AppError(`Rakip kanal linki geçersiz: ${raw.slice(0, 40)}`)
    if (!competitors.some((c) => c.toLowerCase() === u.toLowerCase())) competitors.push(u)
  }
  if (competitors.length > 3) throw new AppError('En fazla 3 rakip kanal ekleyebilirsin.')
  return {
    upload_days: days,
    video_count: videoCount,
    niche: clean(d.niche, 120) || null,
    content_format: format,
    challenge: d.challenge.trim().slice(0, 600) || null,
    upload_note: clean(d.uploadNote, 80) || null,
    competitor_urls: competitors,
  }
}

export async function addChannel(input: ChannelInput, details?: ChannelDetails) {
  const row = { ...validateChannel(input), ...(details ? validateDetails(details) : {}) }
  if (state.me && getChannels(state.me.id).some((c) => c.url.toLowerCase() === row.url.toLowerCase())) {
    throw new AppError('Bu kanal zaten ekli.')
  }
  must(await supabase.from('student_channels').insert(row))
  await refresh()
}

export async function updateChannel(id: string, input: ChannelInput, details?: ChannelDetails) {
  const row = { ...validateChannel(input), ...(details ? validateDetails(details) : {}) }
  must(await supabase.from('student_channels').update(row).eq('id', id))
  await refresh()
}

export async function deleteChannel(id: string) {
  must(await supabase.from('student_channels').delete().eq('id', id))
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
    kickSync(true)
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
  kickSync(true)
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
  kickSync(true)
}

export async function setMeetLink(apptId: string, link: string) {
  const v = link.trim()
  if (v && !isMeetLink(v)) throw new AppError('Geçerli bir Google Meet linki gir (https://meet.google.com/...).')
  must(await supabase.from('appointments').update({ meet_link: v || null }).eq('id', apptId))
  await refresh()
}

/** Vercel sunucu fonksiyonunu (api/*) oturum anahtarıyla çağırır. */
async function callApi<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AppError('Oturumun sona erdi. Tekrar giriş yap.')
  let res: Response
  try {
    res = await fetch(path, {
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
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new AppError(json.error || 'İşlem başarısız oldu.')
  return json
}

/** Kullanıcı oluşturma/silme gibi işlemler gizli anahtar gerektirir → api/admin.ts */
async function adminApi(body: Record<string, unknown>) {
  await callApi('/api/admin', body)
  await refresh()
}

// ---------- Google Takvim ----------
export interface GoogleStatus {
  configured: boolean
  connected: boolean
  email: string | null
  lastSyncedAt: string | null
  lastError: string | null
  redirectUri: string
}
interface SyncResponse {
  connected: boolean
  synced: boolean
  error?: string
}

let google: GoogleStatus | null = null
let googleLoadError = ''
export const getGoogleStatus = () => google
export const getGoogleLoadError = () => googleLoadError

let syncing = false
let syncQueued = false
/**
 * Google senkronunu arka planda tetikler (randevu → takvim etkinliği + Meet linki, takvim → dolu saatler).
 * Hata olursa kullanıcıyı rahatsız etmez; yönetici durumu Müsaitlik sayfasında görür.
 */
export function kickSync(force: boolean) {
  if (!isConfigured || !state.me) return
  if (syncing) {
    syncQueued = syncQueued || force
    return
  }
  syncing = true
  void (async () => {
    try {
      const r = await callApi<SyncResponse>('/api/google', { action: 'sync', force })
      if (r.synced) await refresh()
      if (state.me?.role === 'admin' && (r.synced || r.error)) await loadGoogleStatus()
    } catch {
      // Yerel geliştirmede api yoktur ya da Google bağlı değildir: sessizce geç
    } finally {
      syncing = false
      if (syncQueued) {
        syncQueued = false
        setTimeout(() => kickSync(true), 1500)
      }
    }
  })()
}

export async function loadGoogleStatus() {
  try {
    google = await callApi<GoogleStatus>('/api/google', { action: 'status' })
    googleLoadError = ''
  } catch (e) {
    googleLoadError = toAppError(e).message
  }
  emit()
}

/** Google izin ekranına yönlendirir. */
export async function googleConnect() {
  const { url } = await callApi<{ url: string }>('/api/google', { action: 'connect' })
  window.location.href = url
}

export async function googleDisconnect() {
  await callApi('/api/google', { action: 'disconnect' })
  await Promise.all([loadGoogleStatus(), refresh()])
}

export async function googleSyncNow() {
  const r = await callApi<SyncResponse>('/api/google', { action: 'sync', force: true })
  await Promise.all([loadGoogleStatus(), refresh()])
  if (r.error) throw new AppError(r.error)
  if (!r.connected) throw new AppError('Google Takvim bağlı değil.')
}

/** Yöneticinin öğrenci ekle/düzenle formu (kayıt formundaki her şey + haklar) */
export interface StudentForm {
  name: string
  email: string
  phone: string
  /** Yeni öğrencide zorunlu; düzenlemede boşsa değişmez */
  password: string
  adminNote: string
  skoolMember: boolean
  veteran: boolean
  /** Yeni üye döneminde kalan haftalık hak (veteran=false iken) */
  introLeft: number
  channels: (ChannelInput & { id?: string })[]
}

/** Profil ek alanları + kanallar (yönetici RLS yetkisiyle) */
async function saveStudentExtras(id: string, form: StudentForm, channels: ReturnType<typeof validateChannel>[]) {
  const counted = state.appts.filter((a) => a.studentId === id && a.status !== 'cancelled').length
  const introLeft = Math.max(0, Math.min(20, Math.round(form.introLeft)))
  must(
    await supabase
      .from('profiles')
      .update({
        skool_member: form.skoolMember,
        veteran: form.veteran,
        // Kalan hak = introBookings - (randevu sayısı + düzeltme) → düzeltme = introBookings - kalan - randevu sayısı
        intro_used_extra: form.veteran ? 0 : state.settings.introBookings - introLeft - counted,
      })
      .eq('id', id),
  )
  // Kanallar: formdaki listeyle veritabanını eşitle
  const existing = getChannels(id)
  const keepIds = new Set(form.channels.map((c) => c.id).filter(Boolean))
  for (const c of existing) {
    if (!keepIds.has(c.id)) must(await supabase.from('student_channels').delete().eq('id', c.id))
  }
  for (let i = 0; i < form.channels.length; i++) {
    const src = form.channels[i]
    const row = channels[i]
    if (src.id) {
      const old = existing.find((c) => c.id === src.id)
      if (old && (old.url !== row.url || old.monetized !== row.monetized || old.startedOn !== row.started_on)) {
        must(await supabase.from('student_channels').update(row).eq('id', src.id))
      }
    } else {
      must(await supabase.from('student_channels').insert({ ...row, student_id: id }))
    }
  }
}

function prepareStudentForm(form: StudentForm, isNew: boolean) {
  const f = validateStudentFields(form)
  if (isNew || form.password) validatePassword(form.password)
  // Boş satırları at, kalanları ağa gitmeden önce doğrula (yarım kayıt olmasın)
  const filled = form.channels.filter((c) => c.url.trim())
  const channels = filled.map((c, i) => {
    try {
      return validateChannel(c)
    } catch (e) {
      throw new AppError(`${i + 1}. kanal: ${toAppError(e).message}`)
    }
  })
  const urls = channels.map((c) => c.url.toLowerCase())
  if (new Set(urls).size !== urls.length) throw new AppError('Aynı kanal iki kez eklenmiş.')
  return { f, channels, form: { ...form, channels: filled } }
}

export async function adminCreateStudent(form: StudentForm) {
  const { f, channels, form: cleanForm } = prepareStudentForm(form, true)
  const { id } = await callApi<{ id?: string }>('/api/admin', { action: 'create', ...f, password: form.password })
  if (id) {
    await refresh()
    try {
      await saveStudentExtras(id, cleanForm, channels)
      if (form.adminNote.trim()) await callApi('/api/admin', { action: 'update', id, ...f, adminNote: clean(form.adminNote, 500) })
    } finally {
      await refresh()
    }
  } else {
    await refresh()
  }
}

export async function adminUpdateStudent(id: string, form: StudentForm) {
  const { f, channels, form: cleanForm } = prepareStudentForm(form, false)
  await callApi('/api/admin', { action: 'update', id, ...f, adminNote: clean(form.adminNote, 500) })
  if (form.password) await callApi('/api/admin', { action: 'password', id, password: form.password })
  try {
    await saveStudentExtras(id, cleanForm, channels)
  } finally {
    await refresh()
  }
}

/** Beklemeyi kaldır: öğrenci hemen yeni randevu oluşturabilir */
export async function adminResetQuota(id: string) {
  must(await supabase.from('profiles').update({ quota_reset_at: new Date().toISOString() }).eq('id', id))
  await refresh()
}

export async function adminResetPassword(id: string, next: string) {
  validatePassword(next)
  await adminApi({ action: 'password', id, password: next })
}

export async function deleteStudent(id: string) {
  await adminApi({ action: 'delete', id })
}

/** Eski öğrenci: yeni üye dönemini atlar, doğrudan 2 haftada 1 randevu */
export async function setVeteran(id: string, veteran: boolean) {
  must(await supabase.from('profiles').update({ veteran }).eq('id', id))
  await refresh()
}

export async function setUserStatus(id: string, status: 'active' | 'disabled') {
  must(await supabase.rpc('admin_set_user_status', { p_id: id, p_status: status }))
  await refresh()
  kickSync(true)
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
  num(next.introBookings, 0, 20, 'Yeni üye randevu hakkı')
  num(next.introGapDays, 0, 60, 'Yeni üye randevu aralığı')
  num(next.regularGapDays, 0, 90, 'Randevu aralığı')
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
