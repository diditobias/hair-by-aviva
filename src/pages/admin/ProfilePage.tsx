import { type FormEvent, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

export function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq('id', user.id)
    if (error) {
      setBusy(false)
      setMessage(error.message)
      return
    }
    if (password) {
      const { error: pwErr } = await supabase.auth.updateUser({ password })
      if (pwErr) {
        setBusy(false)
        setMessage(pwErr.message)
        return
      }
      setPassword('')
    }
    await refreshProfile()
    setBusy(false)
    setMessage('Profile updated.')
  }

  return (
    <>
      <div className="admin-topbar">
        <h1>Profile</h1>
      </div>
      <form className="panel admin-form" onSubmit={onSubmit}>
        {message ? <div className={message.includes('updated') ? 'notice ok' : 'notice error'}>{message}</div> : null}
        <div className="kv">
          <span>Login email</span>
          <strong>{profile?.email ?? user?.email}</strong>
        </div>
        <div className="kv">
          <span>Role</span>
          <strong>{profile?.role}</strong>
        </div>
        <div className="row two">
          <label className="field">
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="field">
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
        </div>
        <label className="field">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="field">
          New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep" />
        </label>
        <button className="btn btn-primary" disabled={busy} type="submit">
          Save profile
        </button>
      </form>
    </>
  )
}
