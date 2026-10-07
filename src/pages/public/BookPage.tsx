import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  clearBookingDraft,
  getBookingDraft,
  mergeBookingDraft,
  type BookingWizardStep,
} from '../../lib/bookingDraft'
import { bookingTypeLabel, formatDate, formatPrice, formatTime, whatsappLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { AvailabilitySlot, BookingType, Service } from '../../lib/types'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'
import { lookRequestNote } from '../../lib/ideas'

const PROGRESS_STEPS = [
  { id: 'service', label: 'Service' },
  { id: 'time', label: 'Time' },
  { id: 'details', label: 'Details' },
  { id: 'review', label: 'Review' },
] as const

function progressIndex(step: BookingWizardStep): number {
  if (step === 'type' || step === 'service') return 0
  if (step === 'day' || step === 'time') return 1
  if (step === 'details') return 2
  if (step === 'review' || step === 'success') return 3
  return 0
}

function normalizeTime(value: string | null | undefined): string {
  if (!value) return ''
  return value.length >= 5 ? value.slice(0, 5) : value
}

function normalizeDate(value: string | null | undefined): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export function BookPage() {
  const [params] = useSearchParams()
  const { settings } = useBusinessSettings()
  const { user, profile, session } = useAuth()

  const draft = useMemo(() => getBookingDraft(), [])
  const paramType = params.get('type') as BookingType | null
  const paramService = params.get('service')
  const paramLook = params.get('look')
  const paramSlot = params.get('slot')
  const paramDate = params.get('date')
  const paramTime = params.get('time')
  const openedFromSlot = Boolean(paramSlot)

  const [step, setStep] = useState<BookingWizardStep>(() => {
    if (
      paramSlot &&
      paramDate &&
      (paramService || draft?.service_id) &&
      (paramType || draft?.booking_type)
    ) {
      return 'time'
    }
    if (draft?.step && draft.step !== 'success' && !openedFromSlot) return draft.step
    if ((paramService || draft?.service_id) && (paramType || draft?.booking_type)) return 'day'
    if (paramType || draft?.booking_type) return 'service'
    return 'type'
  })
  const [bookingType, setBookingType] = useState<BookingType | null>(
    () => paramType ?? draft?.booking_type ?? null,
  )
  const [serviceId, setServiceId] = useState(() => paramService ?? draft?.service_id ?? '')
  const [slotId, setSlotId] = useState(() => paramSlot ?? draft?.slot_id ?? '')
  const [slotDate, setSlotDate] = useState(() => paramDate ?? draft?.slot_date ?? '')
  const [startTime, setStartTime] = useState(() => paramTime ?? draft?.start_time ?? '')
  const [services, setServices] = useState<Service[]>([])
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsReady, setSlotsReady] = useState(false)
  const [holding, setHolding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preserveSlotError = useRef(false)
  const [successId, setSuccessId] = useState<string | null>(null)

  const [name, setName] = useState(() => draft?.name ?? '')
  const [email, setEmail] = useState(() => draft?.email ?? '')
  const [phone, setPhone] = useState(() => draft?.phone ?? '')
  const [preferredContact, setPreferredContact] = useState(
    () => draft?.preferred_contact ?? 'whatsapp',
  )
  const [suburb, setSuburb] = useState(() => draft?.suburb ?? '')
  const [address, setAddress] = useState(() => draft?.address ?? '')
  const [notes, setNotes] = useState(() => {
    const existing = draft?.notes ?? ''
    if (!paramLook) return existing
    const line = lookRequestNote(paramLook)
    if (existing.includes(line)) return existing
    return existing ? `${line}\n${existing}` : line
  })

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setServices((data as Service[]) ?? []))
  }, [])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('full_name, email, phone, suburb, preferred_contact')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      const fullName =
        clientRow?.full_name ||
        `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() ||
        ''
      if (!name && fullName) setName(fullName)
      if (!email && (clientRow?.email || profile?.email || user.email)) {
        setEmail(clientRow?.email || profile?.email || user.email || '')
      }
      if (!phone && (clientRow?.phone || profile?.phone)) {
        setPhone(clientRow?.phone || profile?.phone || '')
      }
      if (!suburb && clientRow?.suburb) setSuburb(clientRow.suburb)
      if (clientRow?.preferred_contact) setPreferredContact(clientRow.preferred_contact)
    })()
    // Prefill once when auth/profile becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile])

  useEffect(() => {
    if (step === 'success') return
    mergeBookingDraft({
      booking_type: bookingType,
      service_id: serviceId || null,
      slot_id: slotId || null,
      slot_date: slotDate || null,
      start_time: startTime || null,
      suburb: suburb || null,
      address: address || null,
      notes: notes || null,
      name: name || null,
      email: email || null,
      phone: phone || null,
      preferred_contact: preferredContact || null,
      step,
    })
  }, [
    bookingType,
    serviceId,
    slotId,
    slotDate,
    startTime,
    suburb,
    address,
    notes,
    name,
    email,
    phone,
    preferredContact,
    step,
  ])

  useEffect(() => {
    if (!bookingType || !serviceId || (step !== 'day' && step !== 'time' && step !== 'review')) return
    let cancelled = false
    setSlotsLoading(true)
    setSlotsReady(false)
    supabase
      .rpc('get_released_availability', {
        p_booking_type: bookingType,
        p_service_id: serviceId,
      })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return
        setSlotsLoading(false)
        setSlotsReady(true)
        if (rpcError) {
          setError(rpcError.message)
          setSlots([])
          return
        }
        const rows = ((data as AvailabilitySlot[]) ?? []).map((s) => ({
          ...s,
          slot_date: normalizeDate(s.slot_date),
          start_time: normalizeTime(s.start_time),
          end_time: normalizeTime(s.end_time),
        }))
        setSlots(rows)
        if (step === 'time' && slotId && !rows.some((row) => row.id === slotId)) {
          setSlotId('')
          setError('That time is no longer open for this service. Please choose another.')
          preserveSlotError.current = true
          setStep('day')
          return
        }
        if (preserveSlotError.current) {
          preserveSlotError.current = false
        } else {
          setError(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [bookingType, serviceId, step, slotId])

  const filteredServices = useMemo(() => {
    if (!bookingType) return []
    return services.filter((s) => {
      if (bookingType === 'pickup') return s.booking_type === 'pickup'
      if (bookingType === 'wig') return s.wig_appointment || s.booking_type === 'wig'
      return (s.home_call_eligible || s.booking_type === 'home_visit') && s.booking_type !== 'pickup'
    })
  }, [services, bookingType])

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  )

  const datesWithSlots = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>()
    for (const slot of slots) {
      const d = normalizeDate(slot.slot_date)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(slot)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

  const timesForDay = useMemo(() => {
    if (!slotDate) return []
    return slots
      .filter((s) => normalizeDate(s.slot_date) === slotDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [slots, slotDate])

  const wa = whatsappLink(
    settings?.whatsapp ?? settings?.phone ?? null,
    'Hi Aviva, I would like to enquire about an appointment.',
  )

  const homeEnabled = settings?.home_visits_enabled ?? true
  const wigEnabled = settings?.wig_appointments_enabled ?? true

  function go(next: BookingWizardStep) {
    setError(null)
    setStep(next)
  }

  async function selectTime(slot: AvailabilitySlot) {
    setHolding(true)
    setError(null)
    const { data, error: holdError } = await supabase.rpc('hold_availability_slot', {
      p_slot_id: slot.id,
      p_hold_minutes: 10,
    })
    setHolding(false)
    if (holdError || data === false) {
      setError(holdError?.message ?? 'That time was just taken. Please choose another.')
      return
    }
    setSlotId(slot.id)
    setSlotDate(normalizeDate(slot.slot_date))
    setStartTime(normalizeTime(slot.start_time))
    go('details')
  }

  async function onSubmit() {
    if (!bookingType || !serviceId || !slotId) {
      setError('Please complete each step before sending your request.')
      return
    }
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required.')
      go('details')
      return
    }
    if (bookingType === 'home_visit' && (!suburb.trim() || !address.trim())) {
      setError('Please add your suburb and address for a home visit.')
      go('details')
      return
    }

    setSubmitting(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('submit_slot_booking_request', {
      p_slot_id: slotId,
      p_full_name: name.trim(),
      p_email: email.trim() || null,
      p_phone: phone.trim() || null,
      p_service_id: serviceId,
      p_booking_type: bookingType,
      p_suburb: bookingType === 'home_visit' ? suburb.trim() || null : null,
      p_customer_address: bookingType === 'home_visit' ? address.trim() || null : null,
      p_number_of_people: 1,
      p_customer_notes: notes.trim() || null,
      p_preferred_contact: preferredContact || null,
    })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    clearBookingDraft()
    setSuccessId(String(data))
    setStep('success')
  }

  if (settings && !settings.accept_bookings) {
    return (
      <section className="section section-narrow">
        <div className="notice">
          Online booking requests are temporarily paused. Please WhatsApp or call Aviva.
        </div>
        <div className="book-empty-actions">
          {wa ? (
            <a className="btn btn-primary" href={wa} target="_blank" rel="noreferrer">
              WhatsApp Aviva
            </a>
          ) : null}
          <Link className="btn btn-ghost" to="/enquiry">
            Send an enquiry
          </Link>
        </div>
      </section>
    )
  }

  if (step === 'success' || successId) {
    return (
      <section className="section section-narrow book-wizard">
        <div className="book-success">
          <p className="eyebrow">Request received</p>
          <h2>You&apos;re all set</h2>
          <p>
            Your booking request has been sent. Aviva will confirm the appointment or suggest another
            time.
          </p>
          {bookingType === 'wig' || bookingType === 'pickup' ? (
            <div className="notice">
              {bookingType === 'pickup'
                ? 'Collection is at Aviva’s private Johannesburg location. The exact address is shared after she confirms.'
                : 'Wig appointments are at Aviva’s private Johannesburg location. The exact address is shared after she confirms.'}
            </div>
          ) : null}
          <div className="book-success-actions">
            <Link className="btn btn-primary" to="/account/appointments">
              View my appointments
            </Link>
            <Link className="btn btn-ghost" to="/">
              Back to home
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const activeProgress = progressIndex(step)

  return (
    <section className="section section-narrow book-wizard">
      <div className="section-head">
        <h2>Book with Aviva</h2>
        <p>Choose your service and a released time. Nothing is locked in until Aviva confirms.</p>
      </div>

      <ol className="book-progress" aria-label="Booking progress">
        {PROGRESS_STEPS.map((item, index) => (
          <li
            key={item.id}
            className={
              index < activeProgress ? 'done' : index === activeProgress ? 'current' : undefined
            }
          >
            <span className="book-progress-dot" aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ol>

      {paramLook ? (
        <div className="notice">Aviva will see that you would like a look like “{paramLook}”.</div>
      ) : null}

      {error ? <div className="notice error">{error}</div> : null}

      {step === 'type' ? (
        <div className="choice-grid">
          {homeEnabled ? (
            <button
              type="button"
              className="choice-card"
              onClick={() => {
                setBookingType('home_visit')
                setServiceId('')
                if (!openedFromSlot) {
                  setSlotId('')
                  setSlotDate('')
                  setStartTime('')
                }
                go('service')
              }}
            >
              <span className="choice-card-kicker">At your place</span>
              <strong>Hair at My Home</strong>
              <p>Aviva comes to you across Johannesburg for cuts, colour and styling in comfort.</p>
            </button>
          ) : null}
          {wigEnabled ? (
            <button
              type="button"
              className="choice-card"
              onClick={() => {
                setBookingType('wig')
                setServiceId('')
                if (!openedFromSlot) {
                  setSlotId('')
                  setSlotDate('')
                  setStartTime('')
                }
                go('service')
              }}
            >
              <span className="choice-card-kicker">Private studio</span>
              <strong>Wig / Sheitel</strong>
              <p>Dedicated wig care at Aviva&apos;s private Johannesburg location.</p>
            </button>
          ) : null}
          <button
            type="button"
            className="choice-card"
            onClick={() => {
              setBookingType('pickup')
              setServiceId('')
              if (!openedFromSlot) {
                setSlotId('')
                setSlotDate('')
                setStartTime('')
              }
              go('service')
            }}
          >
            <span className="choice-card-kicker">Collection</span>
            <strong>Wig collection</strong>
            <p>A short slot to pick up a finished wig or sheitel.</p>
          </button>
          {!homeEnabled && !wigEnabled ? (
            <div className="notice">Appointments are not available right now.</div>
          ) : null}
          <div className="book-empty-actions" style={{ marginTop: '1.25rem' }}>
            <Link className="btn btn-ghost" to="/availability">
              See available times
            </Link>
          </div>
        </div>
      ) : null}

      {step === 'service' && bookingType ? (
        <div>
          <button type="button" className="book-back" onClick={() => go('type')}>
            ← Change appointment type
          </button>
          <h3 className="book-step-title">{bookingTypeLabel(bookingType)}</h3>
          {openedFromSlot && slotDate && startTime ? (
            <div className="notice">
              You chose {formatDate(slotDate)} at {formatTime(startTime)}. Pick the service for that time.
            </div>
          ) : null}
          <div className="choice-grid">
            {filteredServices.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`choice-card${serviceId === s.id ? ' is-selected' : ''}`}
                onClick={() => {
                  setServiceId(s.id)
                  if (openedFromSlot && paramSlot) {
                    setSlotId(paramSlot)
                    if (paramDate) setSlotDate(paramDate)
                    if (paramTime) setStartTime(paramTime)
                    go('time')
                    return
                  }
                  setSlotId('')
                  setSlotDate('')
                  setStartTime('')
                  go('day')
                }}
              >
                <strong>{s.name}</strong>
                <p>
                  {s.duration_minutes} min
                  {settings?.show_prices && s.display_price && s.price_from != null
                    ? ` · from ${formatPrice(s.price_from)}`
                    : ''}
                </p>
                {s.description ? <p className="meta">{s.description}</p> : null}
              </button>
            ))}
            {filteredServices.length === 0 ? (
              <div className="notice">No services are listed for this appointment type yet.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 'day' ? (
        <div>
          <button type="button" className="book-back" onClick={() => go('service')}>
            ← Change service
          </button>
          <h3 className="book-step-title">Pick a day</h3>
          {slotsLoading || !slotsReady ? <p className="meta">Loading available days…</p> : null}
          {slotsReady && !slotsLoading && datesWithSlots.length === 0 ? (
            <EmptyAvailability wa={wa} />
          ) : null}
          {slotsReady && !slotsLoading && datesWithSlots.length > 0 ? (
            <div className="date-chip-grid">
              {datesWithSlots.map(([date, daySlots]) => (
                <button
                  key={date}
                  type="button"
                  className={`date-chip${slotDate === date ? ' is-selected' : ''}`}
                  onClick={() => {
                    setSlotDate(date)
                    setSlotId('')
                    setStartTime('')
                    go('time')
                  }}
                >
                  <strong>{formatDate(date)}</strong>
                  <span>
                    {daySlots.length} time{daySlots.length === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 'time' ? (
        <div>
          <button type="button" className="book-back" onClick={() => go('day')}>
            ← Change day
          </button>
          <h3 className="book-step-title">{formatDate(slotDate)}</h3>
          {holding ? <p className="meta">Holding your time…</p> : null}
          {slotsLoading || !slotsReady ? <p className="meta">Loading available times…</p> : null}
          {slotsReady && !slotsLoading && timesForDay.length === 0 ? (
            <EmptyAvailability wa={wa} />
          ) : null}
          {slotsReady && !slotsLoading && timesForDay.length > 0 ? (
            <div className="time-chip-grid">
              {timesForDay.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`time-chip${slotId === slot.id ? ' is-selected' : ''}`}
                  disabled={holding}
                  onClick={() => selectTime(slot)}
                >
                  {formatTime(slot.start_time)}
                  {slot.end_time ? <span className="time-chip-note">– {formatTime(slot.end_time)}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 'details' ? (
        <div>
          <button type="button" className="book-back" onClick={() => go('time')}>
            ← Change time
          </button>
          <h3 className="book-step-title">Your details</h3>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault()
              go('review')
            }}
          >
            <div className="form-row two">
              <label className="field">
                Full name
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                Phone
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
            <div className="form-row two">
              <label className="field">
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                Preferred contact
                <select
                  value={preferredContact}
                  onChange={(e) => setPreferredContact(e.target.value)}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                </select>
              </label>
            </div>

            {bookingType === 'home_visit' ? (
              <div className="form-row two">
                <label className="field">
                  Suburb / area
                  <input
                    required
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    placeholder="e.g. Glenhazel, Sydenham, Sandton"
                  />
                </label>
                <label className="field">
                  Address
                  <input
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shared securely with Aviva only"
                  />
                </label>
              </div>
            ) : (
              <div className="notice">
                {bookingType === 'pickup'
                  ? 'Collection is at Aviva’s private Johannesburg location. The address is shared after she confirms — you don’t need to enter it here.'
                  : 'Wig appointments are at Aviva’s private Johannesburg location. The address is shared after she confirms — you don’t need to enter it here.'}
              </div>
            )}

            <label className="field">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Hair goals, reference notes, parking tips…"
              />
            </label>

            <button className="btn btn-primary" type="submit">
              Continue to review
            </button>
          </form>
        </div>
      ) : null}

      {step === 'review' ? (
        <div>
          <button type="button" className="book-back" onClick={() => go('details')}>
            ← Edit details
          </button>
          <h3 className="book-step-title">Review &amp; send</h3>
          <div className="book-review">
            <div>
              <span className="meta">Type</span>
              <p>{bookingType ? bookingTypeLabel(bookingType) : '—'}</p>
            </div>
            <div>
              <span className="meta">Service</span>
              <p>{selectedService?.name ?? '—'}</p>
            </div>
            <div>
              <span className="meta">When</span>
              <p>
                {formatDate(slotDate)} · {formatTime(startTime)}
              </p>
            </div>
            <div>
              <span className="meta">Contact</span>
              <p>
                {name}
                <br />
                {phone}
                {email ? (
                  <>
                    <br />
                    {email}
                  </>
                ) : null}
              </p>
            </div>
            {bookingType === 'home_visit' ? (
              <div>
                <span className="meta">Location</span>
                <p>
                  {suburb}
                  <br />
                  {address}
                </p>
              </div>
            ) : null}
            {notes ? (
              <div>
                <span className="meta">Notes</span>
                <p>{notes}</p>
              </div>
            ) : null}
          </div>

          {!session ? (
            <div className="notice book-auth-prompt">
              <p>
                Have an account?{' '}
                <Link to="/login" state={{ from: '/book' }}>
                  Log in
                </Link>{' '}
                or{' '}
                <Link to="/signup" state={{ from: '/book' }}>
                  create one
                </Link>{' '}
                so you can track this appointment — your booking details are saved.
              </p>
            </div>
          ) : null}

          <button className="btn btn-primary" type="button" disabled={submitting} onClick={onSubmit}>
            {submitting ? 'Sending…' : 'Send booking request'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function EmptyAvailability({ wa }: { wa: string | null }) {
  return (
    <div className="book-empty">
      <p>Aviva hasn&apos;t released any new appointment times just yet.</p>
      <div className="book-empty-actions">
        {wa ? (
          <a className="btn btn-primary" href={wa} target="_blank" rel="noreferrer">
            WhatsApp Aviva
          </a>
        ) : null}
        <Link className="btn btn-ghost" to="/enquiry">
          Send an enquiry
        </Link>
      </div>
    </div>
  )
}
