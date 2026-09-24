import type { Appointment, Settings } from './types'
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

/** Müsaitlik ayarlarından ileriye dönük tüm slotları üretir. */
export function buildSlots(settings: Settings, appointments: Appointment[], now: number, viewerId?: string): DaySlots[] {
  const busy = activeAppointments(appointments).map((a) => ({
    s: new Date(a.start).getTime(),
    e: new Date(a.end).getTime(),
    mine: a.studentId === viewerId,
  }))
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

export function isSlotBookable(settings: Settings, appointments: Appointment[], startIso: string, now: number): boolean {
  const key = dateKey(new Date(startIso))
  const day = buildSlots(settings, appointments, now).find((d) => d.key === key)
  return !!day?.slots.some((s) => s.start === startIso && s.available)
}
