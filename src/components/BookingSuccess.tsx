import { Modal } from './Modal'
import { IconCheck, IconWhatsapp } from './Icons'
import { getSettings, getUser, markWhatsappNotified } from '../lib/db'
import type { Appointment } from '../lib/types'
import { formatDateLong, formatTime } from '../lib/time'
import { newBookingMessage, openWhatsapp, waLink } from '../lib/whatsapp'

/** Randevu oluşunca açılan pop-up: tek tuşla WhatsApp'tan mentöre bildirir. */
export function BookingSuccess({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  if (!appt) return null
  const student = getUser(appt.studentId)
  const notify = () => {
    if (!student) return
    openWhatsapp(waLink(getSettings().whatsappNumber, newBookingMessage(appt, student)))
    void markWhatsappNotified(appt.id)
    onClose()
  }
  return (
    <Modal open onClose={onClose} size="sm">
      <div className="success">
        <div className="success-ring">
          <IconCheck size={30} />
        </div>
        <h2>Randevun oluşturuldu!</h2>
        <p className="muted">
          {appt.status === 'confirmed' ? 'Randevun onaylandı.' : 'Randevun onay bekliyor.'} Son adım: WhatsApp’tan tek
          tuşla bize bildir, bilgiler hazır mesaj olarak gelsin.
        </p>
        <div className="success-info">
          <div><span>Tarih</span><strong>{formatDateLong(appt.start)}</strong></div>
          <div><span>Saat</span><strong>{formatTime(appt.start)} – {formatTime(appt.end)}</strong></div>
          <div><span>Konu</span><strong>{appt.topic}</strong></div>
          <div><span>Randevu No</span><strong className="mono">{appt.code}</strong></div>
        </div>
        <button className="btn btn-wa btn-lg btn-block" onClick={notify}>
          <IconWhatsapp size={20} /> WhatsApp’tan bildir
        </button>
        <button className="btn btn-text btn-block" onClick={onClose}>
          Daha sonra bildiririm
        </button>
      </div>
    </Modal>
  )
}
