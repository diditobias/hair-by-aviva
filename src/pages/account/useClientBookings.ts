import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Booking, Client } from '../../lib/types'

const BOOKING_SELECT =
  'id, client_id, service_id, availability_slot_id, booking_type, booking_source, requested_date, requested_time, confirmed_start, confirmed_end, alternative_date, alternative_time, suburb, customer_address, number_of_people, customer_notes, client_message, status, created_at, updated_at, services(name, duration_minutes, price_from)'

export function useClientBookings() {
  const { user, profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    const { data: clientRow } = await supabase
      .from('clients')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    let c = clientRow as Client | null
    if (!c) {
      const { data: created, error: createError } = await supabase
        .from('clients')
        .insert({
          auth_user_id: user.id,
          full_name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Client',
          email: profile?.email ?? user.email,
          phone: profile?.phone,
        })
        .select('*')
        .single()
      if (createError) {
        setError(createError.message)
        setLoading(false)
        return
      }
      c = created as Client
    }

    setClient(c)

    const { data: rows, error: bookingError } = await supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('client_id', c.id)
      .order('requested_date', { ascending: false })

    if (bookingError) setError(bookingError.message)
    setBookings(((rows as unknown) as Booking[]) ?? [])
    setLoading(false)
  }, [user, profile])

  useEffect(() => {
    void reload()
  }, [reload])

  return { client, bookings, loading, error, reload, setClient, setBookings }
}

export function isUpcoming(status: Booking['status']) {
  return !['completed', 'cancelled', 'declined'].includes(status)
}

export function isPending(status: Booking['status']) {
  return ['requested', 'awaiting_confirmation', 'reschedule_requested'].includes(status)
}

export function serviceName(booking: Booking) {
  return (booking as Booking & { services?: { name?: string } }).services?.name ?? 'Appointment'
}
