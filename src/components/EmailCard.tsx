import { useEffect, useState } from 'react'
import { Switch } from './Common'
import { IconCheck, IconMail } from './Icons'
import { useToast } from './Toast'
import { getMailLoadError, getMailStatus, loadMailStatus, sendTestEmail } from '../lib/db'
import { useDataVersion } from '../lib/hooks'
import { errMsg } from '../lib/ui'

/** Yönetici: e-posta (SMTP) durumu, test gönderimi ve otomatik randevu e-postaları anahtarı */
export function EmailCard({ autoEmails, onAutoEmails }: { autoEmails: boolean; onAutoEmails: (v: boolean) => void }) {
  useDataVersion()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const m = getMailStatus()
  const loadError = getMailLoadError()

  useEffect(() => {
    void loadMailStatus()
  }, [])

  const test = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await sendTestEmail()
      for (const x of r.results) {
        if (x.ok) toast(`${x.from} → ${r.to} gönderildi`)
        else toast(`${x.from}: ${x.error}`, 'error')
      }
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const row = (label: string, desc: string, ready: boolean, address: string | null) => (
    <div className="mail-box">
      <div>
        <strong>{address ?? label}</strong>
        <span className="muted">{desc}</span>
      </div>
      {ready ? <span className="badge badge-confirmed"><IconCheck size={12} />&nbsp;Hazır</span> : <span className="badge badge-pending">Kurulmadı</span>}
    </div>
  )

  return (
    <section className="card glass">
      <h3 className="card-title"><IconMail size={18} /> E-posta</h3>
      {!m && !loadError && <p className="muted">Durum yükleniyor…</p>}
      {loadError && <div className="notice">{loadError}</div>}
      {m && (
        <div className="form">
          {row('Sistem adresi', 'Onay, erteleme ve iptal bildirimleri', m.systemReady, m.systemAddress)}
          {row('Senin adresin', 'Öğrenciler sayfasından yazdığın e-postalar', m.adminReady, m.adminAddress)}
          {(!m.systemReady || !m.adminReady) && (
            <div className="notice notice-warn">
              <div>
                Natro’daki e-posta hesaplarının bilgilerini Vercel → Settings → Environment Variables’a ekleyip Redeploy et:{' '}
                <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_SYSTEM_USER</code>, <code>SMTP_SYSTEM_PASS</code>,{' '}
                <code>SMTP_ADMIN_USER</code>, <code>SMTP_ADMIN_PASS</code>.
              </div>
            </div>
          )}
          <label className="toggle-row">
            <div>
              <strong>Randevu e-postalarını otomatik gönder</strong>
              <p className="muted">Onaylayınca, ertelediğinde ya da iptal ettiğinde öğrenciye e-posta gider. Kaydetmeyi unutma.</p>
            </div>
            <Switch checked={autoEmails} label="Randevu e-postalarını otomatik gönder" onChange={onAutoEmails} />
          </label>
          {(m.systemReady || m.adminReady) && (
            <button className="btn btn-ghost" disabled={busy} onClick={test}>
              <IconMail size={16} /> {busy ? 'Gönderiliyor…' : 'Kendime test e-postası gönder'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
