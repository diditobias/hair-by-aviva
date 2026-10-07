import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const navItems = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/offers', label: 'Offers' },
  { to: '/account/appointments', label: 'My Appointments' },
  { to: '/account/availability', label: 'Available times' },
  { to: '/book', label: 'Book Appointment' },
  { to: '/account/profile', label: 'My Details' },
  { to: '/account/settings', label: 'Settings' },
]

export function AccountLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="account-shell">
      <aside className="account-nav" aria-label="Account">
        <p className="account-nav-title">My account</p>
        <nav className="account-nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
          <button type="button" className="account-logout" onClick={onLogout}>
            Log out
          </button>
        </nav>
      </aside>
      <div className="account-main">
        <Outlet />
      </div>
    </div>
  )
}
