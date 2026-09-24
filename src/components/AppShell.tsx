import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from './Brand'
import { IconLogout, IconMenu, IconX } from './Icons'
import { logout } from '../lib/db'
import type { User } from '../lib/types'
import { cx, initials } from '../lib/ui'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
  badge?: number
}

export function AppShell({ user, nav, area }: { user: User; nav: NavItem[]; area: string }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const navigate = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])

  const doLogout = async () => {
    await logout()
    navigate('/giris', { replace: true })
  }

  return (
    <div className="shell">
      <aside className={cx('sidebar glass', open && 'open')}>
        <div className="sidebar-top">
          <Brand sub={area} />
          <button className="icon-btn only-mobile" onClick={() => setOpen(false)} aria-label="Menüyü kapat">
            <IconX />
          </button>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('nav-item', isActive && 'active')}>
              {n.icon}
              <span>{n.label}</span>
              {!!n.badge && <em className="nav-badge">{n.badge}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initials(user.name)}</span>
          <div className="sidebar-user-text">
            <strong>{user.name}</strong>
            <span>{user.role === 'admin' ? 'Yönetici' : 'Öğrenci'}</span>
          </div>
          <button className="icon-btn" onClick={doLogout} title="Çıkış yap" aria-label="Çıkış yap">
            <IconLogout />
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <div className="topbar only-mobile">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Menüyü aç">
            <IconMenu />
          </button>
          <Brand sub={area} />
          <span className="avatar sm">{initials(user.name)}</span>
        </div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
