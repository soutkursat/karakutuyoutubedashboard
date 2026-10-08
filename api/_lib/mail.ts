/**
 * E-posta (Natro SMTP). İki gönderici hesabı:
 *  - SİSTEM  (SMTP_SYSTEM_USER, ör. sistem@karakutuyoutube.com): otomatik bildirimler
 *  - YÖNETİCİ (SMTP_ADMIN_USER, ör. kursat@karakutuyoutube.com): yöneticinin yazdığı e-postalar
 * Alıcılar her zaman veritabanından gelir (öğrenci id'si) → dışarıya açık bir gönderim kapısı yok.
 */
import nodemailer from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from './server.js'

export type Sender = 'system' | 'admin'
const BRAND = 'Kara Kutu YouTube Akademisi'
const TZ = 'Europe/Istanbul'

export function mailEnv() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const system = { user: process.env.SMTP_SYSTEM_USER, pass: process.env.SMTP_SYSTEM_PASS }
  const admin = { user: process.env.SMTP_ADMIN_USER, pass: process.env.SMTP_ADMIN_PASS }
  return {
    host,
    port,
    systemReady: !!host && !!system.user && !!system.pass,
    adminReady: !!host && !!admin.user && !!admin.pass,
    systemAddress: system.user ?? null,
    adminAddress: admin.user ?? null,
    system,
    admin,
  }
}

export function appUrl(request: Request) {
  return (process.env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '')
}

/** Tek bağlantı açıp birden çok e-posta göndermek için (Natro sınırlarına nazik) */
export function transport(sender: Sender) {
  const env = mailEnv()
  const cred = sender === 'admin' && env.adminReady ? env.admin : env.system
  const ready = sender === 'admin' ? env.adminReady || env.systemReady : env.systemReady
  if (!ready || !cred.user || !cred.pass) {
    throw new HttpError(400, 'E-posta ayarları eksik: Vercel’e SMTP_HOST, SMTP_SYSTEM_USER ve SMTP_SYSTEM_PASS ekleyip Redeploy et.')
  }
  const t = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: cred.user, pass: cred.pass },
    pool: true,
    maxConnections: 1,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  })
  return { t, from: cred.user, replyTo: env.adminAddress ?? cred.user }
}

/** SMTP hatasını yöneticiye anlaşılır Türkçe mesaja çevirir */
export function smtpMessage(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string }
  const m = err.message ?? String(e)
  if (err.code === 'EAUTH' || err.responseCode === 535) return 'E-posta hesabına giriş yapılamadı: Vercel’deki kullanıcı adı/şifreyi kontrol et.'
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNECTION' || err.code === 'ESOCKET' || err.code === 'ECONNREFUSED') {
    return 'E-posta sunucusuna bağlanılamadı: SMTP_HOST ve SMTP_PORT (465 ya da 587) değerlerini kontrol et.'
  }
  if (err.code === 'EENVELOPE') return 'Alıcı adresi geçersiz.'
  return `E-posta gönderilemedi: ${m}`
}

export async function logMail(
  sb: SupabaseClient,
  row: { appointment_id?: string | null; kind: string; to_email: string; from_email: string; subject: string; status: 'sent' | 'failed'; error?: string | null },
) {
  await sb.from('email_log').insert(row).then(() => undefined, () => undefined) // kayıt başarısız olsa da gönderimi bozma
}

