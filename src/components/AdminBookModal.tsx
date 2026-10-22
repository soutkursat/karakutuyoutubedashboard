import { useState } from 'react'
import { Field, Switch } from './Common'
import { IconCalendarPlus } from './Icons'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { adminBookAppointment, getAppointments, getMailStatus, getSettings, getStudents, notifyByEmail, sendCreatedPopup } from '../lib/db'
import { clashes, freeStartsOn } from '../lib/slots'
import { addDays, dateKey, formatKeyLong, formatTime, isValidTime, toInstant } from '../lib/time'
import type { User } from '../lib/types'
import { cx, errMsg } from '../lib/ui'

/**
 * Yönetici öğrenci adına randevu oluşturur (onaylı başlar). Süreç öğrencinin aldığı randevuyla aynı ilerler:
 * Google Takvim + Meet linki, öğrenciye pop-up ve e-posta.
 * student verilmezse öğrenci listeden seçilir. Ebeveyn bunu açıkken çizer (form her açılışta sıfırlanır).
 */
export function AdminBookModal({ student, onClose }: { student?: User; onClose: () => void }) {
  const toast = useToast()
  const settings = getSettings()
  const mail = getMailStatus()
  const now = Date.now()
  const today = dateKey()
  const duration = settings.slotMinutes
  const students = getStudents()
    .filter((u) => u.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  const [studentId, setStudentId] = useState(student?.id ?? '')
  const [day, setDay] = useState(today)
  const [time, setTime] = useState('')
  const [topic, setTopic] = useState(settings.topics[0] ?? '')
  const [note, setNote] = useState('')
  const [sendPopup, setSendPopup] = useState(true)
  const [sendEmail, setSendEmail] = useState(settings.autoEmails)
  const [busy, setBusy] = useState(false)

  const appts = getAppointments()
  const free = day ? freeStartsOn(settings, day, appts, '', duration, now) : []
  const startMs = day && isValidTime(time) ? toInstant(day, time).getTime() : NaN
  const valid = Number.isFinite(startMs)
  const isPast = valid && startMs <= now
  const clash = valid && clashes(appts, '', startMs, startMs + duration * 60000)
  const offHours = valid && !free.includes(time) && !clash && !isPast
  const blocked = settings.blockedDates.includes(day)
  const quick = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(today, i))
  const canSave = !!studentId && !!topic && valid && !isPast && !clash

  const save = async () => {
    if (busy || !canSave) return
    setBusy(true)
    let created
    try {
      created = await adminBookAppointment(studentId, new Date(startMs).toISOString(), topic, note)
    } catch (e) {
      toast(errMsg(e), 'error')
      setBusy(false)
      return
    }
    setBusy(false)
    toast(`Randevu oluşturuldu · ${formatKeyLong(day)} ${time}`)
    onClose()
    // Bildirimler arka planda: hata randevuyu geri almaz, sadece ayrıca bildirilir
    if (sendPopup) sendCreatedPopup(created).catch((e) => toast(`Öğrenciye pop-up gönderilemedi: ${errMsg(e)}`, 'error'))
    if (sendEmail) {
      notifyByEmail(created.id, 'created', true).then(
        (r) => r.info && toast(r.info, r.sent ? 'success' : 'info'),
        (e) => toast(`E-posta gönderilemedi: ${errMsg(e)}`, 'error'),
      )
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="title-ic"><IconCalendarPlus size={18} /> Öğrenci için randevu oluştur</span>}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="btn btn-primary" disabled={busy || !canSave} onClick={save}>
            {busy ? 'Oluşturuluyor…' : canSave ? `${formatTime(new Date(startMs))} için oluştur` : 'Randevu oluştur'}
          </button>
        </>
      }
    >
      {student ? (
        <div className="resched-now">
          <span className="muted small-text">Öğrenci</span>
          <strong>{student.name}</strong>
          <span className="muted small-text">{student.email}</span>
        </div>
      ) : (
        <Field label="Öğrenci">
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Öğrenci seç…</option>
            {students.map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {u.email}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Gün">
        <input className="input" type="date" min={today} value={day} onChange={(e) => { setDay(e.target.value); setTime('') }} />
      </Field>
      <div className="day-pick resched-days">
        {quick.map((k) => (
          <button key={k} type="button" aria-pressed={k === day} className={cx('chip', k === day && 'active')} onClick={() => { setDay(k); setTime('') }}>
            {k === today ? 'Bugün' : formatKeyLong(k).split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {day && (
        <div className="field">
          <span className="field-label">
            {formatKeyLong(day)} için boş saatler{blocked && <span className="tag">Kapalı gün</span>}
          </span>
          {free.length ? (
            <div className="slot-grid resched-slots">
              {free.map((t) => (
                <button key={t} type="button" className={cx('slot', t === time && 'active')} onClick={() => setTime(t)}>
                  <strong>{t}</strong>
                  <span>{duration} dk</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small-text">Bu gün çalışma saatlerinde boş saat yok. Aşağıya istediğin saati yazabilirsin.</p>
          )}
        </div>
      )}

      <Field label="Ya da saati kendin yaz" hint="Çalışma saatleri dışında bir saat de seçebilirsin.">
        <input className="input" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>

      {isPast && <p className="notice notice-danger">Seçtiğin saat geçmişte.</p>}
      {clash && <p className="notice notice-danger">Bu saatte başka bir randevu var.</p>}
      {offHours && <p className="notice">Bu saat çalışma programının dışında; yine de oluşturabilirsin.</p>}

      <Field label="Görüşme konusu">
        <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {settings.topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Öğrenciye not (isteğe bağlı)">
        <textarea className="input" rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ör. Geçen görüşmede konuştuğumuz thumbnail'leri hazırla." />
      </Field>

      <label className="toggle-row">
        <div>
          <strong>Öğrenciye pop-up göster</strong>
          <p className="muted">Panele girdiğinde randevuyu bir kez görür.</p>
        </div>
        <Switch checked={sendPopup} label="Öğrenciye pop-up göster" onChange={setSendPopup} />
      </label>
      <label className="toggle-row">
        <div>
          <strong>Öğrenciye e-posta gönder</strong>
          <p className="muted">{mail && !mail.systemReady ? 'E-posta ayarları yapılmamış (Ayarlar → E-posta).' : 'Tarih, saat ve Meet linki sistem adresinden gider.'}</p>
        </div>
        <Switch checked={sendEmail} label="Öğrenciye e-posta gönder" onChange={setSendEmail} />
      </label>
      <p className="muted small-text">Randevu onaylı olarak oluşur; Google Takvim bağlıysa Meet linki otomatik oluşturulur.</p>
    </Modal>
  )
}
