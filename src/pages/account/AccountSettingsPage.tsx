import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  }
}

export function AccountSettingsPage() {
  const { updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checks = useMemo(() => passwordChecks(password), [password])
  const passwordOk = checks.length && checks.letter && checks.number

  async function onPassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
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
    setPassword('')
    setConfirm('')
    setMessage('Password updated.')
  }

  async function onLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <section className="account-page">
      <div className="section-head">
        <h2>Settings</h2>
        <p>Password and account preferences.</p>
      </div>

      {message ? <div className="notice ok">{message}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <form className="form-stack auth-form account-panel" onSubmit={onPassword}>
        <h3>Change password</h3>
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

      <div className="account-panel" style={{ marginTop: '1.25rem' }}>
        <h3>Log out</h3>
        <button className="btn btn-ghost" type="button" onClick={onLogout}>
          Log out of this device
        </button>
      </div>

      <div className="account-panel" style={{ marginTop: '1.25rem' }}>
        <h3>Delete account</h3>
        <p className="meta">
          To request account deletion, WhatsApp or email Aviva and she will remove your client
          profile and linked booking history where appropriate.
        </p>
      </div>
    </section>
  )
}
