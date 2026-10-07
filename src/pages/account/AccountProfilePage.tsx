import { type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useClientBookings } from './useClientBookings'

export function AccountProfilePage() {
  const { client, setClient } = useClientBookings()
  const [details, setDetails] = useState({
    full_name: '',
    phone: '',
    email: '',
    suburb: '',
    preferred_contact: 'whatsapp',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!client) return
    setDetails({
      full_name: client.full_name,
      phone: client.phone ?? '',
      email: client.email ?? '',
      suburb: client.suburb ?? '',
      preferred_contact: client.preferred_contact ?? 'whatsapp',
    })
  }, [client])

  async function saveDetails(e: FormEvent) {
    e.preventDefault()
    if (!client) return
    setBusy(true)
    setMessage(null)
    const { data, error } = await supabase
      .from('clients')
      .update({
        full_name: details.full_name,
        phone: details.phone || null,
        email: details.email || null,
        suburb: details.suburb || null,
        preferred_contact: details.preferred_contact as 'phone' | 'whatsapp' | 'email',
      })
      .eq('id', client.id)
      .select('*')
      .single()
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setClient(data)
    setMessage('Details saved.')
  }

  return (
    <section className="account-page">
      <div className="section-head">
        <h2>My details</h2>
        <p>Keep your contact information up to date for bookings.</p>
      </div>

      {message ? <div className="notice">{message}</div> : null}

      <form className="form-stack auth-form" onSubmit={saveDetails}>
        <label className="field">
          Name
          <input
            required
            value={details.full_name}
            onChange={(e) => setDetails({ ...details, full_name: e.target.value })}
          />
        </label>
        <label className="field">
          Phone
          <input
            value={details.phone}
            onChange={(e) => setDetails({ ...details, phone: e.target.value })}
          />
        </label>
        <label className="field">
          Email
          <input
            type="email"
            value={details.email}
            onChange={(e) => setDetails({ ...details, email: e.target.value })}
          />
        </label>
        <label className="field">
          Default suburb / area
          <input
            value={details.suburb}
            onChange={(e) => setDetails({ ...details, suburb: e.target.value })}
          />
        </label>
        <label className="field">
          Preferred contact
          <select
            value={details.preferred_contact}
            onChange={(e) => setDetails({ ...details, preferred_contact: e.target.value })}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || !client}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </section>
  )
}
