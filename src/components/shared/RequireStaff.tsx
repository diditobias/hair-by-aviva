import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { loading, session, isStaff, profile } = useAuth()
  const location = useLocation()

  if (loading || (session && !profile)) {
    return <div className="admin-loading">Checking access…</div>
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  if (!isStaff) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
