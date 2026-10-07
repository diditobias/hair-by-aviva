import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-shell">
        <p>Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
