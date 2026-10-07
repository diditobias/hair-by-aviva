import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { useAuth } from '../../lib/auth'
import './admin.css'

const sideLinks = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/calendar', label: 'Calendar' },
  { to: '/admin/bookings', label: 'All Bookings' },
  { to: '/admin/bookings?filter=requested', label: 'New Requests' },
  { to: '/admin/bookings?filter=upcoming', label: 'Upcoming' },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/enquiries', label: 'Enquiries' },
  { to: '/admin/services', label: 'Services' },
  { to: '/admin/offers', label: 'Offers' },
  { to: '/admin/gallery', label: 'Gallery' },
  { to: '/admin/testimonials', label: 'Testimonials' },
  { to: '/admin/availability', label: 'Availability' },
  { to: '/admin/settings', label: 'Settings' },
  { to: '/admin/profile', label: 'Profile' },
]

export function AdminLayout() {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img className="brand-logo brand-logo--sidebar" src={logo} alt="Hair by Aviva" />
          <div className="eyebrow">Owner portal</div>
          <span className="sr-only">Hair by Aviva</span>
        </div>
        <nav className="admin-nav" aria-label="Admin">
          <div className="group-label">Manage</div>
          {sideLinks.slice(0, 5).map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
          <div className="group-label">People</div>
          {sideLinks.slice(5, 7).map((l) => (
            <NavLink key={l.to} to={l.to}>
              {l.label}
            </NavLink>
          ))}
          <div className="group-label">Content</div>
          {sideLinks.slice(7, 12).map((l) => (
            <NavLink key={l.to} to={l.to}>
              {l.label}
            </NavLink>
          ))}
          <div className="group-label">Account</div>
          {sideLinks.slice(12).map((l) => (
            <NavLink key={l.to} to={l.to}>
              {l.label}
            </NavLink>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: '#f7efe6', borderColor: 'rgba(255,255,255,0.2)', marginTop: '0.5rem' }}
            onClick={async () => {
              await signOut()
              navigate('/admin/login')
            }}
          >
            Log out
          </button>
        </nav>
        <p className="eyebrow" style={{ marginTop: 'auto' }}>
          {profile?.first_name || profile?.email || 'Owner'}
        </p>
      </aside>

      <div className="admin-main">
        <Outlet />
      </div>

      <nav className="admin-bottom-nav" aria-label="Mobile admin">
        <NavLink to="/admin" end>
          <span className="icon">⌂</span>
          Dashboard
        </NavLink>
        <NavLink to="/admin/calendar">
          <span className="icon">▦</span>
          Calendar
        </NavLink>
        <NavLink to="/admin/bookings/new" className="fab">
          <span className="icon">＋</span>
          Booking
        </NavLink>
        <NavLink to="/admin/availability">
          <span className="icon">◷</span>
          Availability
        </NavLink>
        <NavLink to="/admin/bookings?filter=requested">
          <span className="icon">☰</span>
          More
        </NavLink>
      </nav>
    </div>
  )
}
