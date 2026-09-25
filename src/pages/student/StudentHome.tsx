import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/Common'
import { IconArrowRight, IconCalendar, IconCalendarPlus, IconCheck, IconClock, IconVideo, IconWhatsapp } from '../../components/Icons'
import { currentUser, getAppointments, getSettings, markWhatsappNotified } from '../../lib/db'
import { useDataVersion, useNow } from '../../lib/hooks'
import { formatDateLong, formatTime, relativeFromNow } from '../../lib/time'
import { StatusBadge } from '../../components/Common'
import { newBookingMessage, openWhatsapp, waLink } from '../../lib/whatsapp'

export function StudentHome() {
  useDataVersion()
  const now = useNow()
  const user = currentUser()!
  const settings = getSettings()
  const mine = getAppointments().filter((a) => a.studentId === user.id)
  const upcoming = mine
    .filter((a) => (a.status === 'pending' || a.status === 'confirmed') && new Date(a.end).getTime() > now)
    .sort((a, b) => a.start.localeCompare(b.start))
  const next = upcoming[0]
  const completed = mine.filter((a) => a.status === 'completed').length
  const unnotified = upcoming.filter((a) => !a.whatsappNotifiedAt)
  const joinable = next?.meetLink && next.status === 'confirmed' && new Date(next.start).getTime() - now < 15 * 60000

  return (
    <>
      <PageHeader
        eyebrow="Hoş geldin"
        title={<>Merhaba, <span className="grad-text">{user.name.split(' ')[0]}</span> 👋</>}
        desc="Mentörlük görüşmelerini buradan planla ve takip et."
        actions={
          <Link to="/panel/randevu-al" className="btn btn-primary">
            <IconCalendarPlus size={18} /> Yeni randevu
          </Link>
        }
      />

      {!user.phone && (
        <div className="notice notice-warn">
          <span>WhatsApp numaran kayıtlı değil. Randevu bildirimlerinde görünmesi için</span>
          <Link className="link" to="/panel/profil">profiline ekle</Link>
        </div>
      )}

      {unnotified.length > 0 && (
        <div className="notice notice-wa">
          <IconWhatsapp size={18} />
          <span>{unnotified.length} randevunu henüz WhatsApp’tan bildirmedin.</span>
          <button
            className="btn btn-wa btn-sm"
            onClick={() => {
              const a = unnotified[0]
              openWhatsapp(waLink(settings.whatsappNumber, newBookingMessage(a, user)))
              void markWhatsappNotified(a.id)
            }}
          >
            Şimdi bildir
          </button>
        </div>
      )}

      <div className="home-grid">
        <section className="card glass glow next-card">
          <span className="eyebrow">Sıradaki görüşmen</span>
          {next ? (
            <>
              <h2 className="next-date">{formatDateLong(next.start)}</h2>
              <p className="next-time">
                <IconClock size={18} /> {formatTime(next.start)} – {formatTime(next.end)}
                <span className="muted"> · {relativeFromNow(next.start, now)}</span>
              </p>
              <div className="next-meta">
                <StatusBadge status={next.status} />
                <span className="chip static">{next.topic}</span>
              </div>
              {next.status === 'confirmed' && next.meetLink ? (
                <a
                  className={joinable ? 'btn btn-primary btn-lg' : 'btn btn-ghost btn-lg'}
                  href={next.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconVideo size={18} /> {joinable ? 'Görüşmeye katıl' : 'Meet linkini aç'}
                </a>
              ) : (
                <p className="fine">
                  <IconVideo size={14} /> Google Meet linki randevun onaylanınca burada görünecek.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="next-date">Planlanmış görüşmen yok</h2>
              <p className="muted">Müsait saatlere göz at ve sana uyan saati ayır.</p>
              <Link to="/panel/randevu-al" className="btn btn-primary btn-lg">
                Randevu al <IconArrowRight size={18} />
              </Link>
            </>
          )}
        </section>

        <div className="stat-col">
          <div className="stat glass">
            <span className="stat-ic"><IconCalendar /></span>
            <div><strong>{upcoming.length}</strong><span>Yaklaşan</span></div>
          </div>
          <div className="stat glass">
            <span className="stat-ic"><IconCheck /></span>
            <div><strong>{completed}</strong><span>Tamamlanan</span></div>
          </div>
          <div className="stat glass">
            <span className="stat-ic"><IconClock /></span>
            <div><strong>{settings.slotMinutes} dk</strong><span>Görüşme süresi</span></div>
          </div>
        </div>
      </div>

      <section className="card glass">
        <h3 className="card-title">Nasıl çalışır?</h3>
        <ol className="how">
          <li><span>1</span><div><strong>Saatini seç</strong><p className="muted">Mentörün müsait olduğu saatlerden birini ayır.</p></div></li>
          <li><span>2</span><div><strong>WhatsApp’tan bildir</strong><p className="muted">Tek tuşla randevu bilgilerin hazır mesaj olarak bize ulaşır.</p></div></li>
          <li><span>3</span><div><strong>Meet’e katıl</strong><p className="muted">Onaylanınca Google Meet linkin burada görünür.</p></div></li>
        </ol>
      </section>
    </>
  )
}
