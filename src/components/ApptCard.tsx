import type { ReactNode } from 'react'
import type { Appointment } from '../lib/types'
import { formatDayMonth, formatTime, WEEKDAYS, dateKey, weekdayOf, relativeFromNow } from '../lib/time'
import { StatusBadge } from './Common'

/** Tarih bloğu + detaylar + aksiyonlar içeren randevu satırı */
export function ApptCard({ a, now, title, meta, actions }: { a: Appointment; now: number; title?: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  const [day, mon] = formatDayMonth(a.start).split(' ')
  const upcoming = new Date(a.start).getTime() > now && a.status !== 'cancelled'
  return (
    <article className="appt glass">
      <div className="appt-date">
        <strong>{day}</strong>
        <span>{mon}</span>
      </div>
      <div className="appt-body">
        <div className="appt-row">
          <h4>{title ?? a.topic}</h4>
          <StatusBadge status={a.status} />
        </div>
        <p className="appt-meta">
          {WEEKDAYS[weekdayOf(dateKey(new Date(a.start)))]} · {formatTime(a.start)} – {formatTime(a.end)}
          {upcoming && <span className="appt-rel"> · {relativeFromNow(a.start, now)}</span>}
          <span className="mono appt-code">{a.code}</span>
        </p>
        {meta}
        {actions && <div className="appt-actions">{actions}</div>}
      </div>
    </article>
  )
}
