import { useState } from 'react'
import { Field, PasswordInput, Switch } from './Common'
import { IconClock, IconPlus, IconTrash, IconVideo } from './Icons'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { adminCreateStudent, adminResetQuota, adminUpdateStudent, getAppointments, getChannels, getSettings, type StudentForm } from '../lib/db'
import { computeQuota, formatRemaining } from '../lib/quota'
import { dateKey } from '../lib/time'
import type { User } from '../lib/types'
import { cx, errMsg } from '../lib/ui'
import { formatPhone } from '../lib/validation'

const newChannel = () => ({ url: '', monetized: false, startedOn: '' })

function initialForm(u: User | null): StudentForm {
  const s = getSettings()
  if (!u) {
    return { name: '', email: '', phone: '', password: '', adminNote: '', skoolMember: false, veteran: false, introLeft: s.introBookings, channels: [newChannel()] }
  }
  const q = computeQuota(u, getAppointments(), s)
  return {
    name: u.name,
    email: u.email,
    phone: formatPhone(u.phone),
    password: '',
    adminNote: u.adminNote ?? '',
    skoolMember: u.skoolMember,
    veteran: u.veteran,
    introLeft: q.introLeft,
    channels: getChannels(u.id).map((c) => ({ id: c.id, url: c.url, monetized: c.monetized, startedOn: c.startedOn ?? '' })),
  }
}

function randomPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789'
  const r = new Uint8Array(8)
  crypto.getRandomValues(r)
  return Array.from(r, (x) => a[x % a.length]).join('')
}

