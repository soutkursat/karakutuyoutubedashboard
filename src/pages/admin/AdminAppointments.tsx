import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { AdminApptList } from '../../components/AdminApptList'
import { Empty, PageHeader } from '../../components/Common'
import { IconCalendar, IconSearch } from '../../components/Icons'
import { getAppointments, getUser } from '../../lib/db'
import { useDataVersion, useNow } from '../../lib/hooks'
import type { Appointment } from '../../lib/types'
import { cx } from '../../lib/ui'

const FILTERS = [
  { id: 'upcoming', label: 'Yaklaşan' },
  { id: 'pending', label: 'Onay bekleyen' },
  { id: 'past', label: 'Geçmiş' },
  { id: 'cancelled', label: 'İptal' },
  { id: 'all', label: 'Tümü' },
] as const
type F = (typeof FILTERS)[number]['id']

export function AdminAppointments() {
  useDataVersion()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const f = (FILTERS.some((x) => x.id === params.get('f')) ? params.get('f') : 'upcoming') as F
  const [q, setQ] = useState('')

  const all = getAppointments()
  const isActive = (a: Appointment) => a.status === 'pending' || a.status === 'confirmed'
  const future = (a: Appointment) => new Date(a.end).getTime() > now
  const pick: Record<F, (a: Appointment) => boolean> = {
    upcoming: (a) => isActive(a) && future(a),
    pending: (a) => a.status === 'pending' && future(a),
    past: (a) => a.status === 'completed' || (isActive(a) && !future(a)),
    cancelled: (a) => a.status === 'cancelled',
    all: () => true,
  }
  const needle = q.trim().toLocaleLowerCase('tr-TR')
  const list = all
    .filter(pick[f])
    .filter((a) => {
      if (!needle) return true
      const s = getUser(a.studentId)
      return [a.code, a.topic, s?.name, s?.email, s?.phone].some((v) => v?.toLocaleLowerCase('tr-TR').includes(needle))
    })
    .sort((a, b) => (f === 'upcoming' || f === 'pending' ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start)))

  return (
    <>
      <PageHeader eyebrow="Yönetim" title="Randevular" desc="Onayla, Meet linki ekle, öğrenciyi WhatsApp’tan bilgilendir." />
      <div className="toolbar">
        <div className="seg">
          {FILTERS.map((x) => (
            <button key={x.id} className={cx('seg-btn', f === x.id && 'active')} onClick={() => setParams({ f: x.id })}>
              {x.label} <em>{all.filter(pick[x.id]).length}</em>
            </button>
          ))}
        </div>
        <div className="search">
          <IconSearch size={16} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim, e-posta, randevu no…" />
        </div>
      </div>
      {list.length ? (
        <AdminApptList list={list} now={now} />
      ) : (
        <div className="card glass">
          <Empty icon={<IconCalendar />} title="Kayıt bulunamadı" />
        </div>
      )}
    </>
  )
}
