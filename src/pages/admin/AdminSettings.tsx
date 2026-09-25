import { useState } from 'react'
import { Field, PageHeader, Switch } from '../../components/Common'
import { IconDownload, IconPlus, IconShield, IconWhatsapp } from '../../components/Icons'
import { useToast } from '../../components/Toast'
import { exportData, getSettings, saveSettings } from '../../lib/db'
import type { Settings } from '../../lib/types'
import { errMsg } from '../../lib/ui'
import { formatPhone } from '../../lib/validation'

export function AdminSettings() {
  const toast = useToast()
  const [s, setS] = useState<Settings>(() => structuredClone(getSettings()))
  const [topic, setTopic] = useState('')
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }))

  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await saveSettings(structuredClone(s))
      setS(structuredClone(getSettings()))
      toast('Ayarlar kaydedildi')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `karakutu-yedek-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader eyebrow="Yönetim" title="Ayarlar" actions={<button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>} />
      <div className="grid-2 align-start">
        <section className="card glass">
          <h3 className="card-title"><IconWhatsapp size={18} /> Bildirim & görüşme</h3>
          <div className="form">
            <Field label="WhatsApp bildirim numarası" hint={`Öğrenci mesajları buraya gelir · ${formatPhone(s.whatsappNumber.replace(/\D/g, ''))}`}>
              <input className="input" type="tel" value={s.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} />
            </Field>
            <Field label="Varsayılan Google Meet linki" hint="Google Takvim bağlıysa boş bırak: her randevuya otomatik yeni Meet linki oluşur. Bağlı değilse sabit Meet odanı yazabilirsin.">
              <input className="input" value={s.defaultMeetLink} onChange={(e) => set('defaultMeetLink', e.target.value)} placeholder="https://meet.google.com/..." />
            </Field>
            <div className="toggle-row">
              <div><strong>Randevuları otomatik onayla</strong><p className="muted">Kapalıysa her randevuyu sen onaylarsın.</p></div>
              <Switch checked={s.autoConfirm} onChange={(v) => set('autoConfirm', v)} />
            </div>
            <Field label="Öğrenci iptal limiti (saat)" hint="Görüşmeye bundan az kala öğrenci iptal edemez.">
              <input className="input" type="number" min={0} max={168} value={s.cancelLimitHours} onChange={(e) => set('cancelLimitHours', Number(e.target.value))} />
            </Field>
          </div>
        </section>

        <section className="card glass">
          <h3 className="card-title"><IconShield size={18} /> Kayıt & erişim</h3>
          <div className="form">
            <div className="toggle-row">
              <div><strong>Yeni kayıtlara açık</strong><p className="muted">Kapatırsan öğrenci hesaplarını sadece sen açarsın.</p></div>
              <Switch checked={s.registrationOpen} onChange={(v) => set('registrationOpen', v)} />
            </div>
            <Field label="Davet kodu" hint="Doluysa kayıt olurken bu kod istenir. Sadece mentörlük alanlar kayıt olabilsin.">
              <input className="input" value={s.inviteCode} onChange={(e) => set('inviteCode', e.target.value)} placeholder="Ör. KARAKUTU2026" />
            </Field>
          </div>
        </section>

        <section className="card glass">
          <h3 className="card-title">Görüşme konuları</h3>
          <div className="chips">
            {s.topics.map((t) => (
              <span key={t} className="chip static">
                {t}
                <button aria-label="Kaldır" onClick={() => set('topics', s.topics.filter((x) => x !== t))}>×</button>
              </span>
            ))}
          </div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              const v = topic.trim()
              if (v && !s.topics.includes(v)) set('topics', [...s.topics, v])
              setTopic('')
            }}
          >
            <input className="input" value={topic} maxLength={60} onChange={(e) => setTopic(e.target.value)} placeholder="Yeni konu" />
            <button className="btn btn-ghost"><IconPlus size={16} /> Ekle</button>
          </form>
        </section>

        <section className="card glass">
          <h3 className="card-title"><IconDownload size={18} /> Yedek</h3>
          <p className="muted">
            Veriler Supabase’de güvenle saklanıyor. İstersen öğrenci ve randevu listesinin bir kopyasını
            JSON olarak indirebilirsin.
          </p>
          <button className="btn btn-ghost" onClick={download}><IconDownload size={16} /> JSON yedeği indir</button>
        </section>
      </div>
    </>
  )
}
