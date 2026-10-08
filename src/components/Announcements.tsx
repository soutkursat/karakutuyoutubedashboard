import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty, Field, Switch } from './Common'
import { IconMegaphone, IconPlus, IconTrash } from './Icons'
import { Modal } from './Modal'
import { useToast } from './Toast'
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getStudents,
  getUnreadAnnouncements,
  markAnnouncementRead,
  setAnnouncementActive,
} from '../lib/db'
import { useDataVersion, useNow } from '../lib/hooks'
import { formatDayMonth, formatTime, relativeFromNow } from '../lib/time'
import { cx, errMsg } from '../lib/ui'

/** Kapat butonunun aktif olması için beklenecek süre (sn) */
const WAIT_SECONDS = 3

/** Metindeki linkleri tıklanabilir yap (satır sonları CSS ile korunur) */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} className="link" href={p} target="_blank" rel="noopener noreferrer">{p}</a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

/**
 * Öğrenci: görmediği duyuruları sırayla pop-up olarak gösterir. Her duyuru bir kez görülür;
 * kapatma butonu WAIT_SECONDS saniye sonra aktif olur. Açık oturumda yeni duyuru gelirse (realtime) hemen çıkar.
 */
export function AnnouncementGate() {
  useDataVersion()
  const unread = getUnreadAnnouncements()
  const current = unread[0]
  if (!current) return null
  return (
    <AnnouncementPopup
      key={current.id}
      id={current.id}
      title={current.title}
      body={current.body}
      createdAt={current.createdAt}
      link={current.link}
      left={unread.length}
    />
  )
}

/** Panel içi bağlantı → buton yazısı */
const LINK_LABEL: Record<string, string> = {
  '/panel/randevularim': 'Randevularıma git',
  '/panel/randevu-al': 'Randevu al',
  '/panel/profil': 'Profilime git',
}

function AnnouncementPopup({ id, title, body, createdAt, link, left }: { id: string; title: string; body: string; createdAt: string; link: string | null; left: number }) {
  const navigate = useNavigate()
  const [wait, setWait] = useState(WAIT_SECONDS)
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const close = () => {
    if (wait > 0) return
    void markAnnouncementRead(id)
  }

  return (
    <Modal
      open
      onClose={close}
      dismissible={false}
      size="sm"
      title={
        <span className="title-ic">
          <IconMegaphone size={18} /> Duyuru
        </span>
      }
      footer={
        <>
          {left > 1 && <span className="muted small-text ann-left">{left - 1} duyuru daha var</span>}
          {link ? (
            <>
              <button className="btn btn-ghost" disabled={wait > 0} onClick={close}>
                {wait > 0 ? `Kapat (${wait})` : left > 1 ? 'Sonraki' : 'Kapat'}
              </button>
              <button
                className="btn btn-primary"
                disabled={wait > 0}
                onClick={() => {
                  close()
                  navigate(link)
                }}
              >
                {LINK_LABEL[link] ?? 'Göz at'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" disabled={wait > 0} onClick={close} autoFocus={wait <= 0}>
              {wait > 0 ? `Kapat (${wait})` : left > 1 ? 'Sonraki' : 'Tamam, anladım'}
            </button>
          )}
        </>
      }
    >
      <div className="ann-pop">
        <h3>{title}</h3>
        <p className="ann-body"><Linkify text={body} /></p>
        <span className="muted ann-date">{formatDayMonth(createdAt)} · {formatTime(createdAt)}</span>
      </div>
    </Modal>
  )
}

/** Yönetici: duyuru oluştur / listele (kaç öğrenci gördü) / yayından kaldır / sil */
export function AnnouncementsCard() {
  useDataVersion()
  const toast = useToast()
  const now = useNow(60_000)
  const list = getAnnouncements()
  const total = getStudents().filter((u) => u.status === 'active').length
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [all, setAll] = useState(false)

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

  const shown = all ? list : list.slice(0, 4)

  return (
    <section className="card glass ann-card">
      <div className="card-title-row">
        <h3 className="card-title"><IconMegaphone size={18} /> Duyurular</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => { setTitle(''); setBody(''); setCreating(true) }}>
          <IconPlus size={16} /> Yeni duyuru
        </button>
      </div>
      <p className="muted small-text">
        Tüm öğrencilerin ekranında pop-up olarak çıkar. O an panelde olmayanlar giriş yapınca görür; herkes bir kez görür,
        kapatma butonu {WAIT_SECONDS} saniye sonra açılır.
      </p>
      {list.length === 0 ? (
        <Empty icon={<IconMegaphone />} title="Henüz duyuru yok" />
      ) : (
        <div className="ann-list">
          {shown.map((a) => (
            <div key={a.id} className={cx('ann-row', !a.active && 'off')}>
              <div className="ann-main">
                <strong>{a.title}</strong>
                <span className="muted">
                  {relativeFromNow(a.createdAt, now)} · {a.readCount}/{total} öğrenci gördü{!a.active && ' · yayında değil'}
                </span>
              </div>
              <div className="ann-actions">
                <Switch
                  checked={a.active}
                  label={a.active ? 'Yayından kaldır' : 'Tekrar yayınla'}
                  onChange={(v) => run(() => setAnnouncementActive(a.id, v), v ? 'Duyuru tekrar yayında' : 'Duyuru yayından kaldırıldı')}
                />
                <button
                  className="icon-btn danger"
                  title="Sil"
                  aria-label="Duyuruyu sil"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Duyuru silinsin mi?')) void run(() => deleteAnnouncement(a.id), 'Duyuru silindi')
                  }}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            </div>
          ))}
          {list.length > 4 && (
            <button className="btn btn-text btn-sm" onClick={() => setAll(!all)}>{all ? 'Daha az göster' : `Tümünü göster (${list.length})`}</button>
          )}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Yeni duyuru"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Vazgeç</button>
            <button
              className="btn btn-primary"
              disabled={busy || !title.trim() || !body.trim()}
              onClick={async () => {
                if (await run(() => createAnnouncement(title, body), 'Duyuru yayınlandı')) setCreating(false)
              }}
            >
              {busy ? 'Yayınlanıyor…' : `Yayınla (${total} öğrenci)`}
            </button>
          </>
        }
      >
        <Field label="Başlık">
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ör. Bu hafta görüşmeler Perşembe’ye kaydı" autoFocus />
        </Field>
        <Field label="Mesaj" hint={`Linkler tıklanabilir olur. ${body.length}/2000`}>
          <textarea className="input" rows={6} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
      </Modal>
    </section>
  )
}
