import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'
import { mailLink, telLink, whatsappLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'

const DEFAULT_EMAIL = 'avivatobias@gmail.com'
const DEFAULT_WHATSAPP = '+27725783392'

export function ContactPage() {
  const { settings } = useBusinessSettings()
  const email = settings?.email || DEFAULT_EMAIL
  const phone = settings?.phone || DEFAULT_WHATSAPP
  const whatsapp = settings?.whatsapp || settings?.phone || DEFAULT_WHATSAPP
  const wa = whatsappLink(whatsapp, 'Hi Aviva, I found you via Hair by Aviva.')
  const mail = mailLink(email, 'Hair by Aviva enquiry')
  const tel = telLink(phone)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    subject: '',
    category: 'General',
    preferred_contact: 'whatsapp',
    message: '',
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('submit_enquiry', {
      p_full_name: form.full_name,
      p_email: form.email || null,
      p_phone: form.phone || null,
      p_subject: form.subject || null,
      p_message: form.message,
      p_category: form.category || null,
      p_preferred_contact: form.preferred_contact || null,
    })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setDone(true)
  }

  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>Contact us</h2>
        <p>
          Based in Johannesburg — message Aviva directly, or send an enquiry below. Booking requests
          can also be made online.
        </p>
      </div>

      <div className="service-list">
        <div className="service-row">
          <div>
            <h3>Johannesburg, South Africa</h3>
            <p>
              Home visits across Johannesburg suburbs. Wig &amp; sheitel appointments at a private
              studio location (address shared after confirmation).
            </p>
          </div>
        </div>

        {wa ? (
          <a className="service-row" href={wa} target="_blank" rel="noreferrer">
            <div>
              <h3>WhatsApp</h3>
              <p>Usually the quickest way to reach Aviva on {whatsapp}</p>
            </div>
            <span className="btn btn-primary">WhatsApp Aviva</span>
          </a>
        ) : null}

        {tel ? (
          <a className="service-row" href={tel}>
            <div>
              <h3>Phone</h3>
              <p>{phone}</p>
            </div>
            <span className="btn btn-secondary">Call</span>
          </a>
        ) : null}

        {mail ? (
          <a className="service-row" href={mail}>
            <div>
              <h3>Email</h3>
              <p>{email}</p>
            </div>
            <span className="btn btn-secondary">Send email</span>
          </a>
        ) : null}

        {settings?.instagram && settings.show_instagram !== false ? (
          <a className="service-row" href={settings.instagram} target="_blank" rel="noreferrer">
            <div>
              <h3>Instagram</h3>
              <p>See recent work and get in touch via DM.</p>
            </div>
            <span className="btn btn-ghost">Open Instagram</span>
          </a>
        ) : null}

        <div className="service-row">
          <div>
            <h3>Book online</h3>
            <p>Request a home visit or wig appointment — Aviva confirms personally.</p>
          </div>
          <Link className="btn btn-primary" to="/book">
            Request booking
          </Link>
        </div>

        <div className="service-row">
          <div>
            <h3>Areas & travel</h3>
            {settings?.service_areas?.length ? (
              <p>{settings.service_areas.join(' · ')}</p>
            ) : (
              <p>Johannesburg & surrounds — ask about your suburb.</p>
            )}
            {settings?.travel_fee_message ? (
              <p className="meta">{settings.travel_fee_message}</p>
            ) : (
              <p className="meta">Travel fees may apply depending on distance.</p>
            )}
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: '3rem' }}>
        <h2>Send an enquiry</h2>
        <p>No account needed. Ask about availability, services, pricing or anything else.</p>
      </div>

      {done ? (
        <div className="notice ok">Thanks — your enquiry has been sent. Aviva will get back to you soon.</div>
      ) : (
        <form className="form-stack" onSubmit={onSubmit}>
          {error ? <div className="notice error">{error}</div> : null}
          <div className="form-row two">
            <label className="field">
              Name
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </label>
            <label className="field">
              Phone
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </div>
          <div className="form-row two">
            <label className="field">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="field">
              Preferred contact
              <select
                value={form.preferred_contact}
                onChange={(e) => setForm({ ...form, preferred_contact: e.target.value })}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
              </select>
            </label>
          </div>
          <div className="form-row two">
            <label className="field">
              Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>General</option>
                <option>Home visit</option>
                <option>Wig / Sheitel</option>
                <option>Pricing</option>
                <option>Availability</option>
              </select>
            </label>
            <label className="field">
              Subject
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </label>
          </div>
          <label className="field">
            Message
            <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </label>
          <button className="btn btn-primary" disabled={submitting} type="submit">
            {submitting ? 'Sending…' : 'Send enquiry'}
          </button>
        </form>
      )}

      <p className="meta" style={{ marginTop: '1.5rem' }}>
        Looking for policies or common questions? See <Link to="/faq">FAQs</Link> and{' '}
        <Link to="/policies">Policies</Link>.
      </p>
    </section>
  )
}
