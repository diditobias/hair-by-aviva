import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export function AccountLoginPage() {
  const { session, signIn, isStaff } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    return <Navigate to={isStaff ? '/admin' : '/account'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    if (mode === 'login') {
      const result = await signIn(email, password)
      setBusy(false)
      if (result.error) setError(result.error)
      else navigate('/account')
      return
    }

    const [first_name, ...rest] = fullName.trim().split(' ')
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name, last_name: rest.join(' ') } },
    })
    setBusy(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    setInfo('Account created. You can manage appointments and your details from My account.')
    navigate('/account')
  }

  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>My account</h2>
        <p>
          Sign in to view appointments, update account settings, and request reschedules. You can still book
          without an account.
        </p>
      </div>
      <form className="form-stack" onSubmit={onSubmit}>
        {error ? <div className="notice error">{error}</div> : null}
        {info ? <div className="notice ok">{info}</div> : null}
        <div className="action-row">
          <button
            type="button"
            className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>
        {mode === 'register' ? (
          <label className="field">
            Full name
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
        ) : null}
        <label className="field">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <Link to="/book">Continue without account → Request booking</Link>
          <Link to="/contact">Need help? Contact Aviva</Link>
        </div>
      </form>
    </section>
  )
}
