import { useState } from 'react'
import { IconWhatsapp } from './Icons'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { currentUser, getBusy, getSettings, proposeTime } from '../lib/db'
import { buildSlots } from '../lib/slots'
import { WEEKDAYS_SHORT, addDays, dateKey, formatDateLong, formatKeyDayMonth, formatKeyLong, formatTime, isValidTime, toInstant, toMinutes, weekdayOf } from '../lib/time'
import type { Appointment } from '../lib/types'
import { cx, errMsg } from '../lib/ui'
import { openWhatsapp, proposeMessage, waLink } from '../lib/whatsapp'

const isWeekend = (key: string) => [0, 6].includes(weekdayOf(key))

/**
 * Öğrenci: mentörün ertelediği saat uymuyorsa kendi saatini önerir (mentör izin verdiyse, her ertelemeden sonra bir kez).
 * Hazır saatler mentörün müsaitlik programından gelir; elle saat: hafta içi sadece ayarlardaki aralık (varsayılan 18:30–20:30),
 * hafta sonu her saat. Asıl kontrol SQL'de (propose_my_time).
 * Ebeveyn bunu key={appt.id} ile çizer; form her açılışta sıfırlanır.
 */
export function ProposeTimeModal({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const toast = useToast()
  const settings = getSettings()
  const now = Date.now()
  const today = dateKey()
  const duration = Math.round((new Date(appt.end).getTime() - new Date(appt.start).getTime()) / 60000)
  const wStart = toMinutes(settings.proposalWeekdayStart)
  const wEnd = toMinutes(settings.proposalWeekdayEnd)

  const days = Array.from({ length: Math.min(14, settings.maxDaysAhead + 1) }, (_, i) => addDays(today, i))
  const [day, setDay] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Appointment | null>(null)

  // Dolu saatler (kendi randevusunun şu anki saati hariç)
  const ownStart = new Date(appt.start).getTime()
  const taken = getBusy()
    .filter((b) => !(b.mine && new Date(b.start).getTime() === ownStart))
    .map((b) => ({ s: new Date(b.start).getTime(), e: new Date(b.end).getTime() }))
  const clashAt = (startMs: number) => taken.some((b) => startMs < b.e && b.s < startMs + duration * 60000)

  const weekend = !!day && isWeekend(day)
  // Hazır saatler: mentörün müsaitlik programındaki boş slotlar (randevu alırken görülenlerle aynı)
  const own = { start: appt.start, end: appt.end }
  const slotDays = buildSlots(
    settings,
    getBusy().filter((b) => !(b.mine && b.start === own.start)),
    now,
  )
  const options = day ? (slotDays.find((d) => d.key === day)?.slots ?? []).filter((x) => x.available).map((x) => x.start) : []
  const isOption = (iso: string) => options.includes(iso)
  const manualRule = `Hafta içi ${settings.proposalWeekdayStart} – ${settings.proposalWeekdayEnd} arası, hafta sonu istediğin saat`

  // Seçimin doğrulaması (SQL ile aynı kurallar; hızlı geri bildirim için)
  const startMs = day && isValidTime(time) ? toInstant(day, time).getTime() : NaN
  let problem = ''
  if (Number.isFinite(startMs)) {
    const m = toMinutes(time)
    const fromList = isOption(new Date(startMs).toISOString())
    if (startMs < now + settings.minNoticeHours * 3600_000) problem = `En az ${settings.minNoticeHours} saat sonrası için saat önerebilirsin.`
    else if (m % 5 !== 0) problem = 'Saati 5 dakikalık aralıklarla seç (ör. 18:30, 18:35).'
    else if (!fromList && !weekend && (m < wStart || m + duration > wEnd))
      problem = `Hafta içi elle sadece ${settings.proposalWeekdayStart} – ${settings.proposalWeekdayEnd} arası saat yazabilirsin (görüşme bu aralıkta bitmeli) ya da yukarıdaki boş saatlerden birini seç.`
    else if (startMs === ownStart) problem = 'Bu zaten randevunun şu anki saati.'
    else if (clashAt(startMs)) problem = 'Bu saat dolu. Başka bir saat seç.'
  }
  const canSend = Number.isFinite(startMs) && !problem

  const send = async () => {
    if (busy || !canSend) return
    setBusy(true)
    try {
      setDone(await proposeTime(appt.id, new Date(startMs).toISOString()))
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const me = currentUser()
    return (
      <Modal
        open
        onClose={onClose}
        title="Önerin iletildi"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
            {me && (
              <button className="btn btn-wa" onClick={() => openWhatsapp(waLink(settings.whatsappNumber, proposeMessage(done, me)))}>
                <IconWhatsapp size={16} /> WhatsApp’tan haber ver
              </button>
            )}
          </>
        }
      >
        <div className="resched-now">
          <span className="muted small-text">Önerdiğin saat</span>
          <strong>{formatDateLong(done.start)} · {formatTime(done.start)} – {formatTime(done.end)}</strong>
        </div>
        <p className="muted">Randevun bu saate taşındı ve mentörünün onayını bekliyor. Onaylanınca Randevularım sayfasında görürsün.</p>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Saat belirle"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="btn btn-primary" disabled={busy || !canSend} onClick={send}>
            {busy ? 'Gönderiliyor…' : canSend ? `${formatTime(new Date(startMs))} saatini öner` : 'Saati öner'}
          </button>
        </>
      }
    >
      <div className="resched-now">
        <span className="muted small-text">Mentörünün belirlediği saat</span>
        <strong>{formatDateLong(appt.start)} · {formatTime(appt.start)} – {formatTime(appt.end)}</strong>
      </div>
      <p className="muted small-text">
        Bu saat sana uymuyorsa bir gün seç: mentörünün boş saatlerinden birini seçebilir ya da kendi saatini yazabilirsin
        (<strong>{manualRule}</strong>). Önerini bir kez gönderebilirsin; mentörün onaylayınca kesinleşir.
      </p>

      <div className="field">
        <span className="field-label">Gün</span>
        <div className="day-pick propose-days">
          {days.map((k) => {
            const blocked = settings.blockedDates.includes(k)
            return (
              <button
                key={k}
                type="button"
                disabled={blocked}
                aria-pressed={k === day}
                className={cx('chip', k === day && 'active', isWeekend(k) && 'is-weekend')}
                onClick={() => { setDay(k); setTime('') }}
                title={blocked ? 'Mentörün bu gün müsait değil' : formatKeyLong(k)}
              >
                <em>{WEEKDAYS_SHORT[weekdayOf(k)]}</em>
                {formatKeyDayMonth(k)}
              </button>
            )
          })}
        </div>
      </div>

      {day && (
        <div className="field">
          <span className="field-label">{formatKeyLong(day)} · mentörünün boş saatleri</span>
          {options.length ? (
            <div className="slot-grid resched-slots">
              {options.map((iso) => {
                const t = formatTime(iso)
                return (
                  <button key={iso} type="button" className={cx('slot', t === time && 'active')} onClick={() => setTime(t)}>
                    <strong>{t}</strong>
                    <span>{duration} dk</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="muted small-text">Bu gün mentörünün programında boş saat yok. Aşağıya kendi saatini yazabilirsin.</p>
          )}
          <label className="field">
            <span className="field-label">Ya da kendi saatini yaz</span>
            <input className="input" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
            <span className="field-hint">{weekend ? 'Hafta sonu: istediğin saati yazabilirsin.' : `Hafta içi: sadece ${settings.proposalWeekdayStart} – ${settings.proposalWeekdayEnd} arası.`}</span>
          </label>
        </div>
      )}

      {problem && <p className="notice notice-danger">{problem}</p>}
    </Modal>
  )
}
