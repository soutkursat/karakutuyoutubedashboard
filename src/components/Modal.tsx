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
  // onClose sayfalarda her çizimde yeniden oluşturulur; referansta tutuyoruz ki aşağıdaki efekt
  // yalnızca pencere AÇILIRKEN çalışsın. (Aksi halde her tuş vuruşunda odak yazı kutusundan kaçıyordu.)
  const closeRef = useRef(onClose)
  const dismissRef = useRef(dismissible)
  closeRef.current = onClose
  dismissRef.current = dismissible

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissRef.current) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // autoFocus'lu bir alan zaten odak aldıysa ona dokunma
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}>
      <div ref={panel} className={cx('modal glass', `modal-${size}`)} role="dialog" aria-modal="true" tabIndex={-1}>
        {(title || dismissible) && (
          <div className="modal-head">
            <div className="modal-title">{title}</div>
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
