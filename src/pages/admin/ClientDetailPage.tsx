import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Booking, Client } from '../../lib/types'
import { BookingStatusBadge } from '../../components/shared/StatusBadge'
import { formatDate, formatTime, mailLink, telLink, whatsappLink } from '../../lib/format'

export function ClientDetailPage() {
  const { id } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('clients').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('bookings')
        .select('*, services(*)')
        .eq('client_id', id)
        .order('requested_date', { ascending: false }),
    ]).then(([c, b]) => {
      const clientRow = c.data as Client | null
      setClient(clientRow)
      setNotes(clientRow?.private_notes ?? '')
      setBookings((b.data as Booking[]) ?? [])
    })
  }, [id])

  async function saveNotes() {
    if (!client) return
    setBusy(true)
    await supabase.from('clients').update({ private_notes: notes }).eq('id', client.id)
    setBusy(false)
  }

  if (!client) return <div className="admin-loading">Loading client…</div>

  const wa = whatsappLink(client.phone)
  const tel = telLink(client.phone)
  const mail = mailLink(client.email)

  return (
    <>
      <div className="admin-topbar">
        <div>
          <Link to="/admin/clients" className="meta">
            ← Clients
          </Link>
          <h1>{client.full_name}</h1>
        </div>
        <Link className="btn btn-primary" to={`/admin/bookings/new?client=${client.id}`}>
          Create booking
        </Link>
      </div>

      <div className="detail-grid two">
        <div className="panel">
          <h2>Contact</h2>
          <div className="kv">
            <span>Phone</span>
            <strong>{client.phone || '—'}</strong>
          </div>
          <div className="kv">
            <span>Email</span>
            <strong>{client.email || '—'}</strong>
          </div>
          <div className="kv">
            <span>Area</span>
            <strong>{client.suburb || '—'}</strong>
          </div>
          <div className="kv">
            <span>Completed visits</span>
            <strong>{bookings.filter((b) => b.status === 'completed').length}</strong>
          </div>
          <div className="action-row">
            {tel ? (
              <a className="btn btn-secondary" href={tel}>
                Call
              </a>
            ) : null}
            {wa ? (
              <a className="btn btn-secondary" href={wa} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            ) : null}
            {mail ? (
              <a className="btn btn-ghost" href={mail}>
                Email
              </a>
            ) : null}
          </div>
        </div>

        <div className="panel admin-form">
          <h2>Internal notes</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn btn-primary" type="button" disabled={busy} onClick={saveNotes}>
            Save notes
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Appointment history</h2>
        <div className="list">
          {bookings.map((b) => (
            <Link key={b.id} className="list-item" to={`/admin/bookings/${b.id}`}>
              <div>
                <h3>{b.services?.name ?? 'Service'}</h3>
                <p className="meta">
                  {formatDate(b.requested_date)} {formatTime(b.requested_time)}
                </p>
              </div>
              <BookingStatusBadge status={b.status} />
            </Link>
          ))}
          {bookings.length === 0 ? <p className="admin-empty">No appointments yet.</p> : null}
        </div>
      </div>
    </>
  )
}
