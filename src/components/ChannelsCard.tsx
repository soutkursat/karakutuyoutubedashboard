import { useState, type ReactNode } from 'react'
import { Empty, Field } from './Common'
import { IconChevronRight, IconEdit, IconPlus, IconTrash, IconVideo } from './Icons'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { addChannel, deleteChannel, getChannels, updateChannel, type ChannelDetails, type ChannelInput } from '../lib/db'
import { useDataVersion } from '../lib/hooks'
import { WEEKDAYS_SHORT, dateKey, durationSince, formatMonthYear } from '../lib/time'
import type { Channel, ContentFormat } from '../lib/types'
import { cx, errMsg } from '../lib/ui'
import { channelLabel } from '../lib/validation'

const EMPTY: ChannelInput = { url: '', monetized: false, startedOn: '' }
const EMPTY_DETAILS: ChannelDetails = { uploadDays: [], videoCount: '', niche: '', contentFormat: null, challenge: '' }
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Pazartesi'den başla
export const FORMAT_LABEL: Record<ContentFormat, string> = { long: 'Uzun video', shorts: 'Shorts', both: 'Uzun + Shorts' }
const fmtNum = (n: number) => new Intl.NumberFormat('tr-TR').format(n)
const daysText = (d: number[]) => (d.length === 7 ? 'Her gün' : d.map((x) => WEEKDAYS_SHORT[x]).join(', '))

/** Tek kanal satırı (öğrenci profili + yönetici detay penceresi ortak).
 *  expandable: yönetici tıklayınca kanalın tüm detayları açılır. */
export function ChannelRow({ c, actions, expandable = false }: { c: Channel; actions?: ReactNode; expandable?: boolean }) {
  const [open, setOpen] = useState(false)
  const hasDetails = c.uploadDays.length > 0 || c.videoCount != null || !!c.niche || !!c.contentFormat || !!c.challenge
  const summary = (
    <>
      <span className="channel-ic"><IconVideo size={18} /></span>
      <span className="channel-body">
        {expandable ? (
          <span className="channel-name">{channelLabel(c.url)}</span>
        ) : (
          <a className="channel-name" href={c.url} target="_blank" rel="noopener noreferrer">{channelLabel(c.url)}</a>
        )}
        <span className="channel-meta">
          <span className={cx('badge', c.monetized ? 'badge-confirmed' : 'badge-muted')}>
            {c.monetized ? 'Para kazanma açık' : 'Para kazanma kapalı'}
          </span>
          {c.startedOn ? (
            <span className="muted">Başlangıç: {formatMonthYear(c.startedOn)} · {durationSince(c.startedOn)}</span>
          ) : (
            <span className="muted">Başlangıç tarihi yok</span>
          )}
          {c.videoCount != null && <span className="muted">· {fmtNum(c.videoCount)} video</span>}
        </span>
      </span>
    </>
  )

  if (!expandable) {
    return (
      <div className="channel">
        {summary}
        {actions && <div className="row-actions">{actions}</div>}
      </div>
    )
  }

  return (
    <div className={cx('channel-x', open && 'open')}>
      <button type="button" className="channel channel-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {summary}
        <IconChevronRight size={18} className="channel-chev" />
      </button>
      {open && (
        <div className="channel-detail">
          {hasDetails ? (
            <div className="cd-grid">
              <div><span>Yükleme günleri</span><strong>{c.uploadDays.length ? daysText(c.uploadDays) : '—'}</strong></div>
              <div><span>Toplam video</span><strong>{c.videoCount != null ? fmtNum(c.videoCount) : '—'}</strong></div>
              <div><span>İçerik türü</span><strong>{c.contentFormat ? FORMAT_LABEL[c.contentFormat] : '—'}</strong></div>
              <div><span>Konu / niş</span><strong>{c.niche || '—'}</strong></div>
              {c.challenge && (
                <div className="cd-wide"><span>En çok zorlandığı konu</span><p>{c.challenge}</p></div>
              )}
            </div>
          ) : (
            <p className="muted small-text">Öğrenci bu kanal için henüz detay girmedi.</p>
          )}
          <a className="btn btn-ghost btn-sm" href={c.url} target="_blank" rel="noopener noreferrer">YouTube’da aç</a>
        </div>
      )}
    </div>
  )
}

