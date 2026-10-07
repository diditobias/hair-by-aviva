import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const NEUTRAL_MESSAGE =
  "If an account exists for that email, you'll receive password reset instructions shortly. Check your inbox and spam folder."

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    await resetPassword(email.trim())
    setBusy(false)
    setSent(true)
  }

  return (
    <section className="section section-narrow auth-page">
      <div className="section-head">
        <h2>Reset your password</h2>
        <p>Enter the email linked to your account and we&apos;ll send reset instructions.</p>
      </div>

      {sent ? (
        <div className="notice ok">{NEUTRAL_MESSAGE}</div>
      ) : (
        <form className="form-stack auth-form" onSubmit={onSubmit}>
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
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <div className="auth-links" style={{ marginTop: '1.25rem' }}>
        <Link to="/login">Return to log in</Link>
      </div>
    </section>
  )
}
