import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookingStatusBadge } from '../../components/shared/StatusBadge'
import {
  bookingTypeLabel,
  formatDate,
  formatDateTime,
  formatTime,
  statusLabel,
} from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { AvailabilitySlot } from '../../lib/types'
import { serviceName, useClientBookings } from './useClientBookings'

export function AccountAppointmentDetailPage() {
  const { id } = useParams()
  const { bookings, loading, reload } = useClientBookings()
  const booking = bookings.find((b) => b.id === id) ?? null

  const [message, setMessage] = useState<string | null>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const dates = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>()
    for (const slot of slots) {
      const d = String(slot.slot_date).slice(0, 10)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push({
        ...slot,
        slot_date: d,
        start_time: String(slot.start_time).slice(0, 5),
      })
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

  useEffect(() => {
    if (!rescheduleOpen || !booking) return
    let cancelled = false
    setSlotsLoading(true)
    supabase
      .rpc('get_released_availability', {
        p_booking_type: booking.booking_type,
        p_service_id: booking.service_id,
      })
      .then(({ data, error }) => {
        if (cancelled) return
        setSlotsLoading(false)
        if (error) {
          setMessage(error.message)
          return
        }
        setSlots((data as AvailabilitySlot[]) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [rescheduleOpen, booking])

  async function requestCancel() {
    if (!booking) return
    if (!window.confirm('Request cancellation for this appointment?')) return
    setBusy(true)
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    setBusy(false)
    if (error) setMessage(error.message)
    else {
      setMessage('Cancellation recorded.')
      await reload()
    }
  }

  async function submitReschedule() {
    if (!booking || !selectedSlot) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.rpc('request_slot_reschedule', {
      p_booking_id: booking.id,
      p_new_slot_id: selectedSlot,
    })
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Reschedule requested. Aviva will confirm.')
    setRescheduleOpen(false)
    setSelectedSlot('')
    await reload()
  }

  if (loading) {
    return (
      <section className="account-page">
        <p className="meta">Loading…</p>
      </section>
    )
  }

  if (!booking) {
    return (
      <section className="account-page">
        <div className="notice">Appointment not found.</div>
        <Link className="btn btn-ghost" to="/account/appointments">
          ← Back to appointments
        </Link>
      </section>
    )
  }

  const canAct = booking.status === 'confirmed' || booking.status === 'requested'

  return (
    <section className="account-page">
      <Link className="book-back" to="/account/appointments">
        ← Back to appointments
      </Link>

      <div className="section-head">
        <h2>{serviceName(booking)}</h2>
        <p>{bookingTypeLabel(booking.booking_type)}</p>
      </div>

      {message ? <div className="notice">{message}</div> : null}

      <div className="account-panel book-review">
        <div>
          <span className="meta">Status</span>
          <p>
            <BookingStatusBadge status={booking.status} /> {statusLabel(booking.status)}
          </p>
        </div>
        <div>
          <span className="meta">Requested</span>
          <p>
            {formatDate(booking.requested_date)} · {formatTime(booking.requested_time)}
          </p>
        </div>
        <div>
          <span className="meta">Confirmed</span>
          <p>{formatDateTime(booking.confirmed_start)}</p>
        </div>

        {booking.booking_type === 'home_visit' ? (
          <div>
            <span className="meta">Location</span>
            <p>
              {booking.suburb || '—'}
              {booking.customer_address ? (
                <>
                  <br />
                  {booking.customer_address}
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <div>
            <span className="meta">Location</span>
            {booking.status === 'confirmed' && booking.client_message ? (
              <p>{booking.client_message}</p>
            ) : booking.status === 'confirmed' ? (
              <p>Aviva will share private location details with you directly.</p>
            ) : (
              <p className="notice" style={{ marginTop: '0.35rem' }}>
                {booking.booking_type === 'pickup'
                  ? 'Collection is at Aviva’s private Johannesburg location. The exact address is shared after confirmation.'
                  : 'Wig appointments are at Aviva’s private Johannesburg location. The exact address is shared after confirmation.'}
              </p>
            )}
          </div>
        )}

        {booking.client_message && booking.booking_type === 'home_visit' ? (
          <div>
            <span className="meta">Note from Aviva</span>
            <p>{booking.client_message}</p>
          </div>
        ) : null}

        {booking.alternative_date ? (
          <div>
            <span className="meta">Requested alternative</span>
            <p>
              {formatDate(booking.alternative_date)} · {formatTime(booking.alternative_time)}
            </p>
          </div>
        ) : null}
      </div>

      {canAct ? (
        <div className="account-quick-actions">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={busy}
            onClick={() => setRescheduleOpen((v) => !v)}
          >
            Reschedule
          </button>
          <button className="btn btn-danger" type="button" disabled={busy} onClick={requestCancel}>
            Cancel
          </button>
        </div>
      ) : null}

      {booking.status === 'completed' ? (
        <Link className="btn btn-primary" to={`/book?service=${booking.service_id ?? ''}&type=${booking.booking_type}`}>
          Book again
        </Link>
      ) : null}

      {rescheduleOpen ? (
        <div className="account-panel" style={{ marginTop: '1.5rem' }}>
          <h3>Choose a new released time</h3>
          {slotsLoading ? <p className="meta">Loading availability…</p> : null}
          {!slotsLoading && dates.length === 0 ? (
            <p className="meta">No new times are released right now.</p>
          ) : (
            <div className="reschedule-slots">
              {dates.map(([date, daySlots]) => (
                <div key={date}>
                  <p className="meta">{formatDate(date)}</p>
                  <div className="time-chip-grid">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={`time-chip${selectedSlot === slot.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedSlot(slot.id)}
                      >
                        {formatTime(slot.start_time)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            className="btn btn-primary"
            type="button"
            disabled={!selectedSlot || busy}
            onClick={submitReschedule}
            style={{ marginTop: '1rem' }}
          >
            {busy ? 'Sending…' : 'Request this time'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
