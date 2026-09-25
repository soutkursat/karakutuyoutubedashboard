/**
 * RANDEVU SIKLIĞI KURALI (sunucudaki book_appointment ile birebir aynı)
 * - Yeni üye: ilk `introBookings` (4) randevuyu `introGapDays` (7) günde bir oluşturabilir.
 * - Sonra (ya da "eski öğrenci" işaretliyse): `regularGapDays` (14) günde bir.
 * - Süre son randevunun OLUŞTURULDUĞU andan başlar. İptal edilen randevular sayılmaz.
 * - Yönetici düzeltmeleri: introUsedExtra (dışarıda kullanılmış haklar), quotaResetAt (beklemeyi kaldır).
 * Burası sadece arayüzde bilgi göstermek içindir; asıl kontrol sunucuda.
 */
import type { Appointment, Settings, User } from './types'

export interface Quota {
  /** Şu an randevu oluşturabilir mi */
  canBook: boolean
  /** Bir sonraki hakkın açılacağı an (canBook=false iken) */
  nextAt: number | null
  /** Sayılan (iptal edilmemiş) randevu sayısı */
  used: number
  /** Yeni üye döneminde mi */
  intro: boolean
  /** Yeni üye döneminde kalan hak (intro=true iken) */
  introLeft: number
  /** Şu an geçerli aralık (gün) */
  gapDays: number
}

export function computeQuota(user: User, appts: Appointment[], s: Settings, now = Date.now()): Quota {
  const counted = appts.filter((a) => a.studentId === user.id && a.status !== 'cancelled')
  const used = counted.length + (user.introUsedExtra ?? 0)
  const intro = !user.veteran && used < s.introBookings
  const gapDays = intro ? s.introGapDays : s.regularGapDays
  // Yönetici "beklemeyi kaldır" dediyse o andan önceki randevular süreyi etkilemez
  const resetAt = user.quotaResetAt ? new Date(user.quotaResetAt).getTime() : 0
  const last = counted.reduce((m, a) => {
    const t = new Date(a.createdAt).getTime()
    return t > resetAt ? Math.max(m, t) : m
  }, 0)
  const nextAt = last ? last + gapDays * 86400_000 : null
  const canBook = !nextAt || now >= nextAt
  return { canBook, nextAt: canBook ? null : nextAt, used, intro, introLeft: Math.max(0, s.introBookings - used), gapDays }
}

/** "3 gün 4 saat", "5 saat 20 dk", "12 dk" */
export function formatRemaining(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60000))
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d > 0) return h ? `${d} gün ${h} saat` : `${d} gün`
  if (h > 0) return m ? `${h} saat ${m} dk` : `${h} saat`
  return `${m} dk`
}

/** Kuralın açıklaması; `forAdmin` ise üçüncü şahıs ("oluşturabilir") */
export function quotaRuleText(user: User, s: Settings, forAdmin = false): string {
  const verb = forAdmin ? 'oluşturabilir' : 'oluşturabilirsin'
  return user.veteran
    ? `${s.regularGapDays} günde 1 randevu ${verb}.`
    : `İlk ${s.introBookings} randevu${forAdmin ? 'sunu' : 'nu'} ${s.introGapDays} günde 1, sonrasında ${s.regularGapDays} günde 1 ${verb}.`
}
