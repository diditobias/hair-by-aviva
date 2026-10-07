import { Link, useLocation, useNavigate } from 'react-router-dom'

export function PageBackNav() {
  const location = useLocation()
  const navigate = useNavigate()

  if (location.pathname === '/') return null

  const canGoBack =
    typeof window !== 'undefined' &&
    ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0

  return (
    <nav className="page-back-nav" aria-label="Page">
      <button
        type="button"
        className="page-back-btn"
        onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
        aria-label={canGoBack ? 'Go back' : 'Go to home'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Back</span>
      </button>
      <Link to="/" className="page-home-link">
        Home
      </Link>
    </nav>
  )
}
