import type { AppointmentStatus } from './types'

export const BRAND = 'Kara Kutu YouTube Akademisi'

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Onay bekliyor',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase('tr-TR'))
    .join('')
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : 'Beklenmeyen bir hata oluştu.'
}
