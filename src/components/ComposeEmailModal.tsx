import { useEffect, useState } from 'react'
import { Field } from './Common'
import { IconMail } from './Icons'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { adminSendEmail, getMailStatus, loadMailStatus } from '../lib/db'
import { useDataVersion } from '../lib/hooks'
import type { User } from '../lib/types'
import { errMsg } from '../lib/ui'

/**
 * Yönetici → öğrenci(ler) e-postası (kursat@ adresinden). Her öğrenciye ayrı e-posta gider; alıcılar birbirini görmez.
 * Ebeveyn bunu sadece açıkken çizer (form her açılışta sıfırlanır).
 */
export function ComposeEmailModal({ recipients, scope, onClose }: { recipients: User[]; scope: string; onClose: () => void }) {
  useDataVersion()
  const toast = useToast()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const m = getMailStatus()
  const list = recipients.filter((u) => u.status === 'active' && u.email)
  const skipped = recipients.length - list.length

  useEffect(() => {
    if (!getMailStatus()) void loadMailStatus()
  }, [])

  const send = async () => {
    if (busy) return
    if (list.length > 1 && !window.confirm(`${list.length} öğrenciye e-posta gönderilsin mi?`)) return
    setBusy(true)
    setDone(0)
    try {
      const r = await adminSendEmail(list.map((u) => u.id), subject, body, setDone)
      if (r.sent) toast(r.sent === 1 ? 'E-posta gönderildi' : `${r.sent} öğrenciye e-posta gönderildi`)
      if (r.failed.length) {
        const names = r.failed.map((f) => list.find((u) => u.id === f.id)?.name ?? '?').slice(0, 3).join(', ')
        toast(`${r.failed.length} kişiye gönderilemedi (${names}${r.failed.length > 3 ? '…' : ''}): ${r.failed[0].error}`, 'error')
      }
      if (r.sent) onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const notReady = !!m && !m.adminReady

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      dismissible={!busy}
      title={<span className="title-ic"><IconMail size={18} /> E-posta gönder</span>}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Vazgeç</button>
          <button className="btn btn-primary" disabled={busy || notReady || !list.length || !subject.trim() || !body.trim()} onClick={send}>
            {busy ? `Gönderiliyor… ${done}/${list.length}` : list.length > 1 ? `${list.length} kişiye gönder` : 'Gönder'}
          </button>
        </>
      }
    >
      <div className="mail-meta">
        <div><span>Kimden</span><strong>{m?.adminAddress ?? 'kursat@karakutuyoutube.com'}</strong></div>
        <div>
          <span>Kime</span>
          <strong>
            {list.length === 1 ? `${list[0].name} · ${list[0].email}` : `${scope} · ${list.length} öğrenci`}
          </strong>
        </div>
      </div>
      {list.length > 1 && (
        <p className="muted small-text">Her öğrenciye ayrı e-posta gider, alıcılar birbirini görmez. Öğrenciler yanıtladığında yanıt senin adresine gelir.</p>
      )}
      {skipped > 0 && <p className="muted small-text">Askıdaki {skipped} hesap listeye alınmadı.</p>}
      {notReady && (
        <div className="notice notice-warn">E-posta adresin henüz kurulmadı. Ayarlar → E-posta kartındaki adımları tamamla.</div>
      )}
      <Field label="Konu">
        <input className="input" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} placeholder="Ör. Bu haftaki canlı yayın saati" />
      </Field>
      <Field label="Mesaj" hint={`Her e-posta “Merhaba {ad},” ile başlar, sonuna imzan eklenir. Paragraf için bir satır boş bırak. ${body.length}/5000`}>
        <textarea className="input" rows={8} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
    </Modal>
  )
}
