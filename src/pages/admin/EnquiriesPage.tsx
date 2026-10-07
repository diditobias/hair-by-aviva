import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Enquiry, EnquiryStatus } from '../../lib/types'
import { EnquiryStatusBadge } from '../../components/shared/StatusBadge'
import { formatDateTime, mailLink, telLink, whatsappLink } from '../../lib/format'

export function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [selected, setSelected] = useState<Enquiry | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false })
    setEnquiries((data as Enquiry[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function setStatus(status: EnquiryStatus) {
    if (!selected) return
    await supabase.from('enquiries').update({ status }).eq('id', selected.id)
    setSelected({ ...selected, status })
    await load()
  }

  return (
    <>
      <div className="admin-topbar">
        <h1>Enquiries</h1>
      </div>
      {loading ? <div className="admin-loading">Loading…</div> : null}
      <div className="detail-grid two">
        <div className="list">
          {enquiries.map((e) => (
            <button
              key={e.id}
              type="button"
              className="list-item"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setSelected(e)}
            >
              <div>
                <h3>{e.full_name}</h3>
                <p className="meta">
                  {formatDateTime(e.created_at)} · {e.subject || e.category || 'Enquiry'}
                </p>
              </div>
              <EnquiryStatusBadge status={e.status} />
            </button>
          ))}
          {!loading && enquiries.length === 0 ? <p className="admin-empty">No enquiries yet.</p> : null}
        </div>

        <div className="panel">
          {selected ? (
            <>
              <h2>{selected.full_name}</h2>
              <p className="meta" style={{ marginBottom: '0.75rem' }}>
                {formatDateTime(selected.created_at)}
              </p>
              <div className="kv">
                <span>Subject</span>
                <strong>{selected.subject || selected.category || '—'}</strong>
              </div>
              <div className="kv">
                <span>Message</span>
                <strong style={{ whiteSpace: 'pre-wrap' }}>{selected.message}</strong>
              </div>
              <div className="action-row" style={{ margin: '1rem 0' }}>
                {telLink(selected.phone) ? (
                  <a className="btn btn-secondary" href={telLink(selected.phone)!}>
                    Call
                  </a>
                ) : null}
                {whatsappLink(selected.phone) ? (
                  <a className="btn btn-secondary" href={whatsappLink(selected.phone)!} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                ) : null}
                {mailLink(selected.email) ? (
                  <a className="btn btn-ghost" href={mailLink(selected.email)!}>
                    Email
                  </a>
                ) : null}
              </div>
              <div className="action-row">
                <button className="btn btn-secondary" type="button" onClick={() => setStatus('in_progress')}>
                  In progress
                </button>
                <button className="btn btn-primary" type="button" onClick={() => setStatus('replied')}>
                  Mark replied
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setStatus('closed')}>
                  Close
                </button>
                <Link
                  className="btn btn-secondary"
                  to={`/admin/bookings/new?name=${encodeURIComponent(selected.full_name)}&email=${encodeURIComponent(selected.email ?? '')}&phone=${encodeURIComponent(selected.phone ?? '')}`}
                >
                  Convert to booking
                </Link>
              </div>
            </>
          ) : (
            <p className="admin-empty">Select an enquiry to read it.</p>
          )}
        </div>
      </div>
    </>
  )
}
