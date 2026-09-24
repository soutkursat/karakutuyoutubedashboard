// Tüm randevular Türkiye saatine (UTC+3, yaz saati yok) göre planlanır.
// Kayıtlar ISO (UTC) olarak tutulur, ekranda her zaman İstanbul saatiyle gösterilir.
export const TZ = 'Europe/Istanbul'
const OFFSET_MS = 3 * 60 * 60 * 1000

export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

/** 'YYYY-MM-DD' — verilen anın İstanbul takvimindeki günü */
export function dateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

export function weekdayOf(key: string): number {
  return new Date(key + 'T00:00:00Z').getUTCDay()
}

export function addDays(key: string, n: number): string {
  const t = new Date(key + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/** İstanbul günü + 'HH:MM' → gerçek an */
export function toInstant(key: string, hhmm: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h, mi) - OFFSET_MS)
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

export const isValidTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
export const isValidDateKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'))

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, ...opts })
const fTime = fmt({ hour: '2-digit', minute: '2-digit', hour12: false })
const fDateLong = fmt({ day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
const fDate = fmt({ day: 'numeric', month: 'long', year: 'numeric' })
const fDayMonth = fmt({ day: 'numeric', month: 'short' })

export const formatTime = (iso: string | Date) => fTime.format(new Date(iso))
export const formatDateLong = (iso: string | Date) => fDateLong.format(new Date(iso))
export const formatDate = (iso: string | Date) => fDate.format(new Date(iso))
export const formatDayMonth = (iso: string | Date) => fDayMonth.format(new Date(iso))
export const formatKeyLong = (key: string) => formatDateLong(toInstant(key, '12:00'))
export const formatKeyDayMonth = (key: string) => formatDayMonth(toInstant(key, '12:00'))

export function relativeFromNow(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const min = Math.round(abs / 60000)
  const hr = Math.round(abs / 3600000)
  const day = Math.round(abs / 86400000)
  const txt = min < 60 ? `${min} dk` : hr < 48 ? `${hr} saat` : `${day} gün`
  return diff >= 0 ? `${txt} sonra` : `${txt} önce`
}
