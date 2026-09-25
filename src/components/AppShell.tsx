import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from './Brand'
import { IconMenu, IconX } from './Icons'
import { UserMenu } from './UserMenu'
import type { User } from '../lib/types'
import { cx } from '../lib/ui'

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
  useEffect(() => setOpen(false), [loc.pathname])

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
        <UserMenu user={user} variant="sidebar" />
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <div className="topbar only-mobile">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Menüyü aç">
            <IconMenu />
          </button>
          <Brand sub={area} />
          <UserMenu user={user} variant="topbar" />
        </div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
