import { type FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { hasBookingDraft } from '../../lib/bookingDraft'
import { supabase } from '../../lib/supabase'

export function LoginPage() {
  const { session, signIn, isStaff, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function resolvePath(staff: boolean) {
    if (fromState) return fromState
    if (hasBookingDraft()) return '/book'
    return staff ? '/admin' : '/account'
  }

  if (!loading && session) {
    return <Navigate to={resolvePath(isStaff)} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await signIn(email, password)
    if (result.error) {
      setBusy(false)
      setError(result.error)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    let staff = false
    if (userData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle()
      staff = profile?.role === 'owner' || profile?.role === 'admin'
    }

    setBusy(false)
    navigate(resolvePath(staff), { replace: true })
  }

  return (
    <section className="section section-narrow auth-page">
      <div className="section-head">
        <h2>Welcome back</h2>
        <p>Sign in to manage appointments, announcements, and offers.</p>
      </div>

      <form className="form-stack auth-form" onSubmit={onSubmit}>
        {error ? <div className="notice error">{error}</div> : null}

        <label className="field">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          Password
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </button>

        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/signup" state={{ from: fromState }}>
            Create an account
          </Link>
        </div>
      </form>
    </section>
  )
}
