/**
 * VERİ KATMANI (şimdilik tarayıcı içi / localStorage)
 * --------------------------------------------------
 * Uygulamanın geri kalanı SADECE bu dosyadaki fonksiyonları kullanır.
 * Gerçek sunucuya (Supabase vb.) geçerken yalnızca bu dosyanın içi değişecek,
 * sayfalara dokunmaya gerek kalmayacak.
 */
import { read, remove, write } from './storage'
import { sha256 } from './sha256'
import { isSlotBookable, activeAppointments } from './slots'
import type { Appointment, AppointmentStatus, Role, Session, Settings, User } from './types'
import { AppError, EMAIL_RE, clean, isMeetLink, normalizePhone } from './validation'
import { isValidDateKey, isValidTime, toMinutes } from './time'

const K = {
  users: 'kk.v1.users',
  appts: 'kk.v1.appointments',
  settings: 'kk.v1.settings',
  session: 'kk.v1.session',
}

const SESSION_DAYS = 7

export const DEFAULT_SETTINGS: Settings = {
  weekly: {
    0: [],
    1: [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
    2: [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
    3: [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
    4: [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
    5: [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '17:00' }],
    6: [],
  },
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
  topics: ['Kanal analizi', 'Niş / konu seçimi', 'Thumbnail & başlık', 'Senaryo / içerik', 'Monetizasyon', 'Diğer'],
}

// ---------- yardımcılar ----------
const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

const randomSalt = () => {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

const hashPassword = (pw: string, salt: string) => sha256(salt + ':' + pw)
const nowIso = () => new Date().toISOString()

function makeCode(existing: Appointment[]): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (;;) {
    let c = 'KK-'
    for (let i = 0; i < 5; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)]
    if (!existing.some((a) => a.code === c)) return c
  }
}

// ---------- tohum (ilk açılış) ----------
// DİKKAT: Bu sadece taslak/demodur. Gerçek sunucuya geçince yönetici şifresi
// asla kodda durmamalı; sunucuda hash'lenmiş olarak saklanmalı.
const SEED_ADMIN = { username: 'kursatyoutube', password: '123456', name: 'Kürşat' }

function ensureSeed() {
  const users = read<User[]>(K.users, [])
  if (!users.some((u) => u.role === 'admin')) {
    const salt = randomSalt()
    const admin: User = {
      id: 'admin',
      role: 'admin',
      name: SEED_ADMIN.name,
      email: '',
      username: SEED_ADMIN.username,
      phone: DEFAULT_SETTINGS.whatsappNumber,
      passwordHash: hashPassword(SEED_ADMIN.password, salt),
      salt,
      status: 'active',
      createdAt: nowIso(),
    }
    write(K.users, [admin, ...users])
  }
}
ensureSeed()

// ---------- okuma ----------
export const getUsers = () => read<User[]>(K.users, [])
export const getStudents = () => getUsers().filter((u) => u.role === 'student')
export const getUser = (id: string) => getUsers().find((u) => u.id === id)
export const getAppointments = () => read<Appointment[]>(K.appts, [])

export function getSettings(): Settings {
  const s = read<Partial<Settings>>(K.settings, {})
  // eksik alanları varsayılanla tamamla (sürüm yükseltmelerinde bozulmasın)
  return { ...DEFAULT_SETTINGS, ...s, weekly: { ...DEFAULT_SETTINGS.weekly, ...(s.weekly ?? {}) } }
}

export function getSession(): Session | null {
  const s = read<Session | null>(K.session, null)
  if (!s || s.expiresAt < Date.now()) return null
  return s
}

export function currentUser(): User | null {
  const s = getSession()
  if (!s) return null
  const u = getUser(s.userId)
  if (!u || u.status !== 'active') return null
  return u
}

// ---------- kimlik ----------
export function login(identifier: string, password: string): User {
  const id = identifier.trim().toLowerCase()
  if (!id || !password) throw new AppError('Kullanıcı adı / e-posta ve şifre gerekli.')
  const user = getUsers().find((u) => u.email.toLowerCase() === id || u.username?.toLowerCase() === id)
  // Hangi alanın yanlış olduğunu söylemiyoruz (hesap tahminini zorlaştırır)
  if (!user || hashPassword(password, user.salt) !== user.passwordHash) {
    throw new AppError('Bilgiler hatalı. Lütfen tekrar dene.')
  }
  if (user.status !== 'active') throw new AppError('Hesabın askıya alınmış. Lütfen bizimle iletişime geç.')
  write<Session>(K.session, { userId: user.id, expiresAt: Date.now() + SESSION_DAYS * 86400_000 })
  return user
}

export const logout = () => remove(K.session)

export interface RegisterInput {
  name: string
  email: string
  phone: string
  password: string
  inviteCode?: string
}

function validateStudentFields(input: { name: string; email: string; phone: string }, exceptId?: string) {
  const name = clean(input.name, 80)
  const email = input.email.trim().toLowerCase()
  if (name.length < 3) throw new AppError('Ad soyad en az 3 karakter olmalı.')
  if (!EMAIL_RE.test(email)) throw new AppError('Geçerli bir e-posta adresi gir.')
  const phone = normalizePhone(input.phone)
  if (!phone) throw new AppError('Geçerli bir telefon numarası gir (ör. 0537 000 00 00).')
  const users = getUsers()
  if (users.some((u) => u.id !== exceptId && u.email.toLowerCase() === email)) {
    throw new AppError('Bu e-posta ile kayıtlı bir hesap zaten var.')
  }
  if (users.some((u) => u.id !== exceptId && u.role === 'student' && u.phone === phone)) {
    throw new AppError('Bu telefon numarası başka bir hesapta kayıtlı.')
  }
  return { name, email, phone }
}

function validatePassword(pw: string) {
  if (pw.length < 6) throw new AppError('Şifre en az 6 karakter olmalı.')
  if (pw.length > 128) throw new AppError('Şifre çok uzun.')
}

function createStudent(input: RegisterInput): User {
  const fields = validateStudentFields(input)
  validatePassword(input.password)
  const salt = randomSalt()
  const user: User = {
    id: uid(),
    role: 'student',
    ...fields,
    passwordHash: hashPassword(input.password, salt),
    salt,
    status: 'active',
    createdAt: nowIso(),
  }
  write(K.users, [...getUsers(), user])
  return user
}

export function register(input: RegisterInput): User {
  const s = getSettings()
  if (!s.registrationOpen) throw new AppError('Şu an yeni kayıt alınmıyor. Hesabını yöneticiden iste.')
  if (s.inviteCode && (input.inviteCode ?? '').trim() !== s.inviteCode) {
    throw new AppError('Davet kodu hatalı.')
  }
  const user = createStudent(input)
  login(user.email, input.password)
  return user
}

// ---------- profil ----------
export function updateProfile(userId: string, patch: { name: string; email: string; phone: string }) {
  const user = getUser(userId)
  if (!user) throw new AppError('Kullanıcı bulunamadı.')
  const fields =
    user.role === 'admin'
      ? { name: clean(patch.name, 80), phone: normalizePhone(patch.phone) ?? user.phone, email: user.email }
      : validateStudentFields(patch, userId)
  write(K.users, getUsers().map((u) => (u.id === userId ? { ...u, ...fields } : u)))
}

export function changePassword(userId: string, current: string, next: string) {
  const user = getUser(userId)
  if (!user) throw new AppError('Kullanıcı bulunamadı.')
  if (hashPassword(current, user.salt) !== user.passwordHash) throw new AppError('Mevcut şifre hatalı.')
  validatePassword(next)
  const salt = randomSalt()
  write(K.users, getUsers().map((u) => (u.id === userId ? { ...u, salt, passwordHash: hashPassword(next, salt) } : u)))
}

// ---------- randevu (öğrenci) ----------
export interface BookInput {
  studentId: string
  start: string
  topic: string
  note: string
}

export function bookAppointment(input: BookInput): Appointment {
  const settings = getSettings()
  const student = getUser(input.studentId)
  if (!student || student.status !== 'active') throw new AppError('Oturumun geçersiz. Tekrar giriş yap.')
  const topic = clean(input.topic, 80)
  if (!topic) throw new AppError('Görüşme konusunu seç.')
  const note = clean(input.note, 600)

  const all = getAppointments()
  const now = Date.now()
  const mineActive = activeAppointments(all).filter(
    (a) => a.studentId === student.id && new Date(a.end).getTime() > now,
  )
  if (mineActive.length >= settings.maxActivePerStudent) {
    throw new AppError(
      `Aynı anda en fazla ${settings.maxActivePerStudent} aktif randevun olabilir. Önce mevcut randevunu tamamla ya da iptal et.`,
    )
  }
  // Son kontrol: başkası aynı saniyede almış olabilir, müsaitlik değişmiş olabilir
  if (!isSlotBookable(settings, all, input.start, now)) {
    throw new AppError('Bu saat az önce doldu ya da artık uygun değil. Lütfen başka bir saat seç.')
  }
  const start = new Date(input.start)
  const end = new Date(start.getTime() + settings.slotMinutes * 60000)
  const confirmed = settings.autoConfirm
  const appt: Appointment = {
    id: uid(),
    code: makeCode(all),
    studentId: student.id,
    start: start.toISOString(),
    end: end.toISOString(),
    topic,
    note,
    status: confirmed ? 'confirmed' : 'pending',
    meetLink: confirmed && settings.defaultMeetLink ? settings.defaultMeetLink : undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  write(K.appts, [...all, appt])
  return appt
}

export function canStudentCancel(a: Appointment, now = Date.now()) {
  const s = getSettings()
  return (
    (a.status === 'pending' || a.status === 'confirmed') &&
    new Date(a.start).getTime() - now >= s.cancelLimitHours * 3600_000
  )
}

function patchAppointment(id: string, patch: Partial<Appointment>): Appointment {
  const all = getAppointments()
  const existing = all.find((a) => a.id === id)
  if (!existing) throw new AppError('Randevu bulunamadı.')
  const updated = { ...existing, ...patch, updatedAt: nowIso() }
  write(K.appts, all.map((a) => (a.id === id ? updated : a)))
  return updated
}

export function cancelByStudent(studentId: string, apptId: string, reason: string) {
  const a = getAppointments().find((x) => x.id === apptId)
  if (!a || a.studentId !== studentId) throw new AppError('Randevu bulunamadı.')
  if (!canStudentCancel(a)) {
    throw new AppError(
      `Randevuya ${getSettings().cancelLimitHours} saatten az kaldığı için iptal edilemez. WhatsApp'tan bize yaz.`,
    )
  }
  return patchAppointment(apptId, { status: 'cancelled', cancelledBy: 'student', cancelReason: clean(reason, 300) })
}

export const markWhatsappNotified = (apptId: string) => patchAppointment(apptId, { whatsappNotifiedAt: nowIso() })

// ---------- yönetim ----------
export function setAppointmentStatus(apptId: string, status: AppointmentStatus, reason = '') {
  const a = getAppointments().find((x) => x.id === apptId)
  if (!a) throw new AppError('Randevu bulunamadı.')
  if (a.status === 'cancelled' && status !== 'cancelled') {
    // İptal edilmiş bir saati geri açarken çakışma olmasın
    const clash = activeAppointments(getAppointments()).some(
      (b) => b.id !== a.id && new Date(b.start) < new Date(a.end) && new Date(a.start) < new Date(b.end),
    )
    if (clash) throw new AppError('Bu saate başka bir randevu alınmış, geri açılamaz.')
  }
  const patch: Partial<Appointment> = { status }
  if (status === 'cancelled') Object.assign(patch, { cancelledBy: 'admin' as Role, cancelReason: clean(reason, 300) })
  if (status === 'confirmed' && !a.meetLink && getSettings().defaultMeetLink) patch.meetLink = getSettings().defaultMeetLink
  return patchAppointment(apptId, patch)
}

export function setMeetLink(apptId: string, link: string) {
  const v = link.trim()
  if (v && !isMeetLink(v)) throw new AppError('Geçerli bir Google Meet linki gir (https://meet.google.com/...).')
  return patchAppointment(apptId, { meetLink: v || undefined })
}

export function adminCreateStudent(input: RegisterInput) {
  return createStudent(input)
}

export function adminUpdateStudent(id: string, patch: { name: string; email: string; phone: string; adminNote?: string }) {
  const fields = validateStudentFields(patch, id)
  write(
    K.users,
    getUsers().map((u) => (u.id === id ? { ...u, ...fields, adminNote: clean(patch.adminNote ?? '', 500) } : u)),
  )
}

export function adminResetPassword(id: string, next: string) {
  validatePassword(next)
  const salt = randomSalt()
  write(K.users, getUsers().map((u) => (u.id === id ? { ...u, salt, passwordHash: hashPassword(next, salt) } : u)))
}

export function setUserStatus(id: string, status: 'active' | 'disabled') {
  const u = getUser(id)
  if (!u || u.role === 'admin') throw new AppError('Bu hesap değiştirilemez.')
  write(K.users, getUsers().map((x) => (x.id === id ? { ...x, status } : x)))
  if (status === 'disabled') cancelFutureFor(id, 'Hesap askıya alındı')
}

function cancelFutureFor(studentId: string, reason: string) {
  const now = Date.now()
  write(
    K.appts,
    getAppointments().map((a) =>
      a.studentId === studentId && (a.status === 'pending' || a.status === 'confirmed') && new Date(a.start).getTime() > now
        ? { ...a, status: 'cancelled' as const, cancelledBy: 'admin' as Role, cancelReason: reason, updatedAt: nowIso() }
        : a,
    ),
  )
}

export function deleteStudent(id: string) {
  const u = getUser(id)
  if (!u || u.role === 'admin') throw new AppError('Bu hesap silinemez.')
  write(K.users, getUsers().filter((x) => x.id !== id))
  write(K.appts, getAppointments().filter((a) => a.studentId !== id))
}

export function saveSettings(next: Settings) {
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
    if (!Number.isFinite(v) || v < min || v > max) throw new AppError(`${label} ${min}-${max} arasında olmalı.`)
  }
  num(next.slotMinutes, 15, 180, 'Görüşme süresi')
  num(next.bufferMinutes, 0, 120, 'Ara süre')
  num(next.minNoticeHours, 0, 168, 'Minimum bildirim süresi')
  num(next.maxDaysAhead, 1, 90, 'İleri tarih limiti')
  num(next.maxActivePerStudent, 1, 10, 'Aktif randevu limiti')
  num(next.cancelLimitHours, 0, 168, 'İptal limiti')
  const wa = normalizePhone(next.whatsappNumber)
  if (!wa) throw new AppError('WhatsApp numarası geçersiz.')
  if (next.defaultMeetLink && !isMeetLink(next.defaultMeetLink)) throw new AppError('Varsayılan Meet linki geçersiz.')
  const topics = next.topics.map((t) => clean(t, 60)).filter(Boolean)
  if (!topics.length) throw new AppError('En az bir görüşme konusu olmalı.')
  write(K.settings, {
    ...next,
    whatsappNumber: wa,
    defaultMeetLink: next.defaultMeetLink.trim(),
    inviteCode: next.inviteCode.trim(),
    topics,
    blockedDates: [...new Set(next.blockedDates)].sort(),
  })
}

// ---------- yedek ----------
export function exportData() {
  return JSON.stringify(
    { exportedAt: nowIso(), users: getUsers().map(({ passwordHash: _p, salt: _s, ...u }) => u), appointments: getAppointments(), settings: getSettings() },
    null,
    2,
  )
}
