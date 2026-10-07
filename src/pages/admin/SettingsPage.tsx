import { type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BusinessSettings } from '../../lib/types'

export function SettingsPage() {
  const [form, setForm] = useState<Partial<BusinessSettings> | null>(null)
  const [areasText, setAreasText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('business_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        const s = data as BusinessSettings | null
        setForm(s)
        setAreasText((s?.service_areas ?? []).join(', '))
      })
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        id: 1,
        ...form,
        service_areas: areasText
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      })
    setBusy(false)
    setMessage(error ? error.message : 'Settings saved.')
  }

  if (!form) return <div className="admin-loading">Loading settings…</div>

  return (
    <>
      <div className="admin-topbar">
        <h1>Settings</h1>
      </div>
      <form className="panel admin-form" onSubmit={onSubmit}>
        {message ? <div className={message.includes('saved') ? 'notice ok' : 'notice error'}>{message}</div> : null}

        <h2>Business</h2>
        <div className="row two">
          <label className="field">
            Business name
            <input value={form.business_name ?? ''} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          </label>
          <label className="field">
            Tagline
            <input value={form.tagline ?? ''} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </label>
          <label className="field">
            Phone
            <input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="field">
            WhatsApp
            <input value={form.whatsapp ?? ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </label>
          <label className="field">
            Email
            <input value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="field">
            Instagram URL
            <input value={form.instagram ?? ''} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
          </label>
        </div>

        <h2>Booking</h2>
        <div className="row two">
          {(
            [
              ['accept_bookings', 'Accept bookings'],
              ['home_visits_enabled', 'Home visits'],
              ['wig_appointments_enabled', 'Wig appointments'],
              ['show_prices', 'Show prices'],
              ['show_testimonials', 'Show testimonials'],
              ['show_instagram', 'Show Instagram'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <label className="field">
            Default travel buffer (mins)
            <input
              type="number"
              value={form.default_travel_buffer_minutes ?? 30}
              onChange={(e) => setForm({ ...form, default_travel_buffer_minutes: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Notification email
            <input
              value={form.notification_email ?? ''}
              onChange={(e) => setForm({ ...form, notification_email: e.target.value })}
            />
          </label>
        </div>

        <h2>Service area (Johannesburg)</h2>
        <label className="field">
          Areas / suburbs (comma separated)
          <input
            value={areasText}
            onChange={(e) => setAreasText(e.target.value)}
            placeholder="Johannesburg, Glenhazel, Sydenham, Sandton…"
          />
        </label>
        <label className="field">
          Travel fee message
          <input
            value={form.travel_fee_message ?? ''}
            onChange={(e) => setForm({ ...form, travel_fee_message: e.target.value })}
            placeholder="Travel fees may apply outside central Johannesburg."
          />
        </label>

        <h2>Website</h2>
        <label className="field">
          Announcement banner
          <input
            value={form.announcement_banner ?? ''}
            onChange={(e) => setForm({ ...form, announcement_banner: e.target.value })}
          />
        </label>

        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </>
  )
}