/** Yönetici: öğrenci ekle / düzenle — kayıt formundaki tüm bilgiler + randevu hakları */
export function StudentFormModal({ user, onClose }: { user: User | 'new'; onClose: () => void }) {
  const toast = useToast()
  const isNew = user === 'new'
  const u = isNew ? null : user
  const settings = getSettings()
  const [f, setF] = useState<StudentForm>(() => initialForm(u))
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof StudentForm>(k: K, v: StudentForm[K]) => setF((p) => ({ ...p, [k]: v }))
  const setCh = (i: number, patch: Partial<StudentForm['channels'][number]>) =>
    setF((p) => ({ ...p, channels: p.channels.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))

  const quota = u ? computeQuota(u, getAppointments(), settings) : null

  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (u) await adminUpdateStudent(u.id, f)
      else await adminCreateStudent(f)
      toast(isNew ? 'Öğrenci eklendi' : 'Öğrenci güncellendi')
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const resetWait = async () => {
    if (!u || busy) return
    setBusy(true)
    try {
      await adminResetQuota(u.id)
      toast('Bekleme kaldırıldı, öğrenci şimdi randevu alabilir')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'Yeni öğrenci' : 'Öğrenciyi düzenle'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </>
      }
    >
      <div className="sf">
        {/* 1 — Kişisel */}
        <section className="sf-sec">
          <h4 className="sf-h"><span>1</span> Kişisel bilgiler</h4>
          <div className="form">
            <Field label="Ad soyad">
              <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={isNew} />
            </Field>
            <div className="grid-2">
              <Field label="E-posta">
                <input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="ornek@gmail.com" />
              </Field>
              <Field label="WhatsApp numarası">
                <input className="input" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0537 000 00 00" />
              </Field>
            </div>
            <Field
              label={isNew ? 'Şifre' : 'Yeni şifre (boş bırakırsan değişmez)'}
              hint={
                <>
                  En az 6 karakter. Öğrenciye WhatsApp’tan iletebilirsin.{' '}
                  <button type="button" className="link" onClick={() => set('password', randomPassword())}>Rastgele oluştur</button>
                </>
              }
            >
              <PasswordInput autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} />
            </Field>
          </div>
        </section>

        {/* 2 — YouTube & Skool */}
        <section className="sf-sec">
          <h4 className="sf-h"><span>2</span> YouTube & Skool</h4>
          <label className="toggle-row">
            <div><strong>Skool topluluğunda</strong></div>
            <Switch checked={f.skoolMember} label="Skool topluluğunda" onChange={(v) => set('skoolMember', v)} />
          </label>
          <div className="sf-channels">
            {f.channels.map((c, i) => (
              <div key={c.id ?? `n${i}`} className="sf-ch">
                <div className="sf-ch-top">
                  <span className="sf-ch-ic"><IconVideo size={16} /></span>
                  <input className="input" inputMode="url" value={c.url} onChange={(e) => setCh(i, { url: e.target.value })} placeholder="https://www.youtube.com/@kanaladi" />
                  <button type="button" className="icon-btn danger" aria-label="Kanalı kaldır" onClick={() => set('channels', f.channels.filter((_, j) => j !== i))}>
                    <IconTrash size={16} />
                  </button>
                </div>
                <div className="sf-ch-bottom">
                  <div className="seg seg-sm" role="radiogroup" aria-label="Para kazanma">
                    <button type="button" className={cx('seg-btn', c.monetized && 'active')} onClick={() => setCh(i, { monetized: true })}>Para kazanma açık</button>
                    <button type="button" className={cx('seg-btn', !c.monetized && 'active')} onClick={() => setCh(i, { monetized: false })}>Kapalı</button>
                  </div>
                  <label className="sf-date">
                    <span>Başlangıç</span>
                    <input className="input" type="date" min="2005-01-01" max={dateKey()} value={c.startedOn} onChange={(e) => setCh(i, { startedOn: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-text btn-sm sf-add" onClick={() => set('channels', [...f.channels, newChannel()])}>
              <IconPlus size={16} /> Kanal ekle
            </button>
          </div>
        </section>

        {/* 3 — Randevu hakkı */}
        <section className="sf-sec">
          <h4 className="sf-h"><span>3</span> Randevu hakkı</h4>
          <div className="seg seg-full">
            <button type="button" className={cx('seg-btn', !f.veteran && 'active')} onClick={() => set('veteran', false)}>
              Yeni üye · {settings.introGapDays} günde 1
            </button>
            <button type="button" className={cx('seg-btn', f.veteran && 'active')} onClick={() => set('veteran', true)}>
              Eski öğrenci · {settings.regularGapDays} günde 1
            </button>
          </div>
          {!f.veteran ? (
            <div className="stepper-row">
              <div>
                <strong>Kalan haftalık hak</strong>
                <p className="muted">Bitince otomatik {settings.regularGapDays} günde 1’e geçer.</p>
              </div>
              <div className="stepper">
                <button type="button" aria-label="Azalt" onClick={() => set('introLeft', Math.max(0, f.introLeft - 1))}>−</button>
                <strong>{f.introLeft}<em>/{settings.introBookings}</em></strong>
                <button type="button" aria-label="Artır" onClick={() => set('introLeft', Math.min(settings.introBookings, f.introLeft + 1))}>+</button>
              </div>
            </div>
          ) : (
            <p className="muted small-text">Haftalık hakları kullanmış eski öğrenciler için. Her {settings.regularGapDays} günde 1 randevu oluşturabilir.</p>
          )}
          {quota && !quota.canBook && quota.nextAt && (
            <div className="notice notice-warn sf-wait">
              <IconClock size={16} />
              <span>Şu an beklemede: yeni hakkı <strong>{formatRemaining(quota.nextAt - Date.now())}</strong> sonra açılıyor.</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={resetWait}>Beklemeyi kaldır</button>
            </div>
          )}
        </section>

        {/* 4 — Not */}
        <section className="sf-sec">
          <h4 className="sf-h"><span>4</span> Özel not <em>sadece sen görürsün</em></h4>
          <textarea className="input" rows={2} maxLength={500} value={f.adminNote} onChange={(e) => set('adminNote', e.target.value)} placeholder="Paket bilgisi, hedefler…" />
        </section>
      </div>
    </Modal>
  )
}
