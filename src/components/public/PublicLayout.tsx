import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'
import { useAuth } from '../../lib/auth'
import { whatsappLink } from '../../lib/format'
import './public.css'

const primaryLinks = [
  { to: '/services', label: 'Services' },
  { to: '/ideas', label: 'Ideas' },
  { to: '/offers', label: 'Offers' },
]

export function PublicLayout() {
  const { settings } = useBusinessSettings()
  const { session, isStaff, loading: authLoading } = useAuth()
  const showAdmin = !authLoading && isStaff
  const wa = whatsappLink(
    settings?.whatsapp ?? settings?.phone ?? '+27725783392',
    'Hi Aviva, I found you via Hair by Aviva.',
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)

  const accountHref = !session ? '/login' : showAdmin ? '/admin' : '/account'
  const accountLabel = !session ? 'Log In' : showAdmin ? 'Admin' : 'My Account'

  const menuLinks = [
    { to: '/', label: 'Home', end: true },
    { to: '/offers', label: 'Offers' },
    { to: '/gallery', label: 'Gallery' },
    { to: '/ideas', label: 'Ideas' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact us' },
    { to: '/availability', label: 'Available times' },
    { to: '/book', label: 'Book' },
    ...(showAdmin
      ? [{ to: '/admin', label: 'Admin' }]
      : session
        ? [
            { to: '/account', label: 'My Account' },
            { to: '/account/offers', label: 'Offers' },
            { to: '/account/appointments', label: 'My Appointments' },
            { to: '/account/settings', label: 'Settings' },
          ]
        : [
            { to: '/login', label: 'Log In' },
            { to: '/signup', label: 'Create Account' },
          ]),
  ]

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="public-shell">
      {settings?.announcement_banner ? (
        <div className="announcement">{settings.announcement_banner}</div>
      ) : null}

      <header className="public-nav">
        <div className={`nav-dropdown${menuOpen ? ' is-open' : ''}`} ref={menuRef}>
          <button
            type="button"
            className="nav-hamburger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div id={menuId} className="nav-dropdown-panel" role="menu" hidden={!menuOpen}>
            {menuLinks.map((l) => (
              <NavLink
                key={`${l.to}-${l.label}`}
                to={l.to}
                end={l.end}
                role="menuitem"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>

        <NavLink to="/" className="brand">
          <img className="brand-logo" src={logo} alt="Hair by Aviva" />
          <span className="sr-only">Hair by Aviva</span>
        </NavLink>

        <nav className="public-nav-links" aria-label="Primary">
          {primaryLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="public-nav-actions">
          {wa ? (
            <a className="btn btn-ghost" href={wa} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : null}
          {!session ? (
            <NavLink className="btn btn-ghost nav-login-btn" to="/login">
              Log In
            </NavLink>
          ) : (
            <NavLink className="btn btn-ghost nav-login-btn" to={accountHref}>
              {accountLabel}
            </NavLink>
          )}
          <NavLink className="btn btn-primary" to="/book">
            Book
          </NavLink>
        </div>
      </header>

      <Outlet />

      <footer className="public-footer">
        <div>
          <img className="brand-logo brand-logo--footer" src={logo} alt="Hair by Aviva" />
          <p>{settings?.tagline ?? 'Beautiful hair, at home or in studio — Johannesburg'}</p>
          <p className="meta">Johannesburg, South Africa</p>
        </div>
        <div className="footer-links">
          <NavLink to="/ideas">Ideas</NavLink>
          <NavLink to="/offers">Offers</NavLink>
          <NavLink to="/faq">FAQs</NavLink>
          <NavLink to="/policies">Policies</NavLink>
          <NavLink to="/availability">Available times</NavLink>
          <NavLink to="/enquiry">Enquiry</NavLink>
          <NavLink to={accountHref}>{accountLabel}</NavLink>
          {settings?.instagram ? (
            <a href={settings.instagram} target="_blank" rel="noreferrer">
              Instagram
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
