import { type FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { hasBookingDraft } from '../../lib/bookingDraft'

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  }
}

export function SignupPage() {
  const { session, signUp, isStaff, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (location.state as { from?: string } | null)?.from

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const checks = useMemo(() => passwordChecks(password), [password])
  const passwordOk = checks.length && checks.letter && checks.number

  function postAuthPath() {
    if (fromState) return fromState
    if (hasBookingDraft()) return '/book'
    return '/account'
  }

  if (!loading && session) {
    return <Navigate to={isStaff ? '/admin' : postAuthPath()} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!passwordOk) {
      setError('Please meet the password requirements.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!acceptedTerms) {
      setError('Please accept the terms to continue.')
      return
    }

    setBusy(true)
    const result = await signUp({
      email,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
    })
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/verify-email', { replace: true, state: { email } })
  }

  return (
    <section className="section section-narrow auth-page">
      <div className="section-head">
        <h2>Create your Hair by Aviva account</h2>
        <p>Track appointments, get announcements, and claim deals and visit rewards.</p>
      </div>

      <form className="form-stack auth-form" onSubmit={onSubmit}>
        {error ? <div className="notice error">{error}</div> : null}

        <div className="form-row two">
          <label className="field">
            First name
            <input
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="field">
            Last name
            <input
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
        </div>

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
          Mobile
          <input
            type="tel"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>

        <label className="field">
          Password
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
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

        <ul className="password-reqs">
          <li className={checks.length ? 'ok' : undefined}>At least 8 characters</li>
          <li className={checks.letter ? 'ok' : undefined}>Includes a letter</li>
          <li className={checks.number ? 'ok' : undefined}>Includes a number</li>
        </ul>

        <label className="field">
          Confirm password
          <input
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        <label className="auth-check">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <span>
            I agree to the{' '}
            <Link to="/policies" target="_blank">
              booking policies
            </Link>
            .
          </span>
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <div className="auth-links">
          <Link to="/login" state={{ from: fromState }}>
            Already have an account? Log in
          </Link>
        </div>
      </form>
    </section>
  )
}
