import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { currentUser, isReady } from '../lib/db'
import { Loader } from './Screens'
import { useDataVersion } from '../lib/hooks'
import type { Role, User } from '../lib/types'

/** Oturum yoksa girişe, rol uymuyorsa kendi paneline yönlendirir. */
export function Guard({ role, children }: { role: Role; children: (u: User) => ReactNode }) {
  useDataVersion()
  if (!isReady()) return <Loader />
  const u = currentUser()
  if (!u) return <Navigate to="/giris" replace />
  if (u.role !== role) return <Navigate to={u.role === 'admin' ? '/yonetim' : '/panel'} replace />
  return <>{children(u)}</>
}

export function homeFor(u: User | null) {
  return !u ? '/giris' : u.role === 'admin' ? '/yonetim' : '/panel'
}
