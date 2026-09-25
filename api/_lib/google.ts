/**
 * Google Takvim entegrasyonu (sunucu tarafı).
 * - Mentörün Google hesabı bir kez bağlanır (OAuth), refresh_token veritabanında saklanır.
 * - sync(): randevuları Google Takvime işler (Meet linkiyle) ve takvimdeki dolu saatleri okur.
 * Harici kütüphane yok; Google REST API'si doğrudan fetch ile çağrılıyor.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from './server.js'

const CAL = 'https://www.googleapis.com/calendar/v3'
const TZ = 'Europe/Istanbul'
export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events']

export function googleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  return { clientId, clientSecret, configured: !!clientId && !!clientSecret }
}

export function redirectUri(request: Request) {
  const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '')
  return `${base}/api/google-callback`
}

interface Integration {
  email: string | null
  refresh_token: string | null
  connected_at: string | null
  last_synced_at: string | null
  last_error: string | null
}

export async function getIntegration(sb: SupabaseClient): Promise<Integration> {
  const { data, error } = await sb.from('google_integration').select('*').eq('id', 1).maybeSingle()
  if (error) throw new HttpError(500, 'Veritabanı güncel değil: supabase/schema.sql dosyasını tekrar çalıştır.')
  return (data ?? { email: null, refresh_token: null, connected_at: null, last_synced_at: null, last_error: null }) as Integration
}

async function accessToken(sb: SupabaseClient, refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = googleEnv()
  if (!clientId || !clientSecret) throw new HttpError(500, 'Google ayarları eksik (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!res.ok || !body.access_token) {
    if (body.error === 'invalid_grant') {
      // İzin geri alınmış ya da süresi dolmuş → bağlantıyı düşür, yöneticiye göster
      await sb
        .from('google_integration')
        .update({ refresh_token: null, last_error: 'Google bağlantısı koptu. Müsaitlik sayfasından tekrar bağla.' })
        .eq('id', 1)
      throw new HttpError(400, 'Google bağlantısı koptu. Müsaitlik sayfasından tekrar bağla.')
    }
    throw new HttpError(502, `Google erişim anahtarı alınamadı (${body.error ?? res.status}).`)
  }
  return body.access_token
}

async function gcal<T>(token: string, path: string, init: RequestInit = {}): Promise<{ status: number; data: T | null }> {
  const res = await fetch(CAL + path, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  if (res.status === 204) return { status: 204, data: null }
  const data = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Takvim hatası (${res.status}): ${data?.error?.message ?? 'bilinmiyor'}`)
  }
  return { status: res.status, data }
}

// ---------------------------------------------------------------------------
interface ApptRow {
  id: string
  code: string
  student_id: string
  start_at: string
  end_at: string
  topic: string
  note: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  meet_link: string | null
  google_event_id: string | null
  google_synced_status: string | null
}
interface StudentRow {
  id: string
  name: string
  email: string
  phone: string
}
interface GEvent {
  id: string
  status?: string
  transparency?: string
  hangoutLink?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
  extendedProperties?: { private?: Record<string, string> }
}

function eventBody(a: ApptRow, s: StudentRow | undefined) {
  const confirmed = a.status === 'confirmed'
  const name = s?.name ?? 'Öğrenci'
  return {
    summary: `${confirmed ? '' : '[Onay bekliyor] '}Kara Kutu Mentörlük · ${name}`,
    description: [
      `Konu: ${a.topic}`,
      a.note ? `Not: ${a.note}` : '',
      '',
      `Öğrenci: ${name}`,
      s?.phone ? `Telefon: +${s.phone}` : '',
      s?.email ? `E-posta: ${s.email}` : '',
      `Randevu No: ${a.code}`,
      '',
      'Bu etkinlik Kara Kutu randevu panelinden otomatik oluşturuldu.',
    ]
      .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
      .join('\n'),
    start: { dateTime: a.start_at, timeZone: TZ },
    end: { dateTime: a.end_at, timeZone: TZ },
    // Onaylanana kadar öğrenci davet edilmez; onaylanınca Google davet e-postası gönderir
    attendees: confirmed && s?.email ? [{ email: s.email, displayName: name }] : [],
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false,
    extendedProperties: { private: { kkAppointmentId: a.id } },
  }
}

/** Randevuları Google Takvime işler. Dönen: yapılan işlem sayısı */
async function reconcileAppointments(sb: SupabaseClient, token: string): Promise<number> {
  const since = new Date(Date.now() - 86400_000).toISOString()
  const { data, error } = await sb
    .from('appointments')
    .select('id,code,student_id,start_at,end_at,topic,note,status,meet_link,google_event_id,google_synced_status')
    .gte('end_at', since)
    .order('start_at')
  if (error) throw new Error(error.message)
  const now = Date.now()
  const appts = (data ?? []) as ApptRow[]
  const todo = appts.filter((a) => {
    const active = a.status === 'pending' || a.status === 'confirmed'
    if (active && new Date(a.end_at).getTime() <= now) return false
    if (active && !a.google_event_id) return true
    if (active && a.google_synced_status !== a.status) return true
    if (active && !a.meet_link) return true
    return a.status === 'cancelled' && !!a.google_event_id && a.google_synced_status !== 'cancelled'
  }).slice(0, 15) // tek seferde sınırlı iş: fonksiyon zaman aşımına düşmesin

  if (!todo.length) return 0
  const ids = [...new Set(todo.map((a) => a.student_id))]
  const { data: studs } = await sb.from('profiles').select('id,name,email,phone').in('id', ids)
  const byId = new Map(((studs ?? []) as StudentRow[]).map((s) => [s.id, s]))

  let done = 0
  for (const a of todo) {
    const s = byId.get(a.student_id)
    const confirmed = a.status === 'confirmed'
    if (a.status === 'cancelled') {
      await gcal(token, `/calendars/primary/events/${encodeURIComponent(a.google_event_id!)}?sendUpdates=all`, { method: 'DELETE' })
      await sb.from('appointments').update({ google_synced_status: 'cancelled' }).eq('id', a.id)
      done++
      continue
    }
    let ev: GEvent | null = null
    if (a.google_event_id) {
      if (a.google_synced_status !== a.status) {
        const r = await gcal<GEvent>(
          token,
          `/calendars/primary/events/${encodeURIComponent(a.google_event_id)}?conferenceDataVersion=1&sendUpdates=${confirmed ? 'all' : 'none'}`,
          { method: 'PATCH', body: JSON.stringify(eventBody(a, s)) },
        )
        ev = r.status === 404 || r.status === 410 ? null : r.data
      } else {
        const r = await gcal<GEvent>(token, `/calendars/primary/events/${encodeURIComponent(a.google_event_id)}`)
        ev = r.status === 404 || r.status === 410 ? null : r.data
      }
      if (!ev) {
        // Etkinlik Google'dan elle silinmiş → bir sonraki turda yeniden oluşturulsun
        await sb.from('appointments').update({ google_event_id: null, google_synced_status: null }).eq('id', a.id)
        done++
        continue
      }
    } else {
      const r = await gcal<GEvent>(token, `/calendars/primary/events?conferenceDataVersion=1&sendUpdates=${confirmed ? 'all' : 'none'}`, {
        method: 'POST',
        body: JSON.stringify({
          ...eventBody(a, s),
          conferenceData: { createRequest: { requestId: `kk-${a.id}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        }),
      })
      ev = r.data
    }
    if (!ev) continue
    await sb
      .from('appointments')
      .update({
        google_event_id: ev.id,
        google_synced_status: a.status,
        // Elle girilmiş link varsa korunur
        ...(a.meet_link ? {} : ev.hangoutLink ? { meet_link: ev.hangoutLink } : {}),
      })
      .eq('id', a.id)
    done++
  }
  return done
}

const allDay = (d: string) => new Date(`${d}T00:00:00+03:00`).toISOString()

/** Google Takvimdeki (randevu sistemi dışı) dolu saatleri okuyup veritabanına yazar. */
async function refreshBusy(sb: SupabaseClient, token: string) {
  const { data: st } = await sb.from('app_settings').select('data').eq('id', 1).maybeSingle()
  const days = Number((st?.data as { maxDaysAhead?: number } | undefined)?.maxDaysAhead ?? 21) + 2
  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + days * 86400_000).toISOString()
  const rows: { start: string; end: string }[] = []
  let pageToken = ''
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      fields: 'nextPageToken,items(id,status,transparency,start,end,attendees(self,responseStatus),extendedProperties)',
    })
    if (pageToken) q.set('pageToken', pageToken)
    const r = await gcal<{ items?: GEvent[]; nextPageToken?: string }>(token, `/calendars/primary/events?${q}`)
    for (const e of r.data?.items ?? []) {
      if (e.status === 'cancelled') continue
      if (e.transparency === 'transparent') continue // "Müsait" olarak işaretli etkinlikler engellemez
      if (e.extendedProperties?.private?.kkAppointmentId) continue // kendi randevularımız zaten sayılıyor
      if (e.attendees?.some((x) => x.self && x.responseStatus === 'declined')) continue
      const start = e.start?.dateTime ? new Date(e.start.dateTime).toISOString() : e.start?.date ? allDay(e.start.date) : null
      const end = e.end?.dateTime ? new Date(e.end.dateTime).toISOString() : e.end?.date ? allDay(e.end.date) : null
      if (start && end && end > start) rows.push({ start, end })
    }
    pageToken = r.data?.nextPageToken ?? ''
    if (!pageToken) break
  }
  const { error } = await sb.rpc('replace_external_busy', { p_rows: rows })
  if (error) throw new Error(error.message)
  return rows.length
}

export interface SyncResult {
  connected: boolean
  synced: boolean
  events?: number
  busy?: number
  error?: string
}

/**
 * Tam senkronizasyon. Sık çağrılabilir: force=false iken son 60 sn içinde yapıldıysa atlanır,
 * force=true iken 5 sn. Kilit sayesinde aynı anda iki senkron çalışmaz.
 */
export async function sync(sb: SupabaseClient, force: boolean): Promise<SyncResult> {
  const integ = await getIntegration(sb)
  if (!integ.refresh_token || !googleEnv().configured) return { connected: false, synced: false }
  const age = integ.last_synced_at ? Date.now() - new Date(integ.last_synced_at).getTime() : Infinity
  if (age < (force ? 5_000 : 60_000)) return { connected: true, synced: false }

  const { data: locked } = await sb.rpc('google_try_lock', { p_seconds: 45 })
  if (!locked) return { connected: true, synced: false }
  try {
    const token = await accessToken(sb, integ.refresh_token)
    const events = await reconcileAppointments(sb, token)
    const busy = await refreshBusy(sb, token)
    await sb.from('google_integration').update({ last_synced_at: new Date().toISOString(), last_error: null, sync_lock_until: null }).eq('id', 1)
    return { connected: true, synced: true, events, busy }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Senkronizasyon hatası'
    await sb.from('google_integration').update({ last_error: msg, sync_lock_until: null }).eq('id', 1)
    return { connected: true, synced: false, error: msg }
  }
}

/** Bağlantıyı kaldırırken Google tarafındaki izni de iptal et. */
export async function revoke(refreshToken: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => undefined)
}
