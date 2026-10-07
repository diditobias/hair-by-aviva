import { type FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { useAuth } from '../../lib/auth'

export function AdminLoginPage() {
  const { signIn, resetPassword, session, isStaff, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session && isStaff) {
    return <Navigate to="/admin" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const result = await signIn(email, password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    // Profile is loaded inside signIn; staff gate runs on /admin
    navigate(from, { replace: true })
  }

  async function onReset() {
    if (!email) {
      setError('Enter your email first.')
      return
    }
    setBusy(true)
    const result = await resetPassword(email)
    setBusy(false)
    if (result.error) setError(result.error)
    else setInfo('Password reset email sent.')
  }

  return (
    <div className="public-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <form className="panel admin-form" style={{ width: 'min(420px, 100%)' }} onSubmit={onSubmit}>
        <div>
          <img className="brand-logo brand-logo--login" src={logo} alt="Hair by Aviva" />
          <div className="eyebrow" style={{ color: 'var(--muted)', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.75rem' }}>
            Owner portal
          </div>
          <h1 className="sr-only">Hair by Aviva</h1>
          <p>Sign in to manage bookings and clients.</p>
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        {info ? <div className="notice ok">{info}</div> : null}
        <label className="field">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={onReset}>
          Reset password
        </button>
        <Link to="/" style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          ← Back to website
        </Link>
      </form>
    </div>
  )
}
