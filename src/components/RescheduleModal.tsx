import { useState } from 'react'
import { Field, Switch } from './Common'
import { Modal } from './Modal'
import { getAppointments, getMailStatus, getSettings, getUser } from '../lib/db'
import { clashes, freeStartsOn } from '../lib/slots'
import { addDays, dateKey, formatDateLong, formatKeyLong, formatTime, isValidTime, toInstant } from '../lib/time'
import type { Appointment } from '../lib/types'
import { cx } from '../lib/ui'

export interface RescheduleChoice {
  startIso: string
  note: string
  sendEmail: boolean
  /** Öğrenciye kişiye özel pop-up (panele girince görür) */
  sendPopup: boolean
}

/**
 * Yönetici randevuyu yeni bir güne/saate taşır. Gün seçilir, o günün boş saatleri önerilir ya da saat elle yazılır.
 * Not: Ebeveyn bunu key={appt.id} ile çizer; böylece her açılışta form sıfırlanır.
 */
export function RescheduleModal({ appt, busy, onClose, onSubmit }: { appt: Appointment; busy: boolean; onClose: () => void; onSubmit: (a: Appointment, c: RescheduleChoice) => void }) {
  const settings = getSettings()
  const now = Date.now()
  const today = dateKey()
  const duration = Math.round((new Date(appt.end).getTime() - new Date(appt.start).getTime()) / 60000)
  const student = getUser(appt.studentId)
  const mail = getMailStatus()

  // Varsayılan gün: randevunun günü geçmişte değilse o gün, değilse bugün
  const [day, setDay] = useState(() => (dateKey(new Date(appt.start)) >= today ? dateKey(new Date(appt.start)) : today))
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [sendEmail, setSendEmail] = useState(settings.autoEmails)
  const [sendPopup, setSendPopup] = useState(true)

  const free = day ? freeStartsOn(settings, day, getAppointments(), appt.id, duration, now) : []
  const startMs = day && isValidTime(time) ? toInstant(day, time).getTime() : NaN
  const valid = Number.isFinite(startMs)
  const isPast = valid && startMs <= now
  const same = valid && startMs === new Date(appt.start).getTime()
  const clash = valid && clashes(getAppointments(), appt.id, startMs, startMs + duration * 60000)
  const offHours = valid && !free.includes(time) && !clash && !isPast
  const blocked = settings.blockedDates.includes(day)

  const quick = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(today, i))

  const canSave = valid && !isPast && !clash && !same

  return (
    <Modal
      open
      onClose={onClose}
      title="Randevuyu ertele"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
          <button
            className="btn btn-primary"
            disabled={busy || !canSave}
            onClick={() => onSubmit(appt, { startIso: new Date(startMs).toISOString(), note, sendEmail, sendPopup })}
          >
            {busy ? 'Kaydediliyor…' : canSave ? `${formatTime(new Date(startMs))} saatine ertele` : 'Ertele'}
          </button>
        </>
      }
    >
      <div className="resched-now">
        <span className="muted small-text">Şu anki saat</span>
        <strong>
          {formatDateLong(appt.start)} · {formatTime(appt.start)} – {formatTime(appt.end)}
        </strong>
        <span className="muted small-text">
          {student?.name ?? 'Silinmiş öğrenci'} · {appt.topic} · {duration} dk
        </span>
      </div>

      <Field label="Yeni gün">
        <input
          className="input"
          type="date"
          min={today}
          value={day}
          onChange={(e) => {
            setDay(e.target.value)
            setTime('')
          }}
        />
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
      {same && <p className="notice notice-danger">Bu, randevunun mevcut saati.</p>}
      {offHours && !same && <p className="notice">Bu saat çalışma programının dışında; yine de kaydedebilirsin.</p>}

      <Field label="Öğrenciye not (isteğe bağlı)">
        <textarea
          className="input"
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ör. O gün başka bir görüşmem çıktı, kusura bakma."
        />
      </Field>

      <label className="toggle-row">
        <div>
          <strong>Öğrenciye pop-up göster</strong>
          <p className="muted">Panele girdiğinde yeni saati ve notunu bir kez görür.</p>
        </div>
        <Switch checked={sendPopup} label="Öğrenciye pop-up göster" onChange={setSendPopup} />
      </label>

      <label className="toggle-row">
        <div>
          <strong>Öğrenciye e-posta gönder</strong>
          <p className="muted">{mail && !mail.systemReady ? 'E-posta ayarları yapılmamış (Ayarlar → E-posta).' : 'Yeni saat ve notun sistem adresinden gider.'}</p>
        </div>
        <Switch checked={sendEmail} label="Öğrenciye e-posta gönder" onChange={setSendEmail} />
      </label>
    </Modal>
  )
}
