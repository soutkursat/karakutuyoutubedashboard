import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
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
