import { type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import {
  OFFER_KIND_LABELS,
  type Offer,
  type OfferClaimStatus,
  type OfferKind,
} from '../../lib/types'

type ClaimRow = {
  id: string
  offer_id: string
  user_id: string
  status: OfferClaimStatus
  claimed_at: string
  redeemed_at: string | null
  offers: { title: string; kind: OfferKind } | null
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null
}

const empty = {
  title: '',
  body: '',
  kind: 'deal' as OfferKind,
  highlight: '',
  visits_required: '' as number | '',
  published: true,
  starts_on: '',
  ends_on: '',
}

type Draft = typeof empty & { id?: string }

export function OffersAdminPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [editing, setEditing] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [offerRes, claimRes] = await Promise.all([
      supabase.from('offers').select('*').order('created_at', { ascending: false }),
      supabase
        .from('offer_claims')
        .select('id, offer_id, user_id, status, claimed_at, redeemed_at, offers(title, kind), profiles(first_name, last_name, email)')
        .order('claimed_at', { ascending: false }),
    ])
    setOffers((offerRes.data as Offer[]) ?? [])
    setClaims((claimRes.data as unknown as ClaimRow[]) ?? [])
    if (offerRes.error) setError(offerRes.error.message)
    else if (claimRes.error) setError(claimRes.error.message)
  }

  useEffect(() => {
    void load()
  }, [])

  function startEdit(offer: Offer) {
    setEditing({
      id: offer.id,
      title: offer.title,
      body: offer.body,
      kind: offer.kind,
      highlight: offer.highlight ?? '',
      visits_required: offer.visits_required ?? '',
      published: offer.published,
      starts_on: offer.starts_on ?? '',
      ends_on: offer.ends_on ?? '',
    })
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!editing?.title.trim() || !editing.body.trim()) return
    if (editing.kind === 'reward' && (!editing.visits_required || Number(editing.visits_required) < 1)) {
      setError('A loyalty reward needs the number of completed visits required.')
      return
    }
    setBusy(true)
    setError(null)
    const payload = {
      title: editing.title.trim(),
      body: editing.body.trim(),
      kind: editing.kind,
      highlight: editing.highlight.trim() || null,
      visits_required:
        editing.kind === 'announcement' || editing.visits_required === ''
          ? null
          : Number(editing.visits_required),
      published: editing.published,
      starts_on: editing.starts_on || null,
      ends_on: editing.ends_on || null,
    }
    const result = editing.id
      ? await supabase.from('offers').update(payload).eq('id', editing.id)
      : await supabase.from('offers').insert(payload)
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setEditing(null)
    await load()
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this offer? Claims for it will be removed too.')) return
    const { error: deleteError } = await supabase.from('offers').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    await load()
  }

  async function redeem(id: string) {
    const { error: updateError } = await supabase
      .from('offer_claims')
      .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
      .eq('id', id)
    if (updateError) setError(updateError.message)
    await load()
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Offers</h1>
          <p className="meta">
            Post a deal, sale, or announcement. For a free visit or similar reward, choose loyalty reward
            and set how many completed appointments unlock it.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setEditing({ ...empty })}>
          New offer
        </button>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="list">
        {offers.length === 0 ? <p className="meta">No offers yet.</p> : null}
        {offers.map((offer) => (
          <div key={offer.id} className="list-item">
            <div>
              <h3>
                {offer.title} {!offer.published ? '(draft)' : ''}
              </h3>
              <p className="meta">
                {OFFER_KIND_LABELS[offer.kind]}
                {offer.highlight ? ` · ${offer.highlight}` : ''}
                {offer.visits_required ? ` · after ${offer.visits_required} completed visits` : ''}
                {offer.starts_on || offer.ends_on
                  ? ` · ${offer.starts_on || 'any time'} to ${offer.ends_on || 'open'}`
                  : ''}
              </p>
            </div>
            <div className="action-row">
              <button className="btn btn-ghost" type="button" onClick={() => startEdit(offer)}>
                Edit
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => remove(offer.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <form className="panel admin-form" onSubmit={onSave}>
          <h2>{editing.id ? 'Edit offer' : 'New offer'}</h2>
          <div className="row two">
            <label className="field">
              Title
              <input
                required
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="field">
              Type
              <select
                value={editing.kind}
                onChange={(e) => setEditing({ ...editing, kind: e.target.value as OfferKind })}
              >
                <option value="deal">Deal</option>
                <option value="sale">Sale</option>
                <option value="announcement">Announcement</option>
                <option value="reward">Loyalty reward</option>
              </select>
            </label>
            <label className="field">
              Highlight
              <input
                placeholder="20% off, Free visit…"
                value={editing.highlight}
                onChange={(e) => setEditing({ ...editing, highlight: e.target.value })}
              />
            </label>
            <label className="field">
              Completed visits required
              <input
                type="number"
                min={1}
                placeholder={editing.kind === 'reward' ? 'e.g. 5' : 'Optional'}
                value={editing.visits_required}
                disabled={editing.kind === 'announcement'}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    visits_required: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              Starts
              <input
                type="date"
                value={editing.starts_on}
                onChange={(e) => setEditing({ ...editing, starts_on: e.target.value })}
              />
            </label>
            <label className="field">
              Ends
              <input
                type="date"
                value={editing.ends_on}
                onChange={(e) => setEditing({ ...editing, ends_on: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            Message
            <textarea
              required
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            />
          </label>
          <p className="meta">
            Deal and sale titles can show on the public site. The full message, announcements, and
            rewards are only visible after a client signs in. Completed visits are appointments you mark
            as completed.
          </p>
          <label className="field" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={editing.published}
              onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
            />
            Published
          </label>
          <div className="action-row">
            <button className="btn btn-primary" disabled={busy} type="submit">
              Save
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Claims</h2>
        {claims.length === 0 ? <p className="meta">No one has claimed an offer yet.</p> : null}
        <div className="list">
          {claims.map((claim) => {
            const name =
              [claim.profiles?.first_name, claim.profiles?.last_name].filter(Boolean).join(' ') ||
              claim.profiles?.email ||
              'Client'
            return (
              <div key={claim.id} className="list-item">
                <div>
                  <h3>{name}</h3>
                  <p className="meta">
                    {claim.offers?.title ?? 'Offer'} · {claim.status} · {formatDateTime(claim.claimed_at)}
                  </p>
                </div>
                {claim.status === 'claimed' ? (
                  <button className="btn btn-secondary" type="button" onClick={() => redeem(claim.id)}>
                    Mark used
                  </button>
                ) : (
                  <span className="meta">Used</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
