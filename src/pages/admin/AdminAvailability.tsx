import { useState } from 'react'
import { Field, PageHeader, Switch } from '../../components/Common'
import { GoogleCalendarCard } from '../../components/GoogleCalendarCard'
import { IconPlus, IconTrash } from '../../components/Icons'
import { useToast } from '../../components/Toast'
import { getSettings, saveSettings } from '../../lib/db'
import { WEEKDAYS, dateKey, formatKeyLong, toMinutes } from '../../lib/time'
import type { Settings } from '../../lib/types'
import { errMsg } from '../../lib/ui'

const ORDER = [1, 2, 3, 4, 5, 6, 0] // Pazartesi ile başla

export function AdminAvailability() {
  const toast = useToast()
  const [s, setS] = useState<Settings>(() => structuredClone(getSettings()))
  const [newDate, setNewDate] = useState('')
  const [dirty, setDirty] = useState(false)
  const today = dateKey()

  const update = (fn: (d: Settings) => void) => {
    setS((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
    setDirty(true)
  }

  const slotsInRange = (start: string, end: string) => {
    const len = toMinutes(end) - toMinutes(start)
    if (len < s.slotMinutes) return 0
    return Math.floor((len - s.slotMinutes) / (s.slotMinutes + s.bufferMinutes)) + 1
  }
  const weeklyTotal = ORDER.reduce((sum, d) => sum + (s.weekly[d] ?? []).reduce((x, r) => x + slotsInRange(r.start, r.end), 0), 0)

  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await saveSettings(structuredClone(s))
      setS(structuredClone(getSettings()))
      setDirty(false)
      toast('Müsaitlik kaydedildi')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const num = (k: keyof Settings) => (e: { target: { value: string } }) => update((d) => ((d[k] as number) = Number(e.target.value)))

  return (
    <>
      <PageHeader
        eyebrow="Yönetim"
        title="Müsaitlik"
        desc="Haftalık çalışma saatlerini belirle; sistem bu aralıkları randevu slotlarına böler. Google Takvimindeki dolu saatler ayrıca otomatik kapanır."
        actions={
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving ? 'Kaydediliyor…' : dirty ? 'Değişiklikleri kaydet' : 'Kaydedildi'}
          </button>
        }
      />

      <div className="avail-layout">
        <section className="card glass">
          <div className="card-title-row">
            <h3 className="card-title">Haftalık program</h3>
            <span className="chip static">Haftada {weeklyTotal} slot</span>
          </div>
          <div className="week">
            {ORDER.map((d) => {
              const ranges = s.weekly[d] ?? []
              const on = ranges.length > 0
              return (
                <div key={d} className={on ? 'week-row' : 'week-row off'}>
                  <div className="week-day">
                    <Switch
                      checked={on}
                      label={WEEKDAYS[d]}
                      onChange={(v) => update((x) => (x.weekly[d] = v ? [{ start: '10:00', end: '17:00' }] : []))}
                    />
                    <strong>{WEEKDAYS[d]}</strong>
                  </div>
                  <div className="week-ranges">
                    {!on && <span className="muted">Kapalı</span>}
                    {ranges.map((r, i) => (
                      <div key={i} className="range">
                        <input type="time" step={300} className="input" value={r.start} onChange={(e) => update((x) => (x.weekly[d][i].start = e.target.value))} />
                        <span className="muted">–</span>
                        <input type="time" step={300} className="input" value={r.end} onChange={(e) => update((x) => (x.weekly[d][i].end = e.target.value))} />
                        <span className="range-count">{slotsInRange(r.start, r.end)} slot</span>
                        <button className="icon-btn" aria-label="Aralığı sil" onClick={() => update((x) => x.weekly[d].splice(i, 1))}>
                          <IconTrash size={16} />
                        </button>
                      </div>
                    ))}
                    {on && (
                      <button
                        className="btn btn-text btn-sm"
                        onClick={() =>
                          update((x) => {
                            const last = x.weekly[d][x.weekly[d].length - 1]
                            const startMin = Math.min(toMinutes(last?.end ?? '12:00') + 60, 22 * 60)
                            const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
                            x.weekly[d].push({ start: fmt(startMin), end: fmt(Math.min(startMin + 120, 23 * 60 + 59)) })
                          })
                        }
                      >
                        <IconPlus size={16} /> Aralık ekle
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="stack">
          <GoogleCalendarCard />
          <section className="card glass">
            <h3 className="card-title">Görüşme kuralları</h3>
            <div className="form">
              <div className="grid-2">
                <Field label="Görüşme süresi">
                  <select className="input" value={s.slotMinutes} onChange={num('slotMinutes')}>
                    {[30, 40, 45, 60, 90].map((v) => <option key={v} value={v}>{v} dakika</option>)}
                  </select>
                </Field>
                <Field label="Görüşmeler arası mola">
                  <select className="input" value={s.bufferMinutes} onChange={num('bufferMinutes')}>
                    {[0, 5, 10, 15, 30].map((v) => <option key={v} value={v}>{v} dakika</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="En az kaç saat önceden?" hint="Son dakika randevularını engeller">
                  <input className="input" type="number" min={0} max={168} value={s.minNoticeHours} onChange={num('minNoticeHours')} />
                </Field>
                <Field label="En fazla kaç gün ileriye?">
                  <input className="input" type="number" min={1} max={90} value={s.maxDaysAhead} onChange={num('maxDaysAhead')} />
                </Field>
              </div>
              <Field label="Öğrenci başına aktif randevu limiti" hint="Bir öğrencinin tüm takvimi kapatmasını önler">
                <input className="input" type="number" min={1} max={10} value={s.maxActivePerStudent} onChange={num('maxActivePerStudent')} />
              </Field>
            </div>
          </section>

          <section className="card glass">
            <h3 className="card-title">Randevu sıklığı</h3>
            <p className="muted small-text">
              Yeni üye ilk <strong>{s.introBookings}</strong> randevusunu <strong>{s.introGapDays}</strong> günde 1, sonrasında{' '}
              <strong>{s.regularGapDays}</strong> günde 1 oluşturabilir. Süre son randevunun oluşturulduğu andan başlar; iptal edilen
              randevular sayılmaz. Öğrenciler sayfasından bir öğrenciyi “eski öğrenci” yaparsan doğrudan {s.regularGapDays} günlük kurala geçer.
            </p>
            <div className="form">
              <div className="grid-3">
                <Field label="Yeni üye hakkı">
                  <input className="input" type="number" min={0} max={20} value={s.introBookings} onChange={num('introBookings')} />
                </Field>
                <Field label="Yeni üye aralığı (gün)">
                  <input className="input" type="number" min={0} max={60} value={s.introGapDays} onChange={num('introGapDays')} />
                </Field>
                <Field label="Sonraki aralık (gün)">
                  <input className="input" type="number" min={0} max={90} value={s.regularGapDays} onChange={num('regularGapDays')} />
                </Field>
              </div>
            </div>
          </section>

          <section className="card glass">
            <h3 className="card-title">Kapalı günler</h3>
            <p className="muted small-text">Tatil, seyahat gibi günleri kapat. Var olan randevular iptal edilmez.</p>
            <div className="inline-form">
              <input className="input" type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <button
                className="btn btn-ghost"
                disabled={!newDate || s.blockedDates.includes(newDate)}
                onClick={() => {
                  update((x) => x.blockedDates.push(newDate))
                  setNewDate('')
                }}
              >
                <IconPlus size={16} /> Ekle
              </button>
            </div>
            <div className="blocked-list">
              {s.blockedDates.filter((k) => k >= today).length === 0 && <span className="muted">Kapalı gün yok.</span>}
              {s.blockedDates
                .filter((k) => k >= today)
                .sort()
                .map((k) => (
                  <span key={k} className="chip static">
                    {formatKeyLong(k)}
                    <button aria-label="Kaldır" onClick={() => update((x) => (x.blockedDates = x.blockedDates.filter((b) => b !== k)))}>×</button>
                  </span>
                ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
