import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { supabase } from '../../lib/supabase'
import type { AvailabilitySlot, Booking, SlotAppointmentType } from '../../lib/types'
import { BookingStatusBadge, SlotStatusBadge } from '../../components/shared/StatusBadge'
import { bookingTypeLabel, formatTime } from '../../lib/format'

type View = 'day' | 'week' | 'month'

type CalendarItem =
  | { kind: 'booking'; time: string; booking: Booking }
  | { kind: 'slot'; time: string; slot: AvailabilitySlot }

function bookingDay(b: Booking): Date | null {
  if (b.confirmed_start) return parseISO(b.confirmed_start)
  if (b.requested_date) return parseISO(`${b.requested_date}T12:00:00`)
  return null
}

function slotTypeShort(type: SlotAppointmentType): string {
  if (type === 'home_visit') return 'Home visit'
  if (type === 'wig') return 'Wig'
  if (type === 'pickup') return 'Collection'
  return 'Either'
}

function calendarLabel(item: CalendarItem): string {
  if (item.kind === 'booking') {
    if (item.booking.status === 'confirmed') return 'Confirmed booking'
    if (item.booking.status === 'requested' || item.booking.status === 'awaiting_confirmation') {
      return 'Booking Request Needs Review'
    }
    return item.booking.status.replace(/_/g, ' ')
  }
  if (item.slot.status === 'available') return 'Available'
  if (item.slot.status === 'blocked') return 'Blocked'
  if (item.slot.status === 'requested' || item.slot.status === 'held') return 'Booking Request Needs Review'
  if (item.slot.status === 'confirmed') return 'Confirmed booking'
  return item.slot.status
}

function defaultView(): View {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) return 'day'
  return 'week'
}

