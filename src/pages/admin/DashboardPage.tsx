import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { endOfMonth, endOfWeek, format, isSameDay, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { supabase } from '../../lib/supabase'
import type { AvailabilitySlot, Booking, Enquiry } from '../../lib/types'
import { BookingStatusBadge } from '../../components/shared/StatusBadge'
import { bookingTypeLabel, formatDate, formatTime } from '../../lib/format'

export function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [upcomingAvailableCount, setUpcomingAvailableCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')
    Promise.all([
      supabase
        .from('bookings')
        .select('*, clients(*), services(*)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(50),
      supabase
        .from('availability_slots')
        .select('*')
        .gte('slot_date', weekStart)
        .lte('slot_date', weekEnd)
        .neq('status', 'removed'),
      supabase
        .from('availability_slots')
        .select('id', { count: 'exact', head: true })
        .gte('slot_date', today)
        .eq('status', 'available'),
    ]).then(([b, e, s, upcoming]) => {
      setBookings((b.data as Booking[]) ?? [])
      setEnquiries((e.data as Enquiry[]) ?? [])
      setSlots((s.data as AvailabilitySlot[]) ?? [])
      setUpcomingAvailableCount(upcoming.count ?? 0)
      setLoading(false)
    })
  }, [])

  const today = startOfDay(new Date())
  const stats = useMemo(() => {
    const todayBookings = bookings.filter((b) => {
      const d = b.confirmed_start ? parseISO(b.confirmed_start) : b.requested_date ? parseISO(`${b.requested_date}T12:00:00`) : null
      return d && isSameDay(d, today) && !['cancelled', 'declined'].includes(b.status)
    })
    const next = todayBookings
      .slice()
      .sort((a, b) => (a.confirmed_start || a.requested_time || '').localeCompare(b.confirmed_start || b.requested_time || ''))[0]
    const requests = bookings.filter((b) => b.status === 'requested' || b.status === 'awaiting_confirmation')
    const reschedules = bookings.filter((b) => b.status === 'reschedule_requested')
    const upcoming = bookings.filter((b) => b.status === 'confirmed')
    const weekStart = startOfWeek(today, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)
    const inRange = (b: Booking, start: Date, end: Date) => {
      const d = b.confirmed_start ? parseISO(b.confirmed_start) : b.requested_date ? parseISO(`${b.requested_date}T12:00:00`) : null
      return d && d >= start && d <= end
    }
    const weekSlots = slots.filter((s) => s.status !== 'removed')
    return {
      todayCount: todayBookings.length,
      homeToday: todayBookings.filter((b) => b.booking_type === 'home_visit').length,
      next,
      requests,
      reschedules,
      upcoming: upcoming.slice(0, 8),
      newEnquiries: enquiries.filter((e) => e.status === 'new'),
      unanswered: enquiries.filter((e) => e.status === 'new' || e.status === 'in_progress'),
      week: bookings.filter((b) => inRange(b, weekStart, weekEnd)).length,
      month: bookings.filter((b) => inRange(b, monthStart, monthEnd)).length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      todayBookings,
      availReleased: weekSlots.length,
      availBooked: weekSlots.filter((s) => s.status === 'confirmed').length,
      availAvailable: weekSlots.filter((s) => s.status === 'available').length,
      availAwaiting: weekSlots.filter((s) => s.status === 'requested' || s.status === 'held').length,
    }
  }, [bookings, enquiries, slots, today])

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Dashboard</h1>
          <p className="meta">{format(new Date(), 'EEEE d MMMM')}</p>
        </div>
        <div className="action-row">
          <Link className="btn btn-primary" to="/admin/availability">
            + Release Slots
          </Link>
          <Link className="btn btn-secondary" to="/admin/bookings/new">
            New Booking
          </Link>
        </div>
      </div>

      <div className="quick-actions">
        <Link className="btn btn-primary" to="/admin/availability">
          + Release Slots
        </Link>
        <Link className="btn btn-secondary" to="/admin/calendar">
          View Calendar
        </Link>
        <Link className="btn btn-secondary" to="/admin/bookings?filter=today">
          Today&apos;s schedule
        </Link>
        <Link className="btn btn-secondary" to="/admin/bookings?filter=requested">
          Booking requests
        </Link>
        <Link className="btn btn-ghost" to="/admin/enquiries">
          New enquiries
        </Link>
      </div>

      {loading ? <div className="admin-loading">Loading dashboard…</div> : null}

      <div className="panel">
        <div className="avail-week-head">
          <h2>This week — availability</h2>
          <Link className="btn btn-ghost" to="/admin/availability">
            Manage
          </Link>
        </div>
        <div className="stat-grid avail-week-stats">
          <div className="stat-card">
            <span className="meta">Released</span>
            <strong>{stats.availReleased}</strong>
          </div>
          <div className="stat-card">
            <span className="meta">Booked / confirmed</span>
            <strong>{stats.availBooked}</strong>
          </div>
          <div className="stat-card">
            <span className="meta">Available</span>
            <strong>{stats.availAvailable}</strong>
          </div>
          <div className="stat-card">
            <span className="meta">Awaiting</span>
            <strong>{stats.availAwaiting}</strong>
          </div>
        </div>
        {!loading && upcomingAvailableCount === 0 ? (
          <div className="avail-empty" style={{ marginTop: '0.75rem' }}>
            <p className="admin-empty" style={{ padding: '0.5rem 0' }}>
              You haven&apos;t released any upcoming appointment times.
            </p>
            <Link className="btn btn-primary" to="/admin/availability">
              Release Availability
            </Link>
          </div>
        ) : null}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="meta">Today</span>
          <strong>{stats.todayCount}</strong>
        </div>
        <div className="stat-card">
          <span className="meta">Home visits today</span>
          <strong>{stats.homeToday}</strong>
        </div>
        <div className="stat-card">
          <span className="meta">New requests</span>
          <strong>{stats.requests.length}</strong>
        </div>
        <div className="stat-card">
          <span className="meta">Open enquiries</span>
          <strong>{stats.unanswered.length}</strong>
        </div>
        <div className="stat-card">
          <span className="meta">This week</span>
          <strong>{stats.week}</strong>
        </div>
        <div className="stat-card">
          <span className="meta">This month</span>
          <strong>{stats.month}</strong>
        </div>
      </div>

      <div className="panel">
        <h2>Next appointment</h2>
        {stats.next ? (
          <Link className="list-item" to={`/admin/bookings/${stats.next.id}`}>
            <div>
              <h3>{stats.next.clients?.full_name ?? 'Client'}</h3>
              <p className="meta">
                {formatTime(stats.next.requested_time)} · {stats.next.services?.name ?? 'Service'} ·{' '}
                {bookingTypeLabel(stats.next.booking_type)}
              </p>
            </div>
            <BookingStatusBadge status={stats.next.status} />
          </Link>
        ) : (
          <p className="admin-empty">No appointments lined up for today.</p>
        )}
      </div>

      <div className="panel">
        <h2>Today</h2>
        <div className="list">
          {stats.todayBookings.map((b) => (
            <Link key={b.id} className="list-item" to={`/admin/bookings/${b.id}`}>
              <div>
                <h3>{b.clients?.full_name}</h3>
                <p className="meta">
                  {formatTime(b.requested_time)} · {b.services?.name} · {b.suburb || bookingTypeLabel(b.booking_type)}
                </p>
              </div>
              <BookingStatusBadge status={b.status} />
            </Link>
          ))}
          {stats.todayBookings.length === 0 ? <p className="admin-empty">Nothing scheduled today.</p> : null}
        </div>
      </div>

      <div className="panel">
        <h2>New booking requests</h2>
        <div className="list">
          {stats.requests.slice(0, 6).map((b) => (
            <Link key={b.id} className="list-item" to={`/admin/bookings/${b.id}`}>
              <div>
                <h3>{b.clients?.full_name}</h3>
                <p className="meta">
                  {formatDate(b.requested_date)} {formatTime(b.requested_time)} · {b.services?.name}
                </p>
              </div>
              <BookingStatusBadge status={b.status} />
            </Link>
          ))}
          {stats.requests.length === 0 ? <p className="admin-empty">No open requests.</p> : null}
        </div>
      </div>

      {stats.reschedules.length > 0 ? (
        <div className="panel">
          <h2>Reschedule requests</h2>
          <div className="list">
            {stats.reschedules.map((b) => (
              <Link key={b.id} className="list-item" to={`/admin/bookings/${b.id}`}>
                <div>
                  <h3>{b.clients?.full_name}</h3>
                  <p className="meta">
                    Prefers {formatDate(b.alternative_date)} {formatTime(b.alternative_time)}
                  </p>
                </div>
                <BookingStatusBadge status={b.status} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
