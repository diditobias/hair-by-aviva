import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  }
}

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checks = useMemo(() => passwordChecks(password), [password])
  const passwordOk = checks.length && checks.letter && checks.number

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
    setBusy(true)
    const result = await updatePassword(password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <section className="section section-narrow auth-page">
        <div className="section-head">
          <h2>Password updated</h2>
          <p>Your new password is ready to use.</p>
        </div>
        <Link className="btn btn-primary" to="/account">
          Continue to My Account
        </Link>
      </section>
    )
  }

  return (
    <section className="section section-narrow auth-page">
      <div className="section-head">
        <h2>Choose a new password</h2>
        <p>Use a password you haven&apos;t used elsewhere.</p>
      </div>

      <form className="form-stack auth-form" onSubmit={onSubmit}>
        {error ? <div className="notice error">{error}</div> : null}

        <label className="field">
          New password
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

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </section>
  )
}
