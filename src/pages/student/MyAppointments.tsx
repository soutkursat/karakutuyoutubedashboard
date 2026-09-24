import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApptCard } from '../../components/ApptCard'
import { Empty, Field, PageHeader } from '../../components/Common'
import { IconCalendar, IconCalendarPlus, IconVideo, IconWhatsapp, IconX } from '../../components/Icons'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { canStudentCancel, cancelByStudent, currentUser, getAppointments, getSettings, markWhatsappNotified } from '../../lib/db'
import { useDataVersion, useNow } from '../../lib/hooks'
import type { Appointment } from '../../lib/types'
import { cx, errMsg } from '../../lib/ui'
import { cancelMessage, newBookingMessage, openWhatsapp, waLink } from '../../lib/whatsapp'

type Tab = 'upcoming' | 'past' | 'cancelled'

export function MyAppointments() {
  useDataVersion()
  const now = useNow()
  const toast = useToast()
  const user = currentUser()!
  const settings = getSettings()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [reason, setReason] = useState('')
  const [cancelled, setCancelled] = useState<Appointment | null>(null)

  const mine = getAppointments().filter((a) => a.studentId === user.id)
  const isActive = (a: Appointment) => a.status === 'pending' || a.status === 'confirmed'
  const lists: Record<Tab, Appointment[]> = {
    upcoming: mine.filter((a) => isActive(a) && new Date(a.end).getTime() > now).sort((a, b) => a.start.localeCompare(b.start)),
    past: mine.filter((a) => a.status === 'completed' || (isActive(a) && new Date(a.end).getTime() <= now)).sort((a, b) => b.start.localeCompare(a.start)),
    cancelled: mine.filter((a) => a.status === 'cancelled').sort((a, b) => b.start.localeCompare(a.start)),
  }
  const list = lists[tab]

  const confirmCancel = () => {
    if (!cancelling) return
    try {
      const a = cancelByStudent(user.id, cancelling.id, reason)
      setCancelling(null)
      setReason('')
      setCancelled(a)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Takvim"
        title="Randevularım"
        actions={
          <Link to="/panel/randevu-al" className="btn btn-primary">
            <IconCalendarPlus size={18} /> Yeni randevu
          </Link>
        }
      />
      <div className="seg">
        {(['upcoming', 'past', 'cancelled'] as Tab[]).map((t) => (
          <button key={t} className={cx('seg-btn', tab === t && 'active')} onClick={() => setTab(t)}>
            {t === 'upcoming' ? 'Yaklaşan' : t === 'past' ? 'Geçmiş' : 'İptal'} <em>{lists[t].length}</em>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card glass">
          <Empty
            icon={<IconCalendar />}
            title={tab === 'upcoming' ? 'Yaklaşan randevun yok' : 'Burada henüz bir şey yok'}
            action={tab === 'upcoming' && <Link className="btn btn-primary" to="/panel/randevu-al">Randevu al</Link>}
          />
        </div>
      ) : (
        <div className="appt-list">
          {list.map((a) => (
            <ApptCard
              key={a.id}
              a={a}
              now={now}
              meta={a.cancelReason && <p className="appt-note">Sebep: {a.cancelReason}</p>}
              actions={
                tab === 'upcoming' && (
                  <>
                    {a.status === 'confirmed' && a.meetLink && (
                      <a className="btn btn-primary btn-sm" href={a.meetLink} target="_blank" rel="noopener noreferrer">
                        <IconVideo size={16} /> Meet’e katıl
                      </a>
                    )}
                    <button
                      className={cx('btn btn-sm', a.whatsappNotifiedAt ? 'btn-ghost' : 'btn-wa')}
                      onClick={() => {
                        openWhatsapp(waLink(settings.whatsappNumber, newBookingMessage(a, user)))
                        markWhatsappNotified(a.id)
                      }}
                    >
                      <IconWhatsapp size={16} /> {a.whatsappNotifiedAt ? 'Tekrar bildir' : 'WhatsApp’tan bildir'}
                    </button>
                    {canStudentCancel(a, now) ? (
                      <button className="btn btn-text btn-sm danger" onClick={() => setCancelling(a)}>
                        <IconX size={16} /> İptal et
                      </button>
                    ) : (
                      <span className="fine">İptal için {settings.cancelLimitHours} saatten az kaldı</span>
                    )}
                  </>
                )
              }
            />
          ))}
        </div>
      )}

      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Randevuyu iptal et"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCancelling(null)}>Vazgeç</button>
            <button className="btn btn-danger" onClick={confirmCancel}>İptal et</button>
          </>
        }
      >
        <p className="muted">Bu işlem geri alınamaz. Saat tekrar diğer öğrencilere açılacak.</p>
        <Field label="İptal sebebi (isteğe bağlı)">
          <textarea className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>

      <Modal open={!!cancelled} onClose={() => setCancelled(null)} title="Randevu iptal edildi" size="sm">
        <p className="muted">İptal bilgisini WhatsApp’tan bize de iletmek ister misin?</p>
        <button
          className="btn btn-wa btn-block"
          onClick={() => {
            if (cancelled) openWhatsapp(waLink(settings.whatsappNumber, cancelMessage(cancelled, user)))
            setCancelled(null)
          }}
        >
          <IconWhatsapp size={18} /> WhatsApp’tan bildir
        </button>
      </Modal>
    </>
  )
}
