import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Booking, Client } from '../../lib/types'
import { BookingStatusBadge } from '../../components/shared/StatusBadge'
import { formatDate, formatDateTime, formatTime, statusLabel } from '../../lib/format'

/** Client portal — only own bookings via RLS + client_bookings-safe columns */
export function AccountPage() {
  const { user, profile, signOut } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState({
    full_name: '',
    phone: '',
    email: '',
    suburb: '',
    preferred_contact: 'whatsapp' as 'phone' | 'whatsapp' | 'email',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const { data: clientRow } = await supabase
        .from('clients')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      let c = clientRow as Client | null
      if (!c) {
        const { data: created } = await supabase
          .from('clients')
          .insert({
            auth_user_id: user.id,
            full_name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Client',
            email: profile?.email ?? user.email,
            phone: profile?.phone,
          })
          .select('*')
          .single()
        c = created as Client
      }

      setClient(c)
      setDetails({
        full_name: c.full_name,
        phone: c.phone ?? '',
        email: c.email ?? '',
        suburb: c.suburb ?? '',
        preferred_contact: c.preferred_contact ?? 'whatsapp',
      })

      // Client-safe columns only — never select admin_notes or customer_address
      const { data: rows } = await supabase
        .from('bookings')
        .select(
          'id, client_id, service_id, booking_type, booking_source, requested_date, requested_time, confirmed_start, confirmed_end, alternative_date, alternative_time, suburb, number_of_people, customer_notes, client_message, status, created_at, updated_at, services(name, duration_minutes)',
        )
        .eq('client_id', c.id)
        .order('requested_date', { ascending: false })

      setBookings(((rows as unknown) as Booking[]) ?? [])
      setLoading(false)
    })()
  }, [user, profile])

  async function saveDetails(e: FormEvent) {
    e.preventDefault()
    if (!client) return
    setSaving(true)
    const { error } = await supabase
      .from('clients')
      .update({
        full_name: details.full_name,
        phone: details.phone || null,
        email: details.email || null,
        suburb: details.suburb || null,
        preferred_contact: details.preferred_contact,
      })
      .eq('id', client.id)
    setSaving(false)
    setMessage(error ? error.message : 'Account settings saved.')
  }

  async function requestReschedule(bookingId: string) {
    const date = window.prompt('Preferred new date (YYYY-MM-DD)')
    const time = window.prompt('Preferred new time (HH:MM)')
    if (!date || !time) return
    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'reschedule_requested',
        alternative_date: date,
        alternative_time: time,
      })
      .eq('id', bookingId)
    setMessage(error ? error.message : 'Reschedule requested. Aviva will confirm.')
    if (!error) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: 'reschedule_requested', alternative_date: date, alternative_time: time }
            : b,
        ),
      )
    }
  }

  async function requestCancel(bookingId: string) {
    if (!window.confirm('Request cancellation for this appointment?')) return
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
    setMessage(error ? error.message : 'Cancellation recorded.')
    if (!error) {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)))
    }
  }

  const upcoming = bookings.filter((b) => !['completed', 'cancelled', 'declined'].includes(b.status))
  const history = bookings.filter((b) => ['completed', 'cancelled', 'declined'].includes(b.status))

  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>My account</h2>
        <p>View your appointments, update your details, and request changes — only your own bookings are shown here.</p>
      </div>

      {message ? <div className="notice">{message}</div> : null}
      {loading ? <p className="meta">Loading your account…</p> : null}

      <div className="panel" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>My appointments</h3>
        <div className="list">
          {upcoming.map((b) => (
            <div key={b.id} className="list-item">
              <div>
                <h3>{(b as Booking & { services?: { name?: string } }).services?.name ?? 'Appointment'}</h3>
                <p className="meta">
                  Requested {formatDate(b.requested_date)} {formatTime(b.requested_time)}
                </p>
                <p className="meta">Confirmed {formatDateTime(b.confirmed_start)}</p>
                {b.alternative_date ? (
                  <p className="meta">
                    Preferred alternative {formatDate(b.alternative_date)} {formatTime(b.alternative_time)}
                  </p>
                ) : null}
                {b.client_message ? <p className="meta">Note from Aviva: {b.client_message}</p> : null}
                <p className="meta">{statusLabel(b.status)}</p>
              </div>
              <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'end' }}>
                <BookingStatusBadge status={b.status} />
                {b.status === 'confirmed' || b.status === 'requested' || b.status === 'awaiting_confirmation' ? (
                  <>
                    <button className="btn btn-ghost" type="button" onClick={() => requestReschedule(b.id)}>
                      Reschedule
                    </button>
                    <button className="btn btn-danger" type="button" onClick={() => requestCancel(b.id)}>
                      Cancel
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
          {!loading && upcoming.length === 0 ? (
            <div style={{ padding: '0.5rem 0 0.25rem' }}>
              <p className="admin-empty" style={{ marginBottom: '0.85rem' }}>
                No upcoming appointments yet.
              </p>
              <Link className="btn btn-primary" to="/book">
                Request a booking
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>History</h3>
        <div className="list">
          {history.map((b) => (
            <div key={b.id} className="list-item">
              <div>
                <h3>{(b as Booking & { services?: { name?: string } }).services?.name ?? 'Appointment'}</h3>
                <p className="meta">
                  {formatDate(b.requested_date)} · {statusLabel(b.status)}
                </p>
              </div>
              {b.status === 'completed' ? (
                <Link className="btn btn-secondary" to={`/book?service=${b.service_id ?? ''}`}>
                  Book again
                </Link>
              ) : (
                <BookingStatusBadge status={b.status} />
              )}
            </div>
          ))}
          {!loading && history.length === 0 ? (
            <p className="admin-empty">No past appointments yet.</p>
          ) : null}
        </div>
      </div>

      <form className="panel admin-form" onSubmit={saveDetails}>
        <h3 style={{ marginTop: 0 }}>Account settings</h3>
        <p className="meta" style={{ marginTop: 0 }}>
          Keep your contact details up to date so Aviva can reach you about appointments.
        </p>
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
          <input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
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
          <input value={details.suburb} onChange={(e) => setDetails({ ...details, suburb: e.target.value })} />
        </label>
        <label className="field">
          Preferred contact
          <select
            value={details.preferred_contact}
            onChange={(e) =>
              setDetails({
                ...details,
                preferred_contact: e.target.value as 'phone' | 'whatsapp' | 'email',
              })
            }
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </select>
        </label>
        <div className="action-row">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </form>

      <p className="meta" style={{ marginTop: '1.5rem' }}>
        Need help? <Link to="/contact">Contact Aviva</Link> or read the <Link to="/faq">FAQs</Link>.
      </p>
    </section>
  )
}
