/**
 * Google Takvim entegrasyonu (sunucu tarafı).
 * - Mentörün Google hesabı bir kez bağlanır (OAuth), refresh_token veritabanında saklanır.
 * - sync(): randevuları Google Takvime işler (otomatik Meet linkiyle). Takvimdeki dolu saatler OKUNMAZ.
 * Harici kütüphane yok; Google REST API'si doğrudan fetch ile çağrılıyor.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { mailEnv, renderEmail, transport } from './mail.js'
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
  refresh_expires_at?: string | null
}

/** Veritabanı hatasını kurulum yapan kişiye anlaşılır, ama gerçek sebebi gizlemeyen bir mesaja çevirir. */
export function dbSetupMessage(error: { message?: string; code?: string }, table: string): string {
  const m = error.message ?? ''
  if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(m)) {
    return `Veritabanında "${table}" tablosu yok. Supabase → SQL Editor'de supabase/schema.sql dosyasının TAMAMINI yapıştırıp Run'a bas ve altta kırmızı hata çıkmadığından emin ol.`
  }
  if (error.code === '42501' || /permission denied/i.test(m)) {
    return 'Sunucu anahtarı yetkisiz: Vercel’deki SUPABASE_SERVICE_ROLE_KEY değerinin "service_role" (secret) anahtar olduğundan emin ol, sonra Redeploy et.'
  }
  return `Veritabanı hatası (${error.code ?? '?'}): ${m}`
}

export async function getIntegration(sb: SupabaseClient): Promise<Integration> {
  const { data, error } = await sb.from('google_integration').select('*').eq('id', 1).maybeSingle()
  if (error) throw new HttpError(500, dbSetupMessage(error, 'google_integration'))
  return (data ?? { email: null, refresh_token: null, connected_at: null, last_synced_at: null, last_error: null }) as Integration
}

/** Google Cloud'da yapılacaklar (bağlantı koptuğunda yöneticiye gösterilir) */
export const TESTING_FIX =
  'Google Cloud Console → Google Auth Platform → Audience → "Publish app" ile uygulamayı "In production" yap, sonra panelden Google hesabını TEKRAR bağla (yayınlamadan önce alınan bağlantı yine 7 günde kopar).'

/** Bağlantı neden koptu: Google'ın cevabı + bağlantının yaşı → yöneticiye anlaşılır açıklama */
function disconnectReason(integ: Integration, googleMsg: string) {
  const days = integ.connected_at ? (Date.now() - new Date(integ.connected_at).getTime()) / 86400_000 : null
  const when = new Date().toLocaleString('tr-TR', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' })
  const testing = !!integ.refresh_expires_at || (days !== null && days >= 6.5 && days <= 7.6)
  const why = testing
    ? `Google uygulaman "Testing" modunda olduğu için Google bağlantıyı ${days ? Math.round(days) + ' gün sonra' : '7 günde bir'} otomatik kopardı. ${TESTING_FIX}`
    : 'Google izni geri alınmış ya da Google hesabında güvenlik değişikliği olmuş olabilir (myaccount.google.com → Güvenlik → Üçüncü taraf erişimi). Panelden tekrar bağla.'
  return `Google Takvim bağlantısı ${when} tarihinde koptu (Google: ${googleMsg}). ${why}`
}

/** Bağlantı koptuğunda yöneticiye e-posta (e-posta ayarlıysa). Hata olsa da senkronu bozmaz. */
async function mailAdminsAboutDisconnect(sb: SupabaseClient, reason: string) {
  try {
    if (!mailEnv().systemReady) return
    const { data: admins } = await sb.from('profiles').select('email,name').eq('role', 'admin').eq('status', 'active')
    const base = (process.env.APP_URL || '').replace(/\/+$/, '')
    const { t, from } = transport('system')
    try {
      for (const a of admins ?? []) {
        if (!a.email) continue
        const mail = renderEmail({
          preheader: 'Yeni randevulara otomatik Meet linki oluşturulmuyor.',
          title: 'Google Takvim bağlantısı koptu',
          greeting: `Merhaba ${String(a.name).split(' ')[0]},`,
          paragraphs: [reason, 'Tekrar bağladığında, bu arada oluşturulan randevuların Meet linkleri de otomatik oluşturulur.'],
          cta: base ? { label: 'Google hesabını tekrar bağla', url: `${base}/yonetim/musaitlik` } : undefined,
        })
        await t.sendMail({ from: `"Kara Kutu Panel" <${from}>`, to: a.email, subject: 'Google Takvim bağlantısı koptu', html: mail.html, text: mail.text })
      }
    } finally {
      t.close()
    }
  } catch (e) {
    console.error('Kopma e-postası gönderilemedi', e)
  }
}

async function accessToken(sb: SupabaseClient, integ: Integration): Promise<string> {
  const { clientId, clientSecret } = googleEnv()
  if (!clientId || !clientSecret) throw new HttpError(500, 'Google ayarları eksik (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: integ.refresh_token!, grant_type: 'refresh_token' }),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !body.access_token) {
    if (body.error === 'invalid_grant') {
      // Anahtar kalıcı olarak geçersiz (süresi dolmuş / izin geri alınmış) → bağlantıyı düşür, sebebini kaydet, yöneticiye haber ver
      const reason = disconnectReason(integ, body.error_description || 'invalid_grant')
      await sb.from('google_integration').update({ refresh_token: null, last_error: reason }).eq('id', 1)
      await mailAdminsAboutDisconnect(sb, reason)
      throw new HttpError(400, reason)
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
    summary: `${confirmed ? '' : '[Onay bekliyor] '}Kara Kutu YouTube Akademisi · ${name}`,
    description: [
      `Konu: ${a.topic}`,
      a.note ? `Not: ${a.note}` : '',
      '',
      `Öğrenci: ${name}`,
      s?.phone ? `Telefon: +${s.phone}` : '',
      s?.email ? `E-posta: ${s.email}` : '',
      `Randevu No: ${a.code}`,
      '',
      'Bu etkinlik Kara Kutu YouTube Akademisi randevu panelinden otomatik oluşturuldu.',
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

/**
 * Müsaitlik SADECE paneldeki haftalık programdan gelir (kullanıcı tercihi).
 * Google Takvimdeki diğer etkinlikler okunmaz; eski sürümden kalan kayıt varsa temizlenir.
 */
async function clearExternalBusy(sb: SupabaseClient) {
  const { error } = await sb.rpc('replace_external_busy', { p_rows: [] })
  if (error) throw new Error(error.message)
}

export interface SyncResult {
  connected: boolean
  synced: boolean
  events?: number
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
    const token = await accessToken(sb, integ)
    const events = await reconcileAppointments(sb, token)
    await clearExternalBusy(sb)
    await sb.from('google_integration').update({ last_synced_at: new Date().toISOString(), last_error: null, sync_lock_until: null }).eq('id', 1)
    return { connected: true, synced: true, events }
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
