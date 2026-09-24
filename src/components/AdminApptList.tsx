import { useState } from 'react'
import { ApptCard } from './ApptCard'
import { Field } from './Common'
import { IconBan, IconCheck, IconLink, IconVideo, IconWhatsapp } from './Icons'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { getUser, setAppointmentStatus, setMeetLink } from '../lib/db'
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

  const [busy, setBusy] = useState(false)
  /** Sunucu işlemini çalıştır; aynı anda ikinci tıklamayı engelle. Başarılıysa true döner. */
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return false
    setBusy(true)
    try {
      await fn()
      toast(ok)
      return true
    } catch (e) {
      toast(errMsg(e), 'error')
      return false
    } finally {
      setBusy(false)
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
                    {s && <span className="muted">{formatPhone(s.phone)} · {s.email}</span>}
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
                  {a.cancelReason && <p className="appt-note">İptal ({a.cancelledBy === 'admin' ? 'yönetici' : 'öğrenci'}): {a.cancelReason}</p>}
                </>
              }
              actions={
                <>
                  {a.status === 'pending' && (
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => setAppointmentStatus(a.id, 'confirmed'), 'Randevu onaylandı')}>
                      <IconCheck size={16} /> Onayla
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
                    <button className="btn btn-text btn-sm danger" onClick={() => { setCancelFor(a); setReason('') }}>
                      <IconBan size={16} /> İptal
                    </button>
                  )}
                  {a.status === 'cancelled' && !past && (
                    <button className="btn btn-text btn-sm" disabled={busy} onClick={() => run(() => setAppointmentStatus(a.id, 'confirmed'), 'Randevu geri açıldı')}>
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
                const ok = await run(async () => {
                  await setMeetLink(meetFor.id, link)
                  if (meetFor.status === 'pending' && link.trim()) await setAppointmentStatus(meetFor.id, 'confirmed')
                }, 'Meet linki kaydedildi')
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
                const ok = await run(() => setAppointmentStatus(cancelFor.id, 'cancelled', reason), 'Randevu iptal edildi')
                if (ok) setCancelFor(null)
              }}
            >
              İptal et
            </button>
          </>
        }
      >
        <p className="muted">İptal sonrası “Öğrenciye yaz” ile öğrenciyi WhatsApp’tan bilgilendirebilirsin.</p>
        <Field label="Sebep (öğrenci görür)">
          <textarea className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  )
}
