import { Link } from 'react-router-dom'
import { AdminApptList } from '../../components/AdminApptList'
import { Empty, PageHeader } from '../../components/Common'
import { IconArrowRight, IconCalendar, IconClock, IconSparkle, IconUsers } from '../../components/Icons'
import { currentUser, getAppointments, getStudents } from '../../lib/db'
import { useDataVersion, useNow } from '../../lib/hooks'
import { addDays, dateKey } from '../../lib/time'

export function AdminHome() {
  useDataVersion()
  const now = useNow()
  const user = currentUser()!
  const appts = getAppointments()
  const today = dateKey(new Date(now))
  const weekEnd = addDays(today, 7)
  const active = appts.filter((a) => a.status === 'pending' || a.status === 'confirmed')
  const upcoming = active.filter((a) => new Date(a.end).getTime() > now).sort((a, b) => a.start.localeCompare(b.start))
  const todays = upcoming.filter((a) => dateKey(new Date(a.start)) === today)
  const week = upcoming.filter((a) => dateKey(new Date(a.start)) < weekEnd)
  const pending = upcoming.filter((a) => a.status === 'pending')
  const toClose = active.filter((a) => new Date(a.end).getTime() <= now)

  const stats = [
    { label: 'Bugün', value: todays.length, icon: <IconClock /> },
    { label: 'Onay bekleyen', value: pending.length, icon: <IconSparkle />, hot: pending.length > 0 },
    { label: 'Önümüzdeki 7 gün', value: week.length, icon: <IconCalendar /> },
    { label: 'Öğrenci', value: getStudents().length, icon: <IconUsers /> },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Yönetim"
        title={<>Hoş geldin, <span className="grad-text">{user.name}</span></>}
        desc="Randevularını, müsaitliğini ve öğrencilerini tek yerden yönet."
      />
      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className={s.hot ? 'stat glass hot' : 'stat glass'}>
            <span className="stat-ic">{s.icon}</span>
            <div><strong>{s.value}</strong><span>{s.label}</span></div>
          </div>
        ))}
      </div>

      {toClose.length > 0 && (
        <div className="notice">
          {toClose.length} geçmiş randevu hâlâ açık görünüyor.{' '}
          <Link className="link" to="/yonetim/randevular?f=past">Tamamlandı olarak işaretle</Link>
        </div>
      )}

      <div className="section-head">
        <h3>Yaklaşan görüşmeler</h3>
        <Link className="btn btn-text btn-sm" to="/yonetim/randevular">Tümü <IconArrowRight size={16} /></Link>
      </div>
      {upcoming.length ? (
        <AdminApptList list={upcoming.slice(0, 6)} now={now} />
      ) : (
        <div className="card glass">
          <Empty icon={<IconCalendar />} title="Yaklaşan randevu yok" desc="Öğrenciler randevu aldıkça burada göreceksin." />
        </div>
      )}
    </>
  )
}
