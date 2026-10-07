import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Booking, BookingStatus } from '../../lib/types'
import { Modal } from '../../components/shared/Modal'
import { BookingStatusBadge } from '../../components/shared/StatusBadge'
import {
  bookingTypeLabel,
  formatDate,
  formatDateTime,
  formatTime,
  mailLink,
  telLink,
  whatsappLink,
} from '../../lib/format'

export function BookingDetailPage() {
  const { id } = useParams()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [clientMessage, setClientMessage] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: err } = await supabase
      .from('bookings')
      .select('*, clients(*), services(*)')
      .eq('id', id)
      .maybeSingle()
    if (err) setError(err.message)
    const b = data as Booking | null
    setBooking(b)
    setAdminNotes(b?.admin_notes ?? '')
    setClientMessage(b?.client_message ?? '')
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function updateStatusDirect(status: BookingStatus, extra: Partial<Booking> = {}) {
    if (!booking) return
    setBusy(true)
    setError(null)
    const patch: Record<string, unknown> = { status, ...extra }
    if (status === 'confirmed' && booking.requested_date && booking.requested_time) {
      const start = `${booking.requested_date}T${booking.requested_time}`
      const duration = booking.services?.duration_minutes ?? 60
      const startDate = new Date(start)
      const endDate = new Date(startDate.getTime() + duration * 60000)
      patch.confirmed_start = startDate.toISOString()
      patch.confirmed_end = endDate.toISOString()
    }
    const { error: err } = await supabase.from('bookings').update(patch).eq('id', booking.id)
    setBusy(false)
    if (err) setError(err.message)
    else {
      setConfirmOpen(false)
      setDeclineOpen(false)
      await load()
    }
  }

  async function confirmBooking() {
    if (!booking) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('confirm_slot_booking', {
      p_booking_id: booking.id,
      p_client_message: clientMessage.trim() || null,
    })
    if (err) {
      setBusy(false)
      await updateStatusDirect('confirmed', { client_message: clientMessage.trim() || null })
      return
    }
    setBusy(false)
    setConfirmOpen(false)
    await load()
  }

  async function declineBooking(rerelease: boolean) {
    if (!booking) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('decline_slot_booking', {
      p_booking_id: booking.id,
      p_rerelease_slot: rerelease,
      p_client_message: clientMessage.trim() || null,
    })
    if (err) {
      setBusy(false)
      if (booking.availability_slot_id) {
        const slotPatch: Record<string, unknown> = {
          status: rerelease ? 'available' : 'removed',
          held_until: null,
          held_by: null,
        }
        if (rerelease) slotPatch.booking_id = null
        await supabase.from('availability_slots').update(slotPatch).eq('id', booking.availability_slot_id)
      }
      await updateStatusDirect('declined', { client_message: clientMessage.trim() || null })
      return
    }
    setBusy(false)
    setDeclineOpen(false)
    await load()
  }

  async function completeBooking() {
    if (!booking) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('complete_slot_booking', {
      p_booking_id: booking.id,
    })
    if (err) {
      setBusy(false)
      await updateStatusDirect('completed')
      return
    }
    setBusy(false)
    await load()
  }

  async function updateStatus(status: BookingStatus, extra: Partial<Booking> = {}) {
    if (status === 'confirmed') {
      setConfirmOpen(true)
      return
    }
    if (status === 'declined') {
      setDeclineOpen(true)
      return
    }
    if (status === 'completed') {
      await completeBooking()
      return
    }
    await updateStatusDirect(status, extra)
  }

  async function saveNotes() {
    if (!booking) return
    setBusy(true)
    const { error: err } = await supabase
      .from('bookings')
      .update({ admin_notes: adminNotes, client_message: clientMessage })
      .eq('id', booking.id)
    setBusy(false)
    if (err) setError(err.message)
    else await load()
  }

  if (!booking) {
    return <div className="admin-loading">{error ?? 'Loading booking…'}</div>
  }

  const client = booking.clients
  const wa = whatsappLink(client?.phone, `Hi ${client?.full_name?.split(' ')[0] ?? ''}, this is Aviva.`)
  const tel = telLink(client?.phone)
  const mail = mailLink(client?.email, 'Hair by Aviva appointment')

  return (
    <>
      <div className="admin-topbar">
        <div>
          <Link to="/admin/bookings" className="meta">
            ← Bookings
          </Link>
          <h1>{client?.full_name ?? 'Booking'}</h1>
          <BookingStatusBadge status={booking.status} />
        </div>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="action-row" style={{ marginBottom: '1rem' }}>
        {booking.status === 'requested' || booking.status === 'awaiting_confirmation' || booking.status === 'reschedule_requested' ? (
          <button className="btn btn-primary" type="button" onClick={() => setConfirmOpen(true)}>
            Confirm
          </button>
        ) : null}
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => updateStatus('awaiting_confirmation')}>
          Suggest new time
        </button>
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setDeclineOpen(true)}>
          Decline
        </button>
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => completeBooking()}>
          Mark completed
        </button>
        <button className="btn btn-danger" type="button" disabled={busy} onClick={() => updateStatusDirect('cancelled')}>
          Cancel
        </button>
      </div>

      <div className="detail-grid two">
        <div className="panel">
          <h2>Customer</h2>
          <div className="kv">
            <span>Name</span>
            <strong>{client?.full_name}</strong>
          </div>
          <div className="kv">
            <span>Phone</span>
            <strong>{client?.phone || '—'}</strong>
          </div>
          <div className="kv">
            <span>Email</span>
            <strong>{client?.email || '—'}</strong>
          </div>
          <div className="kv">
            <span>Preferred contact</span>
            <strong>{client?.preferred_contact || '—'}</strong>
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
            {client ? (
              <Link className="btn btn-ghost" to={`/admin/clients/${client.id}`}>
                Client profile
              </Link>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <h2>Appointment</h2>
          <div className="kv">
            <span>Service</span>
            <strong>{booking.services?.name || '—'}</strong>
          </div>
          <div className="kv">
            <span>Type</span>
            <strong>{bookingTypeLabel(booking.booking_type)}</strong>
          </div>
          <div className="kv">
            <span>Requested</span>
            <strong>
              {formatDate(booking.requested_date)} · {formatTime(booking.requested_time)}
            </strong>
          </div>
          <div className="kv">
            <span>Confirmed</span>
            <strong>{formatDateTime(booking.confirmed_start)}</strong>
          </div>
          <div className="kv">
            <span>Alternative</span>
            <strong>
              {formatDate(booking.alternative_date)} · {formatTime(booking.alternative_time)}
            </strong>
          </div>
          <div className="kv">
            <span>People</span>
            <strong>{booking.number_of_people}</strong>
          </div>
          <div className="kv">
            <span>Source</span>
            <strong>{booking.booking_source}</strong>
          </div>
          <div className="kv">
            <span>Availability slot</span>
            <strong>
              {booking.availability_slot_id ? (
                <Link to="/admin/availability">{booking.availability_slot_id}</Link>
              ) : (
                '—'
              )}
            </strong>
          </div>
          <div className="kv">
            <span>Customer notes</span>
            <strong>{booking.customer_notes || '—'}</strong>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>{bookingTypeLabel(booking.booking_type)}</h2>
        {booking.booking_type === 'home_visit' ? (
          <>
            <div className="kv">
              <span>Suburb</span>
              <strong>{booking.suburb || '—'}</strong>
            </div>
            <div className="kv">
              <span>Address (admin only)</span>
              <strong>{booking.customer_address || '—'}</strong>
            </div>
            <div className="kv">
              <span>Travel buffer</span>
              <strong>{booking.travel_buffer_minutes} minutes</strong>
            </div>
          </>
        ) : (
          <p className="meta">
            Takes place at Aviva&apos;s private Johannesburg location. Share address details with the
            client only after confirmation.
          </p>
        )}
      </div>

      <div className="panel admin-form">
        <h2>Notes</h2>
        <label className="field">
          Admin notes (private — never shown to clients)
          <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
        </label>
        <label className="field">
          Client message (visible to client)
          <textarea value={clientMessage} onChange={(e) => setClientMessage(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={saveNotes}>
          Save notes
        </button>
      </div>

      <Modal
        open={confirmOpen}
        title={`Confirm appointment with ${client?.full_name?.split(' ')[0] ?? 'client'}?`}
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={confirmBooking}>
              Confirm Appointment
            </button>
          </>
        }
      >
        <div className="kv">
          <span>Date</span>
          <strong>{formatDate(booking.requested_date)}</strong>
        </div>
        <div className="kv">
          <span>Time</span>
          <strong>{formatTime(booking.requested_time)}</strong>
        </div>
        <div className="kv">
          <span>Service</span>
          <strong>{booking.services?.name}</strong>
        </div>
      </Modal>

      <Modal
        open={declineOpen}
        title="Decline this booking?"
        onClose={() => setDeclineOpen(false)}
        actions={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setDeclineOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => declineBooking(false)}>
              Decline & remove slot
            </button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => declineBooking(true)}>
              Decline & re-release slot
            </button>
          </>
        }
      >
        <p>
          {booking.availability_slot_id
            ? 'Do you want to make this appointment time available again for other clients?'
            : 'This booking is not linked to a released slot. Declining will update the booking status only.'}
        </p>
      </Modal>
    </>
  )
}
