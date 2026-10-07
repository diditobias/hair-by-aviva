import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { BookingSource, BookingType, Client, Service } from '../../lib/types'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'

export function NewBookingPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { settings } = useBusinessSettings()
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id: params.get('client') ?? '',
    full_name: params.get('name') ?? '',
    email: params.get('email') ?? '',
    phone: params.get('phone') ?? '',
    suburb: '',
    service_id: '',
    booking_type: 'home_visit' as BookingType,
    booking_source: 'admin' as BookingSource,
    requested_date: '',
    requested_time: '',
    customer_address: '',
    admin_notes: '',
    customer_notes: '',
    travel_buffer_minutes: settings?.default_travel_buffer_minutes ?? 30,
    confirm_now: true,
  })

  useEffect(() => {
    if (params.get('name') && !params.get('client')) setMode('new')
  }, [params])

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('*').order('full_name'),
      supabase.from('services').select('*').eq('active', true).order('sort_order'),
    ]).then(([c, s]) => {
      setClients((c.data as Client[]) ?? [])
      setServices((s.data as Service[]) ?? [])
    })
  }, [])

  useEffect(() => {
    if (settings?.default_travel_buffer_minutes != null) {
      setForm((f) => ({ ...f, travel_buffer_minutes: settings.default_travel_buffer_minutes }))
    }
  }, [settings])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    let clientId = form.client_id
    if (mode === 'new') {
      const { data, error: clientErr } = await supabase
        .from('clients')
        .insert({
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
          suburb: form.suburb || null,
        })
        .select('id')
        .single()
      if (clientErr) {
        setBusy(false)
        setError(clientErr.message)
        return
      }
      clientId = data.id
    }

    const duration = services.find((s) => s.id === form.service_id)?.duration_minutes ?? 60
    let confirmed_start: string | null = null
    let confirmed_end: string | null = null
    if (form.confirm_now && form.requested_date && form.requested_time) {
      const start = new Date(`${form.requested_date}T${form.requested_time}`)
      confirmed_start = start.toISOString()
      confirmed_end = new Date(start.getTime() + duration * 60000).toISOString()
    }

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        service_id: form.service_id || null,
        created_by: user?.id ?? null,
        booking_source: form.booking_source,
        booking_type: form.booking_type,
        requested_date: form.requested_date || null,
        requested_time: form.requested_time || null,
        confirmed_start,
        confirmed_end,
        suburb: form.suburb || null,
        customer_address: form.customer_address || null,
        admin_notes: form.admin_notes || null,
        customer_notes: form.customer_notes || null,
        travel_buffer_minutes: form.travel_buffer_minutes,
        status: form.confirm_now ? 'confirmed' : 'requested',
      })
      .select('id')
      .single()

    setBusy(false)
    if (bookingErr) {
      setError(bookingErr.message)
      return
    }
    navigate(`/admin/bookings/${booking.id}`)
  }

  return (
    <>
      <div className="admin-topbar">
        <h1>New Booking</h1>
      </div>
      <form className="panel admin-form" onSubmit={onSubmit}>
        {error ? <div className="notice error">{error}</div> : null}

        <div className="action-row">
          <button type="button" className={`btn ${mode === 'existing' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('existing')}>
            Existing client
          </button>
          <button type="button" className={`btn ${mode === 'new' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('new')}>
            New client
          </button>
        </div>

        {mode === 'existing' ? (
          <label className="field">
            Client
            <select required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                  {c.phone ? ` · ${c.phone}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="row two">
            <label className="field">
              Full name
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </label>
            <label className="field">
              Phone
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="field">
              Email
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field">
              Suburb
              <input value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
            </label>
          </div>
        )}

        <div className="row two">
          <label className="field">
            Booking type
            <select
              value={form.booking_type}
              onChange={(e) => setForm({ ...form, booking_type: e.target.value as BookingType })}
            >
              <option value="home_visit">Home visit</option>
              <option value="wig">Wig / Sheitel</option>
              <option value="pickup">Wig collection</option>
            </select>
          </label>
          <label className="field">
            Source
            <select
              value={form.booking_source}
              onChange={(e) => setForm({ ...form, booking_source: e.target.value as BookingSource })}
            >
              <option value="admin">Admin</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone</option>
              <option value="instagram">Instagram</option>
              <option value="referral">Referral</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <label className="field">
          Service
          <select required value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
            <option value="">Select service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="row two">
          <label className="field">
            Date
            <input type="date" required value={form.requested_date} onChange={(e) => setForm({ ...form, requested_date: e.target.value })} />
          </label>
          <label className="field">
            Time
            <input type="time" required value={form.requested_time} onChange={(e) => setForm({ ...form, requested_time: e.target.value })} />
          </label>
        </div>

        {form.booking_type === 'home_visit' ? (
          <div className="row two">
            <label className="field">
              Suburb
              <input value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
            </label>
            <label className="field">
              Address
              <input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
            </label>
            <label className="field">
              Travel buffer (mins)
              <input
                type="number"
                min={0}
                value={form.travel_buffer_minutes}
                onChange={(e) => setForm({ ...form, travel_buffer_minutes: Number(e.target.value) })}
              />
            </label>
          </div>
        ) : null}

        <label className="field">
          Admin notes
          <textarea value={form.admin_notes} onChange={(e) => setForm({ ...form, admin_notes: e.target.value })} />
        </label>

        <label className="field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={form.confirm_now}
            onChange={(e) => setForm({ ...form, confirm_now: e.target.checked })}
          />
          Confirm appointment now
        </label>

        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Create booking'}
        </button>
      </form>
    </>
  )
}