export function CalendarPage() {
  const [view, setView] = useState<View>(defaultView)
  const [cursor, setCursor] = useState(new Date())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])

  const range = useMemo(() => {
    if (view === 'day') {
      return { start: format(cursor, 'yyyy-MM-dd'), end: format(cursor, 'yyyy-MM-dd') }
    }
    if (view === 'week') {
      return {
        start: format(startOfWeek(cursor, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(cursor, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      }
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') }
  }, [cursor, view])

  useEffect(() => {
    Promise.all([
      supabase
        .from('bookings')
        .select('*, clients(*), services(*)')
        .not('status', 'in', '(cancelled,declined)'),
      supabase
        .from('availability_slots')
        .select('*')
        .gte('slot_date', range.start)
        .lte('slot_date', range.end)
        .neq('status', 'removed'),
    ]).then(([b, s]) => {
      setBookings((b.data as Booking[]) ?? [])
      setSlots((s.data as AvailabilitySlot[]) ?? [])
    })
  }, [range.start, range.end])

  const days = useMemo(() => {
    if (view === 'day') return [cursor]
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end: endOfWeek(cursor, { weekStartsOn: 1 }) })
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [cursor, view])

  function itemsForDay(day: Date): CalendarItem[] {
    const dayKey = format(day, 'yyyy-MM-dd')
    const bookingItems: CalendarItem[] = bookings
      .filter((b) => {
        const d = bookingDay(b)
        return d && isSameDay(d, day)
      })
      .map((booking) => ({
        kind: 'booking' as const,
        time: booking.confirmed_start
          ? format(parseISO(booking.confirmed_start), 'HH:mm')
          : (booking.requested_time ?? '').slice(0, 5),
        booking,
      }))

    const bookedSlotIds = new Set(
      bookingItems
        .map((i) => (i.kind === 'booking' ? i.booking.availability_slot_id : null))
        .filter(Boolean),
    )

    const slotItems: CalendarItem[] = slots
      .filter((s) => s.slot_date === dayKey)
      .filter((s) => {
        // Avoid duplicate rows when a booking already represents this slot
        if (s.booking_id && bookingItems.some((i) => i.kind === 'booking' && i.booking.id === s.booking_id)) {
          return false
        }
        if (bookedSlotIds.has(s.id) && (s.status === 'confirmed' || s.status === 'requested')) {
          return false
        }
        return true
      })
      .map((slot) => ({
        kind: 'slot' as const,
        time: slot.start_time.slice(0, 5),
        slot,
      }))

    return [...bookingItems, ...slotItems].sort((a, b) => a.time.localeCompare(b.time))
  }

  function shift(dir: -1 | 1) {
    if (view === 'day') setCursor(addDays(cursor, dir))
    else if (view === 'week') setCursor(addDays(cursor, dir * 7))
    else setCursor(addMonths(cursor, dir))
  }

  function itemLink(item: CalendarItem): string {
    if (item.kind === 'booking') return `/admin/bookings/${item.booking.id}`
    if (item.slot.status === 'available' || item.slot.status === 'blocked') return '/admin/availability'
    if (item.slot.booking_id) return `/admin/bookings/${item.slot.booking_id}`
    return '/admin/availability'
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Calendar</h1>
          <p className="meta">{format(cursor, view === 'month' ? 'MMMM yyyy' : 'd MMM yyyy')}</p>
        </div>
        <div className="action-row">
          <button className="btn btn-ghost" type="button" onClick={() => shift(-1)}>
            Prev
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setCursor(new Date())}>
            Today
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => shift(1)}>
            Next
          </button>
          <select value={view} onChange={(e) => setView(e.target.value as View)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          <Link className="btn btn-primary" to="/admin/availability">
            + Release Slots
          </Link>
        </div>
      </div>

      <div className={view === 'month' ? 'stat-grid' : 'list'}>
        {days.map((day) => {
          const items = itemsForDay(day)

          return (
            <div
              key={day.toISOString()}
              className="panel"
              style={{
                opacity: view === 'month' && !isSameMonth(day, cursor) ? 0.45 : 1,
                minHeight: view === 'month' ? 120 : undefined,
              }}
            >
              <h2 style={{ fontSize: '1.1rem' }}>{format(day, view === 'month' ? 'd' : 'EEE d MMM')}</h2>
              <div className="list">
                {items.map((item) => {
                  const label = calendarLabel(item)
                  if (item.kind === 'booking') {
                    const b = item.booking
                    return (
                      <Link
                        key={`b-${b.id}`}
                        className="list-item"
                        to={itemLink(item)}
                        style={{
                          borderLeft: `4px solid ${b.booking_type === 'wig' ? 'var(--sage)' : 'var(--accent)'}`,
                        }}
                      >
                        <div>
                          <h3 style={{ fontSize: '1rem' }}>
                            {formatTime(item.time)} · {b.clients?.full_name}
                          </h3>
                          <p className="meta">
                            {label} · {b.services?.name} · {bookingTypeLabel(b.booking_type)}
                            {b.suburb ? ` · ${b.suburb}` : ''}
                          </p>
                        </div>
                        <BookingStatusBadge status={b.status} />
                      </Link>
                    )
                  }
                  const s = item.slot
                  return (
                    <Link
                      key={`s-${s.id}`}
                      className="list-item"
                      to={itemLink(item)}
                      style={{
                        borderLeft: `4px solid ${
                          s.status === 'blocked'
                            ? 'var(--danger)'
                            : s.status === 'available'
                              ? 'var(--ok)'
                              : 'var(--warn)'
                        }`,
                      }}
                    >
                      <div>
                        <h3 style={{ fontSize: '1rem' }}>
                          {formatTime(s.start_time)} · {label}
                        </h3>
                        <p className="meta">
                          {slotTypeShort(s.appointment_type)} · {s.duration_minutes} min
                          {s.admin_note ? ` · ${s.admin_note}` : ''}
                        </p>
                      </div>
                      <SlotStatusBadge status={s.status} />
                    </Link>
                  )
                })}
                {items.length === 0 && view !== 'month' ? <p className="admin-empty">No appointments</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
