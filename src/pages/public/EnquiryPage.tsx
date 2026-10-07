import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export function EnquiryPage() {
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

  if (done) {
    return (
      <section className="section section-narrow">
        <div className="notice ok">Thanks — your enquiry has been sent. Aviva will get back to you soon.</div>
      </section>
    )
  }

  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>Send an enquiry</h2>
        <p>No account needed. Ask about availability, services or anything else.</p>
      </div>
      <form className="form-stack" onSubmit={onSubmit}>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="form-row two">
          <label className="field">
            Name
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </label>
          <label className="field">
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
        </div>
        <div className="form-row two">
          <label className="field">
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
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
        </div>
        <label className="field">
          Subject
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </label>
        <label className="field">
          Message
          <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </label>
        <button className="btn btn-primary" disabled={submitting} type="submit">
          {submitting ? 'Sending…' : 'Send enquiry'}
        </button>
      </form>
    </section>
  )
}
