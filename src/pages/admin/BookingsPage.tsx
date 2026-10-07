import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isSameDay, parseISO, startOfDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import type { Booking } from '../../lib/types'
import { BookingStatusBadge } from '../../components/shared/StatusBadge'
import { bookingTypeLabel, formatDate, formatTime } from '../../lib/format'

export function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') ?? 'all'
  const [q, setQ] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*, clients(*), services(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBookings((data as Booking[]) ?? [])
        setLoading(false)
      })
  }, [])

  const today = startOfDay(new Date())

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const client = b.clients
      const hay = `${client?.full_name ?? ''} ${client?.phone ?? ''} ${client?.email ?? ''}`.toLowerCase()
      if (q && !hay.includes(q.toLowerCase())) return false

      const day = b.confirmed_start
        ? parseISO(b.confirmed_start)
        : b.requested_date
          ? parseISO(`${b.requested_date}T12:00:00`)
          : null

      switch (filter) {
        case 'requested':
          return b.status === 'requested' || b.status === 'awaiting_confirmation'
        case 'confirmed':
          return b.status === 'confirmed'
        case 'today':
          return !!day && isSameDay(day, today)
        case 'upcoming':
          return b.status === 'confirmed' && !!day && day >= today
        case 'completed':
          return b.status === 'completed'
        case 'cancelled':
          return b.status === 'cancelled' || b.status === 'declined'
        case 'wig':
          return b.booking_type === 'wig'
        case 'pickup':
          return b.booking_type === 'pickup'
        case 'home':
          return b.booking_type === 'home_visit'
        default:
          return true
      }
    })
  }, [bookings, filter, q, today])

  return (
    <>
      <div className="admin-topbar">
        <h1>Bookings</h1>
        <Link className="btn btn-primary" to="/admin/bookings/new">
          New Booking
        </Link>
      </div>

      <div className="toolbar">
        <input placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          value={filter}
          onChange={(e) => {
            const next = new URLSearchParams(params)
            next.set('filter', e.target.value)
            setParams(next)
          }}
        >
          <option value="all">All</option>
          <option value="requested">New requests</option>
          <option value="confirmed">Confirmed</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="wig">Wig appointments</option>
          <option value="pickup">Wig collection</option>
          <option value="home">Home visits</option>
        </select>
      </div>

      {loading ? <div className="admin-loading">Loading bookings…</div> : null}

      <div className="list">
        {filtered.map((b) => (
          <Link key={b.id} className="list-item" to={`/admin/bookings/${b.id}`}>
            <div>
              <h3>{b.clients?.full_name ?? 'Client'}</h3>
              <p className="meta">
                {formatDate(b.requested_date)} {formatTime(b.requested_time)} · {b.services?.name ?? 'Service'} ·{' '}
                {bookingTypeLabel(b.booking_type)}
                {b.suburb ? ` · ${b.suburb}` : ''}
              </p>
            </div>
            <BookingStatusBadge status={b.status} />
          </Link>
        ))}
        {!loading && filtered.length === 0 ? <p className="admin-empty">No bookings match this filter.</p> : null}
      </div>
    </>
  )
}
