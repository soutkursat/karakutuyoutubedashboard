/**
 * POST /api/mail — sadece yönetici.
 *  { action: 'status' }                                   → SMTP ayarları hazır mı
 *  { action: 'test' }                                     → yöneticinin kendi e-postasına deneme
 *  { action: 'appointment', id, kind }                    → randevu bildirimi (sistem@ adresinden)
 *  { action: 'custom', studentIds[], subject, body }      → yöneticinin yazdığı e-posta (kursat@ adresinden)
 */
import { appointmentEmail, appUrl, logMail, mailEnv, oneLine, renderEmail, smtpMessage, transport, type ApptForMail, type ApptMailKind } from './_lib/mail.js'
import { sync } from './_lib/google.js'
import { HttpError, handle, json, requireUser } from './_lib/server.js'

const UUID_RE = /^[0-9a-f-]{36}$/i
const MAX_PER_CALL = 20 // Vercel fonksiyonu kısa sürmeli; istemci büyük listeleri parçalara böler

export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const { sb, userId } = await requireUser(request, { admin: true })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const env = mailEnv()

    switch (body.action) {
      case 'status':
        return json({
          systemReady: env.systemReady,
          adminReady: env.adminReady,
          systemAddress: env.systemAddress,
          adminAddress: env.adminAddress,
          host: env.host ?? null,
          port: env.port,
        })

      case 'test': {
        const { data: me } = await sb.from('profiles').select('email,name').eq('id', userId).single()
        if (!me?.email) throw new HttpError(400, 'Yönetici hesabında e-posta yok.')
        const results: { from: string; ok: boolean; error?: string }[] = []
        for (const sender of ['system', 'admin'] as const) {
          if (sender === 'system' ? !env.systemReady : !env.adminReady) continue
          const { t, from, replyTo } = transport(sender)
          const mail = renderEmail({
            preheader: 'E-posta ayarların çalışıyor.',
            title: 'Test e-postası',
            greeting: `Merhaba ${me.name},`,
            paragraphs: [`Bu e-posta ${from} adresinden gönderildi. Bunu görüyorsan e-posta ayarların doğru çalışıyor.`],
          })
          try {
            await t.sendMail({ from: `"Kara Kutu YouTube Akademisi" <${from}>`, replyTo, to: me.email, subject: 'Test e-postası · Kara Kutu Panel', html: mail.html, text: mail.text })
            results.push({ from, ok: true })
            await logMail(sb, { kind: 'test', to_email: me.email, from_email: from, subject: 'Test e-postası', status: 'sent' })
          } catch (e) {
            results.push({ from, ok: false, error: smtpMessage(e) })
            await logMail(sb, { kind: 'test', to_email: me.email, from_email: from, subject: 'Test e-postası', status: 'failed', error: smtpMessage(e) })
          } finally {
            t.close()
          }
        }
        if (!results.length) throw new HttpError(400, 'E-posta ayarları eksik: Vercel’e SMTP bilgilerini ekleyip Redeploy et.')
        return json({ to: me.email, results })
      }

      case 'appointment': {
        const id = String(body.id ?? '')
        const kind = body.kind as ApptMailKind
        if (!UUID_RE.test(id) || !['confirmed', 'rescheduled', 'cancelled'].includes(kind)) throw new HttpError(400, 'Geçersiz istek.')
        if (!env.systemReady) return json({ sent: false, reason: 'not_configured' })
        const read = async () =>
          (
            await sb
              .from('appointments')
              .select('code,start_at,end_at,topic,meet_link,rescheduled_from,reschedule_note,cancel_reason,student_id')
              .eq('id', id)
              .maybeSingle()
          ).data
        let a = await read()
        if (!a) throw new HttpError(404, 'Randevu bulunamadı.')
        // Meet linki Google senkronunda oluşur: e-postada olsun diye kısa süre bekle (en fazla birkaç sn)
        for (let i = 0; kind !== 'cancelled' && !a.meet_link && i < 2; i++) {
          const r = await sync(sb, true).catch(() => ({ connected: false }))
          if (!r.connected) break
          a = (await read()) ?? a
          if (!a.meet_link && i < 1) await new Promise((ok) => setTimeout(ok, 1500))
        }
        const { data: st } = await sb.from('profiles').select('name,email').eq('id', a.student_id).maybeSingle()
        if (!st?.email) return json({ sent: false, reason: 'no_email' })
        const mail = appointmentEmail(kind, a as ApptForMail, st.name, appUrl(request))
        const { t, from, replyTo } = transport('system')
        try {
          await t.sendMail({ from: `"Kara Kutu YouTube Akademisi" <${from}>`, replyTo, to: st.email, subject: mail.subject, html: mail.html, text: mail.text })
          await logMail(sb, { appointment_id: id, kind, to_email: st.email, from_email: from, subject: mail.subject, status: 'sent' })
          return json({ sent: true, to: st.email })
        } catch (e) {
          const msg = smtpMessage(e)
          await logMail(sb, { appointment_id: id, kind, to_email: st.email, from_email: from, subject: mail.subject, status: 'failed', error: msg })
          throw new HttpError(502, msg)
        } finally {
          t.close()
        }
      }

      case 'custom': {
        const ids = Array.isArray(body.studentIds) ? (body.studentIds as unknown[]).map(String).filter((x) => UUID_RE.test(x)) : []
        const subject = oneLine(String(body.subject ?? '')).slice(0, 150)
        const text = String(body.body ?? '').trim().slice(0, 5000)
        if (!ids.length) throw new HttpError(400, 'Alıcı seçilmedi.')
        if (ids.length > MAX_PER_CALL) throw new HttpError(400, `Tek seferde en fazla ${MAX_PER_CALL} alıcı.`)
        if (!subject) throw new HttpError(400, 'Konu boş olamaz.')
        if (!text) throw new HttpError(400, 'Mesaj boş olamaz.')
        const [{ data: me }, { data: students }] = await Promise.all([
          sb.from('profiles').select('name').eq('id', userId).single(),
          sb.from('profiles').select('id,name,email,status').in('id', ids).eq('role', 'student'),
        ])
        const { t, from, replyTo } = transport('admin')
        const sent: string[] = []
        const failed: { id: string; error: string }[] = []
        try {
          for (const s of students ?? []) {
            if (!s.email || s.status !== 'active') {
              failed.push({ id: s.id, error: 'E-posta yok ya da hesap askıda' })
              continue
            }
            const first = String(s.name).split(' ')[0] || s.name
            const mail = renderEmail({
              preheader: text.slice(0, 120),
              title: subject,
              greeting: `Merhaba ${first},`,
              paragraphs: text.split(/\n{2,}/),
              cta: { label: 'Panele git', url: `${appUrl(request)}/panel` },
              signature: `${me?.name ?? 'Kürşat'}\nKara Kutu YouTube Akademisi`,
            })
            try {
              // Her öğrenciye AYRI e-posta (alıcılar birbirini görmez)
              await t.sendMail({ from: `"${oneLine(me?.name ?? 'Kürşat')} · Kara Kutu" <${from}>`, replyTo: from, to: s.email, subject, html: mail.html, text: mail.text })
              sent.push(s.id)
              await logMail(sb, { kind: 'custom', to_email: s.email, from_email: from, subject, status: 'sent' })
            } catch (e) {
              const msg = smtpMessage(e)
              failed.push({ id: s.id, error: msg })
              await logMail(sb, { kind: 'custom', to_email: s.email, from_email: from, subject, status: 'failed', error: msg })
              if (/giriş yapılamadı|bağlanılamadı/.test(msg)) break // ayar hatası: diğerlerini boşuna deneme
            }
          }
        } finally {
          t.close()
        }
        return json({ sent: sent.length, failed })
      }

      default:
        throw new HttpError(400, 'Bilinmeyen işlem.')
    }
  })
}
