import { useState } from 'react'
import { ChannelRow } from '../../components/ChannelsCard'
import { Empty, PageHeader, StatusBadge } from '../../components/Common'
import { StudentFormModal } from '../../components/StudentFormModal'
import { IconBan, IconCheck, IconEdit, IconPlus, IconSearch, IconTrash, IconUsers, IconWhatsapp } from '../../components/Icons'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { deleteStudent, getAppointments, getChannels, getSettings, getStudents, getUser, setUserStatus } from '../../lib/db'
import { computeQuota, formatRemaining, quotaRuleText } from '../../lib/quota'
import { useDataVersion, useNow } from '../../lib/hooks'
import { formatDate, formatDayMonth, formatTime } from '../../lib/time'
import type { User } from '../../lib/types'
import { cx, errMsg, initials } from '../../lib/ui'
import { formatPhone } from '../../lib/validation'
import { openWhatsapp, waLink } from '../../lib/whatsapp'

const FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'skool', label: 'Skool’da' },
  { id: 'ypp', label: 'Para kazanan' },
  { id: 'nochannel', label: 'Kanalı yok' },
] as const
type Filter = (typeof FILTERS)[number]['id']

export function AdminStudents() {
  useDataVersion()
  const toast = useToast()
  const now = useNow(60_000)
  const settings = getSettings()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = detailId ? getUser(detailId) : undefined
  const [edit, setEdit] = useState<User | 'new' | null>(null)
  const [del, setDel] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)

  /** Sunucu işlemi: çift tıklamayı engelle, hatayı göster. Başarılıysa true. */
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return false
    setBusy(true)
    try {
      await fn()
      toast(ok)
      return true
    } catch (e) {
      toast(errMsg(e), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const appts = getAppointments()
  const needle = q.trim().toLocaleLowerCase('tr-TR')
  const pick: Record<Filter, (u: User) => boolean> = {
    all: () => true,
    skool: (u) => u.skoolMember,
    ypp: (u) => getChannels(u.id).some((c) => c.monetized),
    nochannel: (u) => getChannels(u.id).length === 0,
  }
  const students = getStudents()
    .filter(pick[filter])
    .filter(
      (u) =>
        !needle ||
        [u.name, u.email, u.phone, ...getChannels(u.id).map((c) => c.url)].some((v) => v.toLocaleLowerCase('tr-TR').includes(needle)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const open = (u: User | 'new') => setEdit(u)

  return (
    <>
      <PageHeader
        eyebrow="Yönetim"
        title="Öğrenciler"
        desc={`${getStudents().length} kayıtlı öğrenci`}
        actions={<button className="btn btn-primary" onClick={() => open('new')}><IconPlus size={18} /> Öğrenci ekle</button>}
      />
      <div className="toolbar">
        <div className="seg">
          {FILTERS.map((x) => (
            <button key={x.id} className={cx('seg-btn', filter === x.id && 'active')} onClick={() => setFilter(x.id)}>
              {x.label} <em>{getStudents().filter(pick[x.id]).length}</em>
            </button>
          ))}
        </div>
        <div className="search">
          <IconSearch size={16} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim, e-posta, telefon, kanal…" />
        </div>
      </div>

      {students.length === 0 ? (
        <div className="card glass"><Empty icon={<IconUsers />} title="Öğrenci bulunamadı" /></div>
      ) : (
        <div className="card glass table-card">
          <table className="table">
            <thead>
              <tr><th>Öğrenci</th><th>WhatsApp</th><th>Kanallar</th><th>Skool</th><th>Randevu hakkı</th><th>Durum</th><th /></tr>
            </thead>
            <tbody>
              {students.map((u) => {
                const chs = getChannels(u.id)
                const qt = computeQuota(u, appts, settings, now)
                return (
                  <tr key={u.id} className={cx('row-click', u.status === 'disabled' && 'row-off')} onClick={() => setDetailId(u.id)}>
                    <td>
                      <div className="user-cell">
                        <span className="avatar sm">{initials(u.name)}</span>
                        <div><strong>{u.name}</strong><span className="muted">{u.email}</span></div>
                      </div>
                    </td>
                    <td className="nowrap">{u.phone ? formatPhone(u.phone) : <span className="muted">—</span>}</td>
                    <td className="nowrap">
                      {chs.length ? (
                        <>
                          {chs.length} kanal
                          {chs.some((c) => c.monetized) && <span className="tag tag-wa">YPP</span>}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{u.skoolMember ? <span className="tag tag-wa"><IconCheck size={12} /> Var</span> : <span className="muted">—</span>}</td>
                    <td className="nowrap">{qt.canBook ? <span className="muted">Açık</span> : formatRemaining((qt.nextAt ?? now) - now)}</td>
                    <td><span className={cx('badge', u.status === 'active' ? 'badge-confirmed' : 'badge-cancelled')}>{u.status === 'active' ? 'Aktif' : 'Askıda'}</span></td>
                    <td>
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" title="WhatsApp" onClick={() => openWhatsapp(waLink(u.phone, `Merhaba ${u.name.split(' ')[0]},`))}><IconWhatsapp size={16} /></button>
                        <button className="icon-btn" title="Düzenle" onClick={() => open(u)}><IconEdit size={16} /></button>
                        <button
                          className="icon-btn"
                          title={u.status === 'active' ? 'Askıya al' : 'Aktifleştir'}
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => setUserStatus(u.id, u.status === 'active' ? 'disabled' : 'active'),
                              u.status === 'active' ? 'Hesap askıya alındı, gelecek randevuları iptal edildi' : 'Hesap aktifleştirildi',
                            )
                          }
                        >
                          {u.status === 'active' ? <IconBan size={16} /> : <IconCheck size={16} />}
                        </button>
                        <button className="icon-btn danger" title="Sil" onClick={() => setDel(u)}><IconTrash size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && <StudentFormModal key={edit === 'new' ? 'new' : edit.id} user={edit} onClose={() => setEdit(null)} />}

      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        size="lg"
        title={
          detail && (
            <div className="user-cell">
              <span className="avatar">{initials(detail.name)}</span>
              <div><strong>{detail.name}</strong><span className="muted">{detail.email}</span></div>
            </div>
          )
        }
        footer={
          detail && (
            <>
              {detail.phone && (
                <button className="btn btn-wa" onClick={() => openWhatsapp(waLink(detail.phone, `Merhaba ${detail.name.split(' ')[0]},`))}>
                  <IconWhatsapp size={16} /> WhatsApp
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => { setDetailId(null); open(detail) }}><IconEdit size={16} /> Düzenle</button>
            </>
          )
        }
      >
        {detail && (() => {
          const qt = computeQuota(detail, appts, settings, now)
          const chs = getChannels(detail.id)
          const history = appts.filter((a) => a.studentId === detail.id).sort((a, b) => b.start.localeCompare(a.start))
          return (
            <div className="detail">
              <div className="detail-grid">
                <div><span>WhatsApp</span><strong>{detail.phone ? formatPhone(detail.phone) : '—'}</strong></div>
                <div><span>Kayıt tarihi</span><strong>{formatDate(detail.createdAt)}</strong></div>
                <div><span>Skool</span><strong>{detail.skoolMember ? 'Toplulukta' : 'Değil'}</strong></div>
                <div>
                  <span>Randevu hakkı</span>
                  <strong>{qt.canBook ? 'Şu an açık' : `${formatRemaining((qt.nextAt ?? now) - now)} sonra`}</strong>
                </div>
              </div>

              <div className="toggle-row">
                <div>
                  <strong>{detail.veteran ? 'Eski öğrenci' : 'Yeni üye'}</strong>
                  <p className="muted">
                    {quotaRuleText(detail, settings, true)}
                    {qt.intro && ` Kalan haftalık hak: ${qt.introLeft}/${settings.introBookings}.`}
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => { setDetailId(null); open(detail) }}>Hakları düzenle</button>
              </div>

              <div>
                <h4 className="detail-h">YouTube kanalları <em>{chs.length}</em></h4>
                {chs.length ? (
                  <div className="channel-list">{chs.map((c) => <ChannelRow key={c.id} c={c} />)}</div>
                ) : (
                  <p className="muted">Öğrenci henüz kanal eklemedi.</p>
                )}
              </div>

              <div>
                <h4 className="detail-h">Randevu geçmişi <em>{history.filter((a) => a.status !== 'cancelled').length}</em></h4>
                {history.length ? (
                  <div className="mini-list">
                    {history.slice(0, 8).map((a) => (
                      <div key={a.id} className="mini-row">
                        <strong>{formatDayMonth(a.start)}</strong>
                        <span className="muted">{formatTime(a.start)}</span>
                        <span className="mini-topic">{a.topic}</span>
                        <StatusBadge status={a.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Henüz randevu yok.</p>
                )}
              </div>

              {detail.adminNote && (
                <div>
                  <h4 className="detail-h">Özel not</h4>
                  <p className="appt-note">{detail.adminNote}</p>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title="Öğrenciyi sil"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDel(null)}>Vazgeç</button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                if (!del) return
                if (await run(() => deleteStudent(del.id), 'Öğrenci silindi')) setDel(null)
              }}
            >
              Kalıcı olarak sil
            </button>
          </>
        }
      >
        <p className="muted">
          <strong>{del?.name}</strong> ve tüm randevu geçmişi kalıcı olarak silinecek. Sadece erişimi kesmek istiyorsan “Askıya al”ı kullan.
        </p>
      </Modal>
    </>
  )
}
