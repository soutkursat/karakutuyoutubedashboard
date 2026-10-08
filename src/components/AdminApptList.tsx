import { useEffect, useState } from 'react'
import { ApptCard } from './ApptCard'
import { Field, Switch } from './Common'
import { IconBan, IconCheck, IconClock, IconLink, IconVideo, IconWhatsapp } from './Icons'
import { Modal } from './Modal'
import { RescheduleModal, type RescheduleChoice } from './RescheduleModal'
import { useToast } from './Toast'
import { getMailStatus, getSettings, getUser, loadMailStatus, notifyByEmail, rescheduleAppointment, sendReschedulePopup, setAppointmentStatus, setMeetLink, type ApptMailKind } from '../lib/db'
import { formatDateLong, formatTime } from '../lib/time'
import type { Appointment } from '../lib/types'
import { errMsg } from '../lib/ui'
import { formatPhone } from '../lib/validation'
import { openWhatsapp, toStudentMessage, waLink } from '../lib/whatsapp'

export function AdminApptList({ list, now }: { list: Appointment[]; now: number }) {
  const toast = useToast()
  const [meetFor, setMeetFor] = useState<Appointment | null>(null)
  const [link, setLink] = useState('')
  const [cancelFor, setCancelFor] = useState<Appointment | null>(null)
  const [reason, setReason] = useState('')
  const [cancelMail, setCancelMail] = useState(true)
  const [reschedFor, setReschedFor] = useState<Appointment | null>(null)

  // Pencerelerde "e-posta ayarları yapılmamış" uyarısı için (bir kez yeterli)
  useEffect(() => {
    if (!getMailStatus()) void loadMailStatus()
  }, [])

  const [busy, setBusy] = useState(false)
  /**
   * Sunucu işlemini çalıştır; aynı anda ikinci tıklamayı engelle. Başarılıysa true döner.
   * mail verilirse işlemden sonra öğrenciye e-posta gider (force=false → Ayarlar'daki otomatik e-posta seçeneğine uyar).
   * E-posta hatası işlemi geri almaz; sadece ayrıca bildirilir.
   */
  const run = async (fn: () => Promise<unknown>, ok: string, mail?: { id: string; kind: ApptMailKind; force?: boolean }) => {
    if (busy) return false
    setBusy(true)
    try {
      await fn()
      toast(ok)
    } catch (e) {
      toast(errMsg(e), 'error')
      return false
    } finally {
      setBusy(false)
    }
    // E-posta arka planda gider (Meet linki için birkaç saniye sürebilir); pencere beklemez
    if (mail) {
      notifyByEmail(mail.id, mail.kind, mail.force).then(
        (r) => r.info && toast(r.info, r.sent ? 'success' : 'info'),
        (e) => toast(`E-posta gönderilemedi: ${errMsg(e)}`, 'error'),
      )
    }
    return true
  }

  const openCancel = (a: Appointment) => {
    setCancelFor(a)
    setReason('')
    setCancelMail(getSettings().autoEmails)
  }

  const doReschedule = async (a: Appointment, c: RescheduleChoice) => {
    const ok = await run(
      () => rescheduleAppointment(a.id, c.startIso, c.note),
      `Randevu ${formatTime(c.startIso)} saatine ertelendi`,
      c.sendEmail ? { id: a.id, kind: 'rescheduled', force: true } : undefined,
    )
    if (!ok) return
    setReschedFor(null)
    if (c.sendPopup) {
      sendReschedulePopup(a, c.startIso, c.note).catch((e) => toast(`Öğrenciye pop-up gönderilemedi: ${errMsg(e)}`, 'error'))
    }
  }

  return (
    <>
      <div className="appt-list">
        {list.map((a) => {
          const s = getUser(a.studentId)
          const past = new Date(a.end).getTime() <= now
          const active = a.status === 'pending' || a.status === 'confirmed'
          return (
            <ApptCard
              key={a.id}
              a={a}
              now={now}
              title={s?.name ?? 'Silinmiş öğrenci'}
              meta={
                <>
                  <p className="appt-sub">
                    <span className="chip static sm">{a.topic}</span>
                    {s && <span className="muted">{s.phone ? `${formatPhone(s.phone)} · ` : ''}{s.email}</span>}
                    {a.whatsappNotifiedAt ? (
                      <span className="tag tag-wa"><IconWhatsapp size={12} /> Bildirildi</span>
                    ) : (
                      active && <span className="tag">WA bildirimi yok</span>
                    )}
                  </p>
                  {a.note && <p className="appt-note">“{a.note}”</p>}
                  {a.meetLink && active && (
                    <p className="appt-sub">
                      <IconVideo size={14} /> <a href={a.meetLink} target="_blank" rel="noopener noreferrer" className="link">{a.meetLink}</a>
                    </p>
                  )}
                  {a.rescheduledFrom && active && (
                    <p className="appt-note">
                      Ertelendi · önceki saat: {formatDateLong(a.rescheduledFrom)} {formatTime(a.rescheduledFrom)}
                      {a.rescheduleNote ? ` · “${a.rescheduleNote}”` : ''}
                    </p>
                  )}
                  {a.cancelReason && <p className="appt-note">İptal ({a.cancelledBy === 'admin' ? 'yönetici' : 'öğrenci'}): {a.cancelReason}</p>}
                </>
              }
              actions={
                <>
                  {a.status === 'pending' && (
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => setAppointmentStatus(a.id, 'confirmed'), 'Randevu onaylandı', { id: a.id, kind: 'confirmed' })}>
                      <IconCheck size={16} /> Onayla
                    </button>
                  )}
                  {active && !past && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setReschedFor(a)}>
                      <IconClock size={16} /> Ertele
                    </button>
                  )}
                  {active && !past && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setMeetFor(a); setLink(a.meetLink ?? '') }}>
                      <IconLink size={16} /> {a.meetLink ? 'Meet linki' : 'Meet linki ekle'}
                    </button>
                  )}
                  {active && past && (
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => setAppointmentStatus(a.id, 'completed'), 'Tamamlandı olarak işaretlendi')}>
                      <IconCheck size={16} /> Tamamlandı
                    </button>
                  )}
                  {s && (
                    <button className="btn btn-wa btn-sm" onClick={() => openWhatsapp(waLink(s.phone, toStudentMessage(a, s)))}>
                      <IconWhatsapp size={16} /> Öğrenciye yaz
                    </button>
                  )}
                  {active && (
                    <button className="btn btn-text btn-sm danger" onClick={() => openCancel(a)}>
                      <IconBan size={16} /> İptal
                    </button>
                  )}
                  {a.status === 'cancelled' && !past && (
                    <button className="btn btn-text btn-sm" disabled={busy} onClick={() => run(() => setAppointmentStatus(a.id, 'confirmed'), 'Randevu geri açıldı', { id: a.id, kind: 'confirmed' })}>
                      Geri al
                    </button>
                  )}
                </>
              }
            />
          )
        })}
      </div>

      <Modal
        open={!!meetFor}
        onClose={() => setMeetFor(null)}
        title="Google Meet linki"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setMeetFor(null)}>Vazgeç</button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                if (!meetFor) return
                const confirms = meetFor.status === 'pending' && !!link.trim()
                const ok = await run(
                  async () => {
                    await setMeetLink(meetFor.id, link)
                    if (confirms) await setAppointmentStatus(meetFor.id, 'confirmed')
                  },
                  confirms ? 'Meet linki kaydedildi, randevu onaylandı' : 'Meet linki kaydedildi',
                  confirms ? { id: meetFor.id, kind: 'confirmed' } : undefined,
                )
                if (ok) setMeetFor(null)
              }}
            >
              Kaydet
            </button>
          </>
        }
      >
        <p className="muted">
          Yeni bir toplantı oluşturmak için{' '}
          <a className="link" href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer">meet.google.com/new</a>{' '}
          adresini aç, linki kopyalayıp buraya yapıştır. Bekleyen randevu otomatik onaylanır.
        </p>
        <Field label="Meet linki">
          <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" autoFocus />
        </Field>
      </Modal>

      <Modal
        open={!!cancelFor}
        onClose={() => setCancelFor(null)}
        title="Randevuyu iptal et"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCancelFor(null)}>Vazgeç</button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                if (!cancelFor) return
                const ok = await run(
                  () => setAppointmentStatus(cancelFor.id, 'cancelled', reason),
                  'Randevu iptal edildi',
                  cancelMail ? { id: cancelFor.id, kind: 'cancelled', force: true } : undefined,
                )
                if (ok) setCancelFor(null)
              }}
            >
              İptal et
            </button>
          </>
        }
      >
        {cancelFor && new Date(cancelFor.end).getTime() > now && (
          <div className="notice resched-hint">
            <span>İptal etmek yerine randevuyu başka bir güne ya da saate taşıyabilirsin.</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setReschedFor(cancelFor)
                setCancelFor(null)
              }}
            >
              <IconClock size={16} /> Bunun yerine ertele
            </button>
          </div>
        )}
        <Field label="Sebep (öğrenci görür)">
          <textarea className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <label className="toggle-row">
          <div>
            <strong>Öğrenciye e-posta gönder</strong>
            <p className="muted">
              {getMailStatus() && !getMailStatus()?.systemReady ? 'E-posta ayarları yapılmamış (Ayarlar → E-posta).' : 'İptal bilgisi ve sebep e-postayla gider.'}
            </p>
          </div>
          <Switch checked={cancelMail} label="Öğrenciye e-posta gönder" onChange={setCancelMail} />
        </label>
        <p className="muted small-text">İstersen “Öğrenciye yaz” ile WhatsApp’tan da bilgilendirebilirsin.</p>
      </Modal>

      {reschedFor && <RescheduleModal key={reschedFor.id} appt={reschedFor} busy={busy} onClose={() => setReschedFor(null)} onSubmit={doReschedule} />}
    </>
  )
}
