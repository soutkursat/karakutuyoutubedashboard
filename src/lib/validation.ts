export class AppError extends Error {}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Telefonu WhatsApp'ın beklediği biçime (ülke kodu + numara, sadece rakam) çevirir. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('05')) d = '9' + d // 05xx... → 905xx...
  if (d.length === 10 && d.startsWith('5')) d = '90' + d // 5xx... → 905xx...
  if (d.startsWith('90') && d.length !== 12) return null
  if (d.length < 10 || d.length > 15) return null
  return d
}

export function formatPhone(d: string): string {
  if (!d) return ''
  if (d.startsWith('90') && d.length === 12) {
    return `+90 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`
  }
  return '+' + d
}

export function isMeetLink(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' && (u.hostname === 'meet.google.com' || u.hostname.endsWith('.zoom.us') || u.hostname === 'zoom.us')
  } catch {
    return false
  }
}

export const clean = (s: string, max = 500) => s.replace(/\s+/g, ' ').trim().slice(0, max)

/** YouTube kanal linkini düzenler; YouTube değilse null. "youtube.com/@x" gibi kısa yazımları da kabul eder. */
export function normalizeChannelUrl(input: string): string | null {
  let v = input.trim()
  if (!v) return null
  if (v.startsWith('@')) v = 'https://www.youtube.com/' + v
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v
  try {
    const u = new URL(v)
    const host = u.hostname.toLowerCase()
    if (!(host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be')) return null
    if (u.pathname.length < 2) return null
    u.protocol = 'https:'
    u.hash = ''
    const out = u.toString().replace(/\/$/, '')
    return out.length <= 300 ? out : null
  } catch {
    return null
  }
}

/** Linkten okunabilir kanal adı: "@kanaladi" ya da yol */
export function channelLabel(url: string): string {
  try {
    const u = new URL(url)
    const seg = decodeURIComponent(u.pathname).split('/').filter(Boolean)
    const handle = seg.find((x) => x.startsWith('@'))
    return handle ?? seg.slice(-1)[0] ?? u.hostname
  } catch {
    return url
  }
}
