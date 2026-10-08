import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import type { AppointmentStatus } from '../lib/types'
import { STATUS_LABEL, cx } from '../lib/ui'
import { IconEye, IconEyeOff } from './Icons'

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={cx('badge', `badge-${status}`)}>{STATUS_LABEL[status]}</span>
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <div className="input-wrap">
      <input {...props} type={show ? 'text' : 'password'} className="input" />
      <button type="button" className="input-addon" onClick={() => setShow((s) => !s)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}>
        {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </button>
    </div>
  )
}

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow?: string; title: ReactNode; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {desc && <p className="muted">{desc}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ic">{icon}</div>
      <strong>{title}</strong>
      {desc && <p className="muted">{desc}</p>}
      {action}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={cx('switch', checked && 'on')} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

/** 'YYYY-MM-DD' → 'GG.AA.YYYY' */
const keyToText = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(k) ? `${k.slice(8, 10)}.${k.slice(5, 7)}.${k.slice(0, 4)}` : k)

/** Rakamlardan GG.AA.YYYY maskesi (noktalar otomatik) */
function maskDate(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('.')
}

/** 'GG.AA.YYYY' tamamsa ve gerçek bir günse 'YYYY-MM-DD', değilse null */
function textToKey(t: string) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(t)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const key = `${yyyy}-${mm}-${dd}`
  const d = new Date(key + 'T00:00:00Z')
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key ? key : null
}

/**
 * Yazılarak girilen tarih (GG.AA.YYYY). Telefonlarda tarayıcının tarih seçicisi yerine sayı klavyesi açılır;
 * eski bir yılı seçmek için takvimde aylarca geri gitmek gerekmez.
 * onChange: geçerli tarihte 'YYYY-MM-DD', boşsa '', yarım/hatalıysa yazılan metin (kaydederken doğrulama hata verir).
 */
export function DateInput({ value, onChange, min, max }: { value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  const [text, setText] = useState(() => keyToText(value))
  // Değer dışarıdan değişirse (ör. form sıfırlandı) metni eşitle
  useEffect(() => {
    if (value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setText((t) => (textToKey(t) === value || (value === '' && t === '') ? t : keyToText(value)))
    }
  }, [value])
  const key = textToKey(text)
  const outOfRange = !!key && ((!!min && key < min) || (!!max && key > max))
  const incomplete = text.length > 0 && !key
  return (
    <>
      <input
        className={cx('input', (outOfRange || (incomplete && text.length === 10)) && 'input-error')}
        inputMode="numeric"
        autoComplete="off"
        placeholder="GG.AA.YYYY"
        maxLength={10}
        value={text}
        onChange={(e) => {
          const t = maskDate(e.target.value)
          setText(t)
          onChange(t === '' ? '' : (textToKey(t) ?? t))
        }}
      />
      {(outOfRange || (incomplete && text.length === 10)) && (
        <span className="field-hint danger">{outOfRange ? 'Bu tarih seçilebilecek aralığın dışında.' : 'Böyle bir tarih yok.'}</span>
      )}
    </>
  )
}
