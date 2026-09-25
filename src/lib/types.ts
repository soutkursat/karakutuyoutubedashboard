export type Role = 'student' | 'admin'
export type UserStatus = 'active' | 'disabled'

export interface User {
  id: string
  role: Role
  name: string
  /** Öğrenciler e-posta ile, yönetici kullanıcı adıyla giriş yapar */
  email: string
  username?: string
  phone: string
  status: UserStatus
  /** Skool topluluğunda mı (öğrenci işaretler) */
  skoolMember: boolean
  /** Eski öğrenci: yeni üye dönemini atlar, doğrudan 2 haftada 1 (yönetici işaretler) */
  veteran: boolean
  createdAt: string
  adminNote?: string
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Appointment {
  id: string
  /** İnsan tarafından okunabilir kod, WhatsApp mesajında kullanılır */
  code: string
  studentId: string
  start: string // ISO (UTC)
  end: string // ISO (UTC)
  topic: string
  note: string
  status: AppointmentStatus
  meetLink?: string
  whatsappNotifiedAt?: string
  cancelReason?: string
  cancelledBy?: Role
  createdAt: string
  updatedAt: string
}

export interface TimeRange {
  start: string // 'HH:MM'
  end: string
}

export interface Settings {
  /** 0 = Pazar ... 6 = Cumartesi */
  weekly: Record<number, TimeRange[]>
  blockedDates: string[] // 'YYYY-MM-DD'
  slotMinutes: number
  bufferMinutes: number
  minNoticeHours: number
  maxDaysAhead: number
  maxActivePerStudent: number
  /** Yeni üyenin haftalık randevu hakkı sayısı (varsayılan 4) */
  introBookings: number
  /** Yeni üye döneminde iki randevu arası gün (varsayılan 7) */
  introGapDays: number
  /** Sonrasında iki randevu arası gün (varsayılan 14) */
  regularGapDays: number
  cancelLimitHours: number
  whatsappNumber: string
  defaultMeetLink: string
  autoConfirm: boolean
  registrationOpen: boolean
  /** Sadece yönetici görür (ayrı, gizli tabloda tutulur) */
  inviteCode: string
  topics: string[]
}

export interface Channel {
  id: string
  studentId: string
  url: string
  monetized: boolean
  /** 'YYYY-MM-DD' — kanalın açıldığı ya da aktif içerik üretmeye başlanan tarih */
  startedOn: string | null
  createdAt: string
}

/** Dolu saat (kimin aldığı öğrenciye gösterilmez) */
export interface Busy {
  start: string
  end: string
  mine: boolean
}
