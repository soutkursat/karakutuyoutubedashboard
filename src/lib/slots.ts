import type { Appointment, Busy, Settings } from './types'
import { addDays, dateKey, fromMinutes, toInstant, toMinutes, weekdayOf } from './time'

export interface Slot {
  start: string
  end: string
  available: boolean
  reason?: 'booked' | 'mine' | 'notice'
}

export interface DaySlots {
  key: string
  slots: Slot[]
  blocked: boolean
}

const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE

export function activeAppointments(list: Appointment[]) {
  return list.filter((a) => a.status === 'pending' || a.status === 'confirmed')
}

/**
 * Müsaitlik ayarlarından ileriye dönük tüm slotları üretir.
 * Not: Bu sadece gösterim içindir; asıl kontrol sunucudaki book_appointment fonksiyonundadır.
 */
export function buildSlots(settings: Settings, busyList: Busy[], now: number): DaySlots[] {
  const busy = busyList.map((b) => ({ s: new Date(b.start).getTime(), e: new Date(b.end).getTime(), mine: b.mine }))
  const earliest = now + settings.minNoticeHours * 3600_000
  const today = dateKey(new Date(now))
  const days: DaySlots[] = []
  const step = settings.slotMinutes + settings.bufferMinutes

  for (let i = 0; i <= settings.maxDaysAhead; i++) {
    const key = addDays(today, i)
    const blocked = settings.blockedDates.includes(key)
    const ranges = settings.weekly[weekdayOf(key)] ?? []
    const slots: Slot[] = []
    if (!blocked) {
      for (const r of ranges) {
        const rs = toMinutes(r.start)
        const re = toMinutes(r.end)
        for (let m = rs; m + settings.slotMinutes <= re; m += step) {
          const start = toInstant(key, fromMinutes(m))
          const end = new Date(start.getTime() + settings.slotMinutes * 60000)
          if (end.getTime() <= now) continue
          const hit = busy.find((b) => overlaps(start.getTime(), end.getTime(), b.s, b.e))
          const slot: Slot = { start: start.toISOString(), end: end.toISOString(), available: true }
          if (hit) {
            slot.available = false
            slot.reason = hit.mine ? 'mine' : 'booked'
          } else if (start.getTime() < earliest) {
            slot.available = false
            slot.reason = 'notice'
          }
          slots.push(slot)
        }
      }
      slots.sort((a, b) => a.start.localeCompare(b.start))
    }
    days.push({ key, slots, blocked })
  }
  return days
}

/**
 * Yöneticinin erteleme penceresi için: seçilen günün haftalık programdaki boş saatleri.
 * Bekleme/ileri tarih sınırları uygulanmaz (yönetici istediği güne taşıyabilir); kapalı gün de gösterilir.
 * Doluluk: diğer aktif randevular (ertelenen randevunun kendisi hariç).
 */
export function freeStartsOn(settings: Settings, key: string, appts: Appointment[], excludeId: string, durationMin: number, now: number) {
  const busy = activeAppointments(appts)
    .filter((a) => a.id !== excludeId)
    .map((a) => ({ s: new Date(a.start).getTime(), e: new Date(a.end).getTime() }))
  const step = settings.slotMinutes + settings.bufferMinutes
  const out: string[] = []
  for (const r of settings.weekly[weekdayOf(key)] ?? []) {
    for (let m = toMinutes(r.start); m + durationMin <= toMinutes(r.end); m += step) {
      const s = toInstant(key, fromMinutes(m)).getTime()
      const e = s + durationMin * 60000
      if (s <= now || busy.some((b) => overlaps(s, e, b.s, b.e))) continue
      out.push(fromMinutes(m))
    }
  }
  return out.sort()
}

/** Verilen aralık başka bir aktif randevuyla çakışıyor mu (hızlı uyarı; asıl kontrol veritabanında) */
export function clashes(appts: Appointment[], excludeId: string, startMs: number, endMs: number) {
  return activeAppointments(appts).some((a) => a.id !== excludeId && overlaps(startMs, endMs, new Date(a.start).getTime(), new Date(a.end).getTime()))
}
