import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconLogout, IconUser } from './Icons'
import { ThemePicker } from './ThemePicker'
import { logout } from '../lib/db'
import type { User } from '../lib/types'
import { cx, initials } from '../lib/ui'

/** Kullanıcı kartı + açılır menü (Profili düzenle · Tema · Çıkış yap) */
export function UserMenu({ user, variant }: { user: User; variant: 'sidebar' | 'topbar' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const loc = useLocation()
  const navigate = useNavigate()
  const profilePath = user.role === 'admin' ? '/yonetim/profil' : '/panel/profil'

  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const doLogout = async () => {
    await logout()
    navigate('/giris', { replace: true })
  }

  return (
    <div ref={ref} className={cx('umenu', `umenu-${variant}`, open && 'open')}>
      {variant === 'sidebar' ? (
        <button type="button" className="sidebar-user" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="avatar">{initials(user.name)}</span>
          <span className="sidebar-user-text">
            <strong>{user.name}</strong>
            <span>{user.role === 'admin' ? 'Yönetici' : 'Öğrenci'}</span>
          </span>
          <svg className="umenu-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m7 15 5-5 5 5" />
          </svg>
        </button>
      ) : (
        <button type="button" className="avatar sm umenu-avatar" aria-label="Hesap menüsü" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {initials(user.name)}
        </button>
      )}

      {open && (
        <div className="umenu-pop glass" role="menu">
          <div className="umenu-head">
            <span className="avatar sm">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email || user.username}</span>
            </div>
          </div>
          <Link to={profilePath} className="umenu-item" role="menuitem">
            <IconUser size={17} /> Profili düzenle
          </Link>
          <div className="umenu-sec">
            <span className="umenu-label">Tema</span>
            <ThemePicker compact />
          </div>
          <button type="button" className="umenu-item danger" role="menuitem" onClick={doLogout}>
            <IconLogout size={17} /> Çıkış yap
          </button>
        </div>
      )}
    </div>
  )
}
