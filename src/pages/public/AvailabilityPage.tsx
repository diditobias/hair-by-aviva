import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'
import { formatDate, formatTime, whatsappLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { AvailabilitySlot, SlotAppointmentType } from '../../lib/types'

type SlotFilter = 'all' | 'home_visit' | 'wig' | 'pickup'

const FILTERS: { id: SlotFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'home_visit', label: 'Home visits' },
  { id: 'wig', label: 'Wig / Sheitel' },
  { id: 'pickup', label: 'Collection' },
]

function normalizeTime(value: string | null | undefined): string {
  if (!value) return ''
  return value.length >= 5 ? value.slice(0, 5) : value
}

function normalizeDate(value: string | null | undefined): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function slotTypeLabel(type: SlotAppointmentType): string {
  if (type === 'home_visit') return 'Home visit'
  if (type === 'pickup') return 'Wig collection'
  if (type === 'both') return 'Home visit or wig'
  return 'Wig / Sheitel'
}

function matchesFilter(slot: AvailabilitySlot, filter: SlotFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'home_visit') return slot.appointment_type === 'home_visit' || slot.appointment_type === 'both'
  if (filter === 'wig') return slot.appointment_type === 'wig' || slot.appointment_type === 'both'
  return slot.appointment_type === 'pickup'
}

function bookHref(slot: AvailabilitySlot): string {
  const params = new URLSearchParams()
  if (slot.appointment_type !== 'both') params.set('type', slot.appointment_type)
  params.set('slot', slot.id)
  params.set('date', normalizeDate(slot.slot_date))
  params.set('time', normalizeTime(slot.start_time))
  const serviceIds = slot.service_ids ?? []
  if (serviceIds.length === 1 && serviceIds[0]) params.set('service', serviceIds[0])
  return `/book?${params.toString()}`
}

export function AvailabilityPage() {
  const { pathname } = useLocation()
  const inAccount = pathname.startsWith('/account')
  const { settings } = useBusinessSettings()
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<SlotFilter>('all')

  const wa = whatsappLink(
    settings?.whatsapp ?? settings?.phone ?? null,
    'Hi Aviva, I would like to enquire about an appointment.',
  )
  const bookingsOpen = settings?.accept_bookings !== false

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('get_released_availability', {
        p_booking_type: null,
        p_service_id: null,
      })
      .then(({ data, error: rpcError }) => {
      if (cancelled) return
      setLoading(false)
      if (rpcError) {
        setError(rpcError.message)
        setSlots([])
        return
      }
      setSlots(
        ((data as AvailabilitySlot[]) ?? []).map((slot) => ({
          ...slot,
          slot_date: normalizeDate(slot.slot_date),
          start_time: normalizeTime(slot.start_time),
          end_time: normalizeTime(slot.end_time),
        })),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  const days = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>()
    for (const slot of slots) {
      if (!matchesFilter(slot, filter)) continue
      const date = normalizeDate(slot.slot_date)
      const list = map.get(date) ?? []
      list.push(slot)
      map.set(date, list)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, daySlots]) => [
        date,
        [...daySlots].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      ] as const)
  }, [slots, filter])

  return (
    <section className={inAccount ? 'account-page' : 'section section-narrow'}>
      <div className="section-head">
        <h2>Available times</h2>
        <p>Open appointment times Aviva has released. Choose one to request that slot.</p>
      </div>

      {!bookingsOpen ? (
        <div className="notice">
          Online booking requests are temporarily paused. You can still see open times, or WhatsApp Aviva.
        </div>
      ) : null}

      {error ? <div className="notice error">{error}</div> : null}

      <div className="avail-filters" role="tablist" aria-label="Appointment type">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={`avail-filter${filter === item.id ? ' is-selected' : ''}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <p className="meta">Loading available times…</p> : null}

      {!loading && days.length === 0 ? (
        <div className="book-empty">
          <p>
            {slots.length === 0
              ? "Aviva hasn't released any new appointment times just yet."
              : 'No open times for this appointment type right now.'}
          </p>
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
      ) : (
        <div className="avail-days">
          {days.map(([date, daySlots]) => (
            <section key={date} className="avail-day">
              <h3>{formatDate(date)}</h3>
              <div className="time-chip-grid">
                {daySlots.map((slot) =>
                  bookingsOpen ? (
                    <Link key={slot.id} className="time-chip" to={bookHref(slot)}>
                      {formatTime(slot.start_time)}
                      <span className="time-chip-note">{slotTypeLabel(slot.appointment_type)}</span>
                    </Link>
                  ) : (
                    <div key={slot.id} className="time-chip" aria-disabled="true">
                      {formatTime(slot.start_time)}
                      <span className="time-chip-note">{slotTypeLabel(slot.appointment_type)}</span>
                    </div>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
