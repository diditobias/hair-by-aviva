import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookingStatusBadge } from '../../components/shared/StatusBadge'
import { bookingTypeLabel, formatDate, formatDateTime, formatTime } from '../../lib/format'
import type { Booking } from '../../lib/types'
import { isPending, isUpcoming, serviceName, useClientBookings } from './useClientBookings'

export function AccountAppointmentsPage() {
  const { bookings, loading } = useClientBookings()

  const upcoming = bookings.filter((b) => isUpcoming(b.status) && !isPending(b.status))
  const pending = bookings.filter((b) => isPending(b.status))
  const past = bookings.filter((b) => !isUpcoming(b.status))

  return (
    <section className="account-page">
      <div className="section-head">
        <h2>My appointments</h2>
        <p>Upcoming, pending requests, and past visits.</p>
      </div>

      {loading ? <p className="meta">Loading…</p> : null}

      <AppointmentGroup title="Upcoming" empty="No confirmed upcoming appointments.">
        {upcoming.map((b) => (
          <AppointmentRow key={b.id} booking={b} />
        ))}
      </AppointmentGroup>

      <AppointmentGroup title="Pending" empty="No pending requests.">
        {pending.map((b) => (
          <AppointmentRow key={b.id} booking={b} />
        ))}
      </AppointmentGroup>

      <AppointmentGroup title="Past" empty="No past appointments yet.">
        {past.map((b) => (
          <AppointmentRow key={b.id} booking={b} />
        ))}
      </AppointmentGroup>
    </section>
  )
}

function AppointmentGroup({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: ReactNode[]
}) {
  return (
    <div className="account-panel" style={{ marginBottom: '1.25rem' }}>
      <h3>{title}</h3>
      <div className="account-list">
        {children.length ? children : <p className="meta">{empty}</p>}
      </div>
    </div>
  )
}

function AppointmentRow({ booking }: { booking: Booking }) {
  return (
    <div className="account-list-item">
      <div>
        <strong>{serviceName(booking)}</strong>
        <p className="meta">
          {bookingTypeLabel(booking.booking_type)} ·{' '}
          {booking.confirmed_start
            ? formatDateTime(booking.confirmed_start)
            : `${formatDate(booking.requested_date)} · ${formatTime(booking.requested_time)}`}
        </p>
      </div>
      <div className="account-list-actions">
        <BookingStatusBadge status={booking.status} />
        <Link className="btn btn-ghost" to={`/account/appointments/${booking.id}`}>
          Details
        </Link>
      </div>
    </div>
  )
}
