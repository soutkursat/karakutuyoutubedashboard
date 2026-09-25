import { useState } from 'react'
import { Empty, Field } from './Common'
import { IconEdit, IconPlus, IconTrash, IconVideo } from './Icons'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { addChannel, deleteChannel, getChannels, updateChannel, type ChannelInput } from '../lib/db'
import { useDataVersion } from '../lib/hooks'
import { dateKey, durationSince, formatMonthYear } from '../lib/time'
import type { Channel } from '../lib/types'
import { cx, errMsg } from '../lib/ui'
import { channelLabel } from '../lib/validation'

const EMPTY: ChannelInput = { url: '', monetized: false, startedOn: '' }

/** Tek kanal satırı (öğrenci profili + yönetici detay penceresi ortak) */
export function ChannelRow({ c, actions }: { c: Channel; actions?: React.ReactNode }) {
  return (
    <div className="channel">
      <span className="channel-ic"><IconVideo size={18} /></span>
      <div className="channel-body">
        <a className="channel-name" href={c.url} target="_blank" rel="noopener noreferrer">{channelLabel(c.url)}</a>
        <div className="channel-meta">
          <span className={cx('badge', c.monetized ? 'badge-confirmed' : 'badge-muted')}>
            {c.monetized ? 'Para kazanma açık' : 'Para kazanma kapalı'}
          </span>
          {c.startedOn ? (
            <span className="muted">Başlangıç: {formatMonthYear(c.startedOn)} · {durationSince(c.startedOn)}</span>
          ) : (
            <span className="muted">Başlangıç tarihi yok</span>
          )}
        </div>
      </div>
      {actions && <div className="row-actions">{actions}</div>}
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
  const [del, setDel] = useState<Channel | null>(null)
  const [busy, setBusy] = useState(false)

  const open = (c: Channel | 'new') => {
    setEdit(c)
    setForm(c === 'new' ? EMPTY : { url: c.url, monetized: c.monetized, startedOn: c.startedOn ?? '' })
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
    const ok = edit === 'new' ? await run(() => addChannel(form), 'Kanal eklendi') : await run(() => updateChannel(edit.id, form), 'Kanal güncellendi')
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