// ---------------------------------------------------------------------------
// Şablonlar
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, ...o })
export const fDate = (iso: string) => fmt({ day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(new Date(iso))
export const fTime = (iso: string) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

interface Layout {
  preheader: string
  title: string
  greeting: string
  paragraphs: string[]
  rows?: [string, string][]
  note?: { label: string; text: string }
  cta?: { label: string; url: string }
  signature?: string
}

/** E-posta istemcileriyle uyumlu (tablo + satır içi stil), marka renklerinde HTML */
export function renderEmail(l: Layout): { html: string; text: string } {
  const rows = (l.rows ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 14px;color:#8b8b95;font-size:13px;border-top:1px solid #26262c;white-space:nowrap">${esc(k)}</td>` +
        `<td style="padding:10px 14px;color:#f6f6f7;font-size:14px;font-weight:600;border-top:1px solid #26262c">${v}</td></tr>`,
    )
    .join('')
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${esc(l.title)}</title></head>
<body style="margin:0;padding:0;background:#070708;font-family:Inter,Segoe UI,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(l.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070708"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:36px;height:36px;border-radius:10px;background:#e3122c;background-image:linear-gradient(180deg,#ff3a4f,#e3122c);text-align:center;color:#ffffff;font-size:15px;line-height:36px">&#9654;</td>
    <td style="padding-left:12px;color:#f6f6f7;font-weight:800;font-size:15px">${BRAND}</td>
  </tr></table>
</td></tr>
<tr><td style="background:#141418;border:1px solid #2a2a30;border-top:2px solid #ff2d46;border-radius:18px;padding:28px">
  <h1 style="margin:0 0 14px;color:#f6f6f7;font-size:22px;line-height:1.25">${esc(l.title)}</h1>
  <p style="margin:0 0 12px;color:#d4d4d8;font-size:15px;line-height:1.6">${esc(l.greeting)}</p>
  ${l.paragraphs.map((p) => `<p style="margin:0 0 12px;color:#d4d4d8;font-size:15px;line-height:1.6">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
  ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #26262c;border-radius:12px;background:#0e0e11">${rows}</table>` : ''}
  ${l.note ? `<div style="margin:16px 0;padding:12px 14px;border-left:3px solid #ff2d46;background:#0e0e11;border-radius:0 10px 10px 0;color:#d4d4d8;font-size:14px;line-height:1.6"><strong style="color:#f6f6f7">${esc(l.note.label)}:</strong> ${esc(l.note.text)}</div>` : ''}
  ${l.cta ? `<p style="margin:22px 0 4px"><a href="${esc(l.cta.url)}" style="display:inline-block;background:#e3122c;background-image:linear-gradient(180deg,#ff3a4f,#e3122c);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:12px">${esc(l.cta.label)}</a></p>` : ''}
  ${l.signature ? `<p style="margin:22px 0 0;color:#a3a3ad;font-size:14px;line-height:1.6">${esc(l.signature).replace(/\n/g, '<br>')}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 4px;color:#6e6e78;font-size:12px;line-height:1.6;text-align:center">
  Bu e-posta ${BRAND} mentörlük paneli üzerinden gönderildi.<br>Sorun için WhatsApp: +90 537 793 50 90
</td></tr>
</table></td></tr></table></body></html>`

  const strip = (s: string) => s.replace(/<[^>]+>/g, '')
  const text = [
    l.title,
    '',
    l.greeting,
    ...l.paragraphs,
    '',
    ...(l.rows ?? []).map(([k, v]) => `${k}: ${strip(v)}`),
    l.note ? `\n${l.note.label}: ${l.note.text}` : '',
    l.cta ? `\n${l.cta.label}: ${l.cta.url}` : '',
    l.signature ? `\n${l.signature}` : '',
    '',
    `— ${BRAND}`,
  ].join('\n')
  return { html, text }
}

export interface ApptForMail {
  code: string
  start_at: string
  end_at: string
  topic: string
  meet_link: string | null
  rescheduled_from: string | null
  reschedule_note: string | null
  cancel_reason: string | null
}

export type ApptMailKind = 'confirmed' | 'rescheduled' | 'cancelled'

export function appointmentEmail(kind: ApptMailKind, a: ApptForMail, name: string, base: string) {
  const first = name.split(' ')[0] || name
  const when = `${fDate(a.start_at)} · ${fTime(a.start_at)} – ${fTime(a.end_at)} (TR saati)`
  const meet = a.meet_link
    ? `<a href="${esc(a.meet_link)}" style="color:#ff6b7d">${esc(a.meet_link)}</a>`
    : 'Görüşme linki panelinde yer alacak.'
  const rows: [string, string][] = [
    ['Tarih', esc(fDate(a.start_at))],
    ['Saat', `${esc(fTime(a.start_at))} – ${esc(fTime(a.end_at))} (TR saati)`],
    ['Konu', esc(a.topic)],
    ['Randevu No', esc(a.code)],
  ]
  if (kind === 'confirmed') {
    return {
      subject: `Randevun onaylandı · ${fDate(a.start_at)} ${fTime(a.start_at)}`,
      ...renderEmail({
        preheader: `Mentörlük randevun onaylandı: ${when}`,
        title: 'Randevun onaylandı',
        greeting: `Merhaba ${first},`,
        paragraphs: ['Mentörlük randevun onaylandı. Görüşme Google Meet üzerinden yapılacak.'],
        rows: [...rows, ['Google Meet', meet]],
        cta: { label: 'Randevularımı gör', url: `${base}/panel/randevularim` },
      }),
    }
  }
  if (kind === 'rescheduled') {
    return {
      subject: `Randevun yeni bir saate taşındı · ${fDate(a.start_at)} ${fTime(a.start_at)}`,
      ...renderEmail({
        preheader: `Yeni randevu saatin: ${when}`,
        title: 'Randevun yeni bir saate taşındı',
        greeting: `Merhaba ${first},`,
        paragraphs: [
          a.rescheduled_from
            ? `${fDate(a.rescheduled_from)} ${fTime(a.rescheduled_from)} tarihindeki randevun mentörün tarafından aşağıdaki yeni saate taşındı.`
            : 'Randevun mentörün tarafından aşağıdaki yeni saate taşındı.',
          'Yeni saat sana uymuyorsa WhatsApp’tan bize yazman yeterli.',
        ],
        rows: [...rows, ['Google Meet', meet]],
        note: a.reschedule_note ? { label: 'Mentörünün notu', text: a.reschedule_note } : undefined,
        cta: { label: 'Randevularımı gör', url: `${base}/panel/randevularim` },
      }),
    }
  }
  return {
    subject: `Randevun iptal edildi · ${fDate(a.start_at)} ${fTime(a.start_at)}`,
    ...renderEmail({
      preheader: `Mentörlük randevun iptal edildi: ${when}`,
      title: 'Randevun iptal edildi',
      greeting: `Merhaba ${first},`,
      paragraphs: ['Aşağıdaki mentörlük randevun iptal edildi. Panelden uygun başka bir saat seçebilirsin.'],
      rows,
      note: a.cancel_reason ? { label: 'Sebep', text: a.cancel_reason } : undefined,
      cta: { label: 'Yeni randevu al', url: `${base}/panel/randevu-al` },
    }),
  }
}
