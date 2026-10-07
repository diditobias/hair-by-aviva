import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Booking, Client } from '../../lib/types'
import { formatDate } from '../../lib/format'

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('*').order('full_name'),
      supabase.from('bookings').select('id, client_id, status, requested_date, confirmed_start, services(name)'),
    ]).then(([c, b]) => {
      setClients((c.data as Client[]) ?? [])
      setBookings(((b.data as unknown) as Booking[]) ?? [])
      setLoading(false)
    })
  }, [])

  const rows = useMemo(() => {
    return clients
      .filter((c) => {
        const hay = `${c.full_name} ${c.phone ?? ''} ${c.email ?? ''} ${c.suburb ?? ''}`.toLowerCase()
        return !q || hay.includes(q.toLowerCase())
      })
      .map((c) => {
        const mine = bookings.filter((b) => b.client_id === c.id)
        const upcoming = mine
          .filter((b) => b.status === 'confirmed' || b.status === 'requested')
          .sort((a, b) => (a.requested_date ?? '').localeCompare(b.requested_date ?? ''))[0]
        const last = mine
          .filter((b) => b.status === 'completed')
          .sort((a, b) => (b.requested_date ?? '').localeCompare(a.requested_date ?? ''))[0]
        return { client: c, count: mine.length, upcoming, last }
      })
  }, [clients, bookings, q])

  return (
    <>
      <div className="admin-topbar">
        <h1>Clients</h1>
        <Link className="btn btn-primary" to="/admin/bookings/new">
          New booking
        </Link>
      </div>
      <div className="toolbar">
        <input placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? <div className="admin-loading">Loading clients…</div> : null}
      <div className="list">
        {rows.map(({ client, count, upcoming, last }) => (
          <Link key={client.id} className="list-item" to={`/admin/clients/${client.id}`}>
            <div>
              <h3>{client.full_name}</h3>
              <p className="meta">
                {client.phone || client.email || 'No contact'} · {client.suburb || 'No area'} · {count} appointments
              </p>
              <p className="meta">
                Last: {formatDate(last?.requested_date)} · Next: {formatDate(upcoming?.requested_date)}
              </p>
            </div>
          </Link>
        ))}
        {!loading && rows.length === 0 ? <p className="admin-empty">No clients yet.</p> : null}
      </div>
    </>
  )
}
