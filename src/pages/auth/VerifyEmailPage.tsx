import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function VerifyEmailPage() {
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function resend() {
    if (!email) {
      setMessage('Return to sign up and enter your email to resend.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setBusy(false)
    setMessage(error ? error.message : 'Verification email resent. Check your inbox.')
  }

  return (
    <section className="section section-narrow auth-page">
      <div className="section-head">
        <h2>Check your inbox</h2>
        <p>
          We&apos;ve sent a verification link
          {email ? (
            <>
              {' '}
              to <strong>{email}</strong>
            </>
          ) : null}
          . Open it to activate your account.
        </p>
      </div>

      {message ? <div className="notice">{message}</div> : null}

      <div className="auth-verify-actions">
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={resend}>
          {busy ? 'Sending…' : 'Resend verification email'}
        </button>
        <Link className="btn btn-primary" to="/login">
          Return to log in
        </Link>
      </div>
    </section>
  )
}