/** Öğrencinin kendi kanallarını yönettiği kart */
export function ChannelsCard({ studentId }: { studentId: string }) {
  useDataVersion()
  const toast = useToast()
  const channels = getChannels(studentId)
  const [edit, setEdit] = useState<Channel | 'new' | null>(null)
  const [form, setForm] = useState<ChannelInput>(EMPTY)
  const [det, setDet] = useState<ChannelDetails>(EMPTY_DETAILS)
  const [del, setDel] = useState<Channel | null>(null)
  const [busy, setBusy] = useState(false)

  const open = (c: Channel | 'new') => {
    setEdit(c)
    setForm(c === 'new' ? EMPTY : { url: c.url, monetized: c.monetized, startedOn: c.startedOn ?? '' })
    setDet(
      c === 'new'
        ? EMPTY_DETAILS
        : { uploadDays: c.uploadDays, videoCount: c.videoCount != null ? String(c.videoCount) : '', niche: c.niche, contentFormat: c.contentFormat, challenge: c.challenge },
    )
  }

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

  const save = async () => {
    if (!edit) return
    const ok =
      edit === 'new' ? await run(() => addChannel(form, det), 'Kanal eklendi') : await run(() => updateChannel(edit.id, form, det), 'Kanal güncellendi')
    if (ok) setEdit(null)
  }

  return (
    <section className="card glass glow channels-card">
      <div className="card-title-row">
        <h3 className="card-title"><IconVideo size={18} /> YouTube kanallarım</h3>
        {channels.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => open('new')}><IconPlus size={16} /> Kanal ekle</button>
        )}
      </div>

      {channels.length === 0 ? (
        <Empty
          icon={<IconVideo />}
          title="Henüz kanal eklemedin"
          desc="Mentörün kanalını inceleyebilsin diye mevcut kanallarının linkini ekle."
          action={<button className="btn btn-primary" onClick={() => open('new')}><IconPlus size={16} /> Kanalımı ekle</button>}
        />
      ) : (
        <div className="channel-list">
          {channels.map((c) => (
            <ChannelRow
              key={c.id}
              c={c}
              actions={
                <>
                  <button className="icon-btn" title="Düzenle" aria-label="Düzenle" onClick={() => open(c)}><IconEdit size={16} /></button>
                  <button className="icon-btn danger" title="Sil" aria-label="Sil" onClick={() => setDel(c)}><IconTrash size={16} /></button>
                </>
              }
            />
          ))}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit === 'new' ? 'Kanal ekle' : 'Kanalı düzenle'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEdit(null)}>Vazgeç</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </>
        }
      >
        <div className="form">
          <Field label="Kanal linki" hint="YouTube’da kanalına gir, adres çubuğundaki linki kopyala.">
            <input
              className="input"
              inputMode="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://www.youtube.com/@kanaladi"
              autoFocus
            />
          </Field>
          <Field label="Para kazanma (YPP)">
            <div className="seg seg-full" role="radiogroup">
              <button type="button" role="radio" aria-checked={form.monetized} className={cx('seg-btn', form.monetized && 'active')} onClick={() => setForm({ ...form, monetized: true })}>
                Açık
              </button>
              <button type="button" role="radio" aria-checked={!form.monetized} className={cx('seg-btn', !form.monetized && 'active')} onClick={() => setForm({ ...form, monetized: false })}>
                Kapalı
              </button>
            </div>
          </Field>
          <Field
            label="Kanalı açtığın tarih"
            hint={<><strong>Eski bir kanal kullanıyorsan</strong>, aktif olarak içerik üretmeye başladığın tarihi yaz. Günü tam hatırlamıyorsan ayın 1’ini seçebilirsin.</>}
          >
            <input
              className="input"
              type="date"
              min="2005-01-01"
              max={dateKey()}
              value={form.startedOn}
              onChange={(e) => setForm({ ...form, startedOn: e.target.value })}
            />
          </Field>

          <div className="ch-more">
            <h4 className="sf-h">Kanal detayları <em>isteğe bağlı · mentörünün kanalını analiz etmesini kolaylaştırır</em></h4>
            <Field label="Hangi günlerde video yüklüyorsun?">
              <div className="day-pick">
                {DAY_ORDER.map((d) => {
                  const on = det.uploadDays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      className={cx('chip', on && 'active')}
                      onClick={() => setDet({ ...det, uploadDays: on ? det.uploadDays.filter((x) => x !== d) : [...det.uploadDays, d] })}
                    >
                      {WEEKDAYS_SHORT[d]}
                    </button>
                  )
                })}
              </div>
            </Field>
            <div className="grid-2">
              <Field label="Toplam video sayısı">
                <input className="input" inputMode="numeric" value={det.videoCount} onChange={(e) => setDet({ ...det, videoCount: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="Ör. 48" />
              </Field>
              <Field label="Kanalın konusu / nişi">
                <input className="input" maxLength={120} value={det.niche} onChange={(e) => setDet({ ...det, niche: e.target.value })} placeholder="Ör. tarih belgeselleri" />
              </Field>
            </div>
            <Field label="İçerik türü">
              <div className="seg seg-full seg-3" role="radiogroup">
                {(Object.keys(FORMAT_LABEL) as ContentFormat[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={det.contentFormat === k}
                    className={cx('seg-btn', det.contentFormat === k && 'active')}
                    onClick={() => setDet({ ...det, contentFormat: det.contentFormat === k ? null : k })}
                  >
                    {FORMAT_LABEL[k]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Şu an kanalında en çok zorlandığın konu ne?">
              <textarea
                className="input"
                rows={2}
                maxLength={600}
                value={det.challenge}
                onChange={(e) => setDet({ ...det, challenge: e.target.value })}
                placeholder="Ör. izlenmeler düşük, thumbnail, fikir bulma, düzenli yükleme…"
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title="Kanalı kaldır"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDel(null)}>Vazgeç</button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                if (del && (await run(() => deleteChannel(del.id), 'Kanal kaldırıldı'))) setDel(null)
              }}
            >
              Kaldır
            </button>
          </>
        }
      >
        <p className="muted"><strong>{del && channelLabel(del.url)}</strong> listenden kaldırılacak.</p>
      </Modal>
    </section>
  )
}
