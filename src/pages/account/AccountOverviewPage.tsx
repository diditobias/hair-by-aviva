import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { BookingStatusBadge } from '../../components/shared/StatusBadge'
import { formatDate, formatDateTime, formatTime } from '../../lib/format'
import { isUpcoming, serviceName, useClientBookings } from './useClientBookings'

export function AccountOverviewPage() {
  const { profile } = useAuth()
  const { bookings, loading } = useClientBookings()

  const firstName = profile?.first_name || 'there'
  const next = bookings
    .filter((b) => isUpcoming(b.status))
    .sort((a, b) => {
      const aKey = a.confirmed_start || `${a.requested_date ?? ''}T${a.requested_time ?? ''}`
      const bKey = b.confirmed_start || `${b.requested_date ?? ''}T${b.requested_time ?? ''}`
      return aKey.localeCompare(bKey)
    })[0]

  return (
    <section className="account-page">
      <div className="section-head">
        <h2>Hi {firstName}</h2>
        <p>Your appointments and booking details, quietly in one place.</p>
      </div>

      {loading ? <p className="meta">Loading…</p> : null}

      <div className="account-panel">
        <h3>Next appointment</h3>
        {next ? (
          <div className="account-next">
            <div>
              <strong>{serviceName(next)}</strong>
              <p className="meta">
                {next.confirmed_start
                  ? formatDateTime(next.confirmed_start)
                  : `${formatDate(next.requested_date)} · ${formatTime(next.requested_time)}`}
              </p>
            </div>
            <BookingStatusBadge status={next.status} />
            <Link className="btn btn-ghost" to={`/account/appointments/${next.id}`}>
              View details
            </Link>
          </div>
        ) : (
          <p className="meta">No upcoming appointments yet.</p>
        )}
      </div>

      <div className="account-quick-actions">
        <Link className="btn btn-primary" to="/book">
          Book appointment
        </Link>
        <Link className="btn btn-ghost" to="/account/availability">
          Available times
        </Link>
        <Link className="btn btn-ghost" to="/account/offers">
          Offers
        </Link>
        <Link className="btn btn-ghost" to="/account/appointments">
          My appointments
        </Link>
        <Link className="btn btn-ghost" to="/account/profile">
          My details
        </Link>
      </div>
    </section>
  )
}
