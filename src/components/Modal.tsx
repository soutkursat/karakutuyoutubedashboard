import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from './Icons'
import { cx } from '../lib/ui'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** false ise dışarı tıklayınca / ESC ile kapanmaz */
  dismissible?: boolean
}

export function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, dismissible, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}>
      <div ref={panel} className={cx('modal glass', `modal-${size}`)} role="dialog" aria-modal="true" tabIndex={-1}>
        {(title || dismissible) && (
          <div className="modal-head">
            <h3>{title}</h3>
            {dismissible && (
              <button className="icon-btn" onClick={onClose} aria-label="Kapat">
                <IconX />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
