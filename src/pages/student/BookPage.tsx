import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, PageHeader } from '../../components/Common'
import { BookingSuccess } from '../../components/BookingSuccess'
import { IconCalendarPlus, IconClock, IconVideo } from '../../components/Icons'
import { useToast } from '../../components/Toast'
import { bookAppointment, currentUser, getAppointments, getBusy, getSettings } from '../../lib/db'
import { useDataVersion, useNow } from '../../lib/hooks'
import { activeAppointments, buildSlots } from '../../lib/slots'
import { WEEKDAYS_SHORT, formatKeyDayMonth, formatKeyLong, formatTime, formatDateLong, weekdayOf } from '../../lib/time'
import type { Appointment } from '../../lib/types'
import { cx, errMsg } from '../../lib/ui'

export function BookPage() {
  useDataVersion()
  const now = useNow()
  const toast = useToast()
  const navigate = useNavigate()
  const user = currentUser()!
  const settings = getSettings()
  const appts = getAppointments()

  const days = buildSlots(settings, getBusy(), now)
  const firstOpen = days.find((d) => d.slots.some((s) => s.available))?.key ?? days[0]?.key
  const [dayKey, setDayKey] = useState<string | undefined>(undefined)
  const selectedDay = days.find((d) => d.key === (dayKey ?? firstOpen))
  const [slot, setSlot] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Appointment | null>(null)

  const activeCount = activeAppointments(appts).filter((a) => a.studentId === user.id && new Date(a.end).getTime() > now).length
  const limitReached = activeCount >= settings.maxActivePerStudent
  // Seçili slot bu arada dolduysa seçimi düşür
  const slotStillFree = !!slot && days.some((d) => d.slots.some((s) => s.start === slot && s.available))
  const chosen = slotStillFree ? slot : null

  const submit = async () => {
    if (!chosen || busy) return
    setBusy(true)
    try {
      const a = await bookAppointment({ studentId: user.id, start: chosen, topic, note })
      setDone(a)
      setSlot(null)
      setNote('')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Adım 1 · Saat seç"
        title="Randevu al"
        desc={
          <>
            Tüm saatler <strong>Türkiye saati</strong> ile gösterilir. Görüşmeler {settings.slotMinutes} dakika sürer ve Google Meet
            üzerinden yapılır.
          </>
        }
      />

      {limitReached && (
        <div className="notice notice-warn">
          Aynı anda en fazla {settings.maxActivePerStudent} aktif randevun olabilir. Yeni randevu için mevcut randevunun tamamlanmasını
          bekle ya da <button className="link" onClick={() => navigate('/panel/randevularim')}>randevularından</button> birini iptal et.
        </div>
      )}

      <div className="book-layout">
        <section className="card glass">
          <div className="day-strip" role="listbox" aria-label="Gün seç">
            {days.map((d) => {
              const free = d.slots.filter((s) => s.available).length
              const active = d.key === selectedDay?.key
              return (
                <button
                  key={d.key}
                  role="option"
                  aria-selected={active}
                  className={cx('day-chip', active && 'active', free === 0 && 'is-empty')}
                  title={free === 0 && !d.blocked && d.slots.length ? `En az ${settings.minNoticeHours} saat önceden randevu alınabilir` : undefined}
                  onClick={() => {
                    setDayKey(d.key)
                    setSlot(null)
                  }}
                >
                  <span className="day-chip-wd">{WEEKDAYS_SHORT[weekdayOf(d.key)]}</span>
                  <strong>{formatKeyDayMonth(d.key).split(' ')[0]}</strong>
                  <span className="day-chip-m">{formatKeyDayMonth(d.key).split(' ')[1]}</span>
                  <em>{d.blocked || d.slots.length === 0 ? 'Kapalı' : free ? `${free} boş` : d.slots.some((s) => s.reason === 'booked' || s.reason === 'mine') ? 'Dolu' : 'Kapandı'}</em>
                </button>
              )
            })}
          </div>

          {selectedDay && (
            <div className="slots-wrap">
              <div className="slots-head">
                <h3>{formatKeyLong(selectedDay.key)}</h3>
                <div className="legend">
                  <span><i className="lg-free" />Müsait</span>
                  <span><i className="lg-busy" />Dolu</span>
                  <span><i className="lg-mine" />Senin</span>
                </div>
              </div>
              {selectedDay.slots.length === 0 ? (
                <div className="empty small">
                  <IconClock />
                  <p className="muted">{selectedDay.blocked ? 'Bu gün kapalı.' : 'Bu gün için açık saat yok.'} Başka bir gün seç.</p>
                </div>
              ) : (
                <div className="slot-grid">
                  {selectedDay.slots.map((s) => (
                    <button
                      key={s.start}
                      disabled={!s.available || limitReached}
                      className={cx('slot', s.start === chosen && 'active', s.reason && `slot-${s.reason}`)}
                      onClick={() => setSlot(s.start)}
                      title={s.reason === 'notice' ? `En az ${settings.minNoticeHours} saat önceden randevu alınabilir` : undefined}
                    >
                      <strong>{formatTime(s.start)}</strong>
                      <span>{s.reason === 'booked' ? 'Dolu' : s.reason === 'mine' ? 'Senin' : s.reason === 'notice' ? 'Çok yakın' : `${settings.slotMinutes} dk`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="card glass glow book-summary">
          <span className="eyebrow">Adım 2 · Detaylar</span>
          <h3 className="card-title">Randevu özeti</h3>
          {chosen ? (
            <div className="summary-slot">
              <IconCalendarPlus />
              <div>
                <strong>{formatDateLong(chosen)}</strong>
                <span>
                  {formatTime(chosen)} – {formatTime(new Date(new Date(chosen).getTime() + settings.slotMinutes * 60000))}
                </span>
              </div>
            </div>
          ) : (
            <div className="summary-slot placeholder">
              <IconClock />
              <span>Soldan bir saat seç</span>
            </div>
          )}

          <Field label="Görüşme konusu *">
            <div className="chips">
              {settings.topics.map((t) => (
                <button type="button" key={t} className={cx('chip', topic === t && 'active')} onClick={() => setTopic(t)}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notun (isteğe bağlı)" hint={`${note.length}/600`}>
            <textarea
              className="input"
              rows={4}
              maxLength={600}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Kanal linkin, konuşmak istediğin konular, soruların…"
            />
          </Field>

          <button className="btn btn-primary btn-lg btn-block" disabled={!chosen || !topic || busy || limitReached} onClick={submit}>
            {busy ? 'Oluşturuluyor…' : 'Randevuyu oluştur'}
          </button>
          <p className="fine">
            <IconVideo size={14} /> Google Meet linki randevu onaylanınca panelinde görünür.
          </p>
        </aside>
      </div>

      <BookingSuccess
        appt={done}
        onClose={() => {
          setDone(null)
          navigate('/panel/randevularim')
        }}
      />
    </>
  )
}
