import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { OFFER_KIND_LABELS, type Offer, type OfferClaim, type OfferKind } from '../../lib/types'

function todayKey() {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function isLive(offer: Offer) {
  const today = todayKey()
  if (!offer.published) return false
  if (offer.starts_on && offer.starts_on > today) return false
  if (offer.ends_on && offer.ends_on < today) return false
  return true
}

function progressLabel(visits: number, required: number | null) {
  if (!required) return null
  if (visits >= required) return `${visits} completed visits — ready to claim`
  const left = required - visits
  return `${visits} of ${required} completed visits · ${left} to go`
}

export function MemberOffers() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [claims, setClaims] = useState<OfferClaim[]>([])
  const [visits, setVisits] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [offerRes, claimRes, visitRes] = await Promise.all([
      supabase.from('offers').select('*').order('sort_order').order('created_at', { ascending: false }),
      supabase.from('offer_claims').select('*'),
      supabase.rpc('my_completed_visits'),
    ])
    if (offerRes.error) setError(offerRes.error.message)
    setOffers(((offerRes.data as Offer[]) ?? []).filter(isLive))
    setClaims((claimRes.data as OfferClaim[]) ?? [])
    setVisits(typeof visitRes.data === 'number' ? visitRes.data : 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function claim(offerId: string) {
    setBusyId(offerId)
    setError(null)
    const { error: claimError } = await supabase.rpc('claim_offer', { p_offer_id: offerId })
    setBusyId(null)
    if (claimError) {
      setError(claimError.message)
      return
    }
    await load()
  }

  if (loading) return <p className="meta">Loading offers…</p>

  const announcements = offers.filter((o) => o.kind === 'announcement')
  const promotions = offers.filter((o) => o.kind === 'deal' || o.kind === 'sale')
  const rewards = offers.filter((o) => o.kind === 'reward')
  const claimByOffer = new Map(claims.map((c) => [c.offer_id, c]))

  return (
    <div className="offer-stack">
      {error ? <div className="notice error">{error}</div> : null}

      <div className="account-panel">
        <h3>Your visits</h3>
        <p>
          {visits === 1 ? '1 completed visit' : `${visits} completed visits`} with Aviva. Rewards unlock
          after the number of visits she chooses.
        </p>
      </div>

      <OfferGroup title="Announcements" empty="No announcements right now." items={announcements}>
        {announcements.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </OfferGroup>

      <OfferGroup title="Deals & sales" empty="No deals to claim right now." items={promotions}>
        {promotions.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            visits={visits}
            claim={claimByOffer.get(offer.id)}
            busy={busyId === offer.id}
            onClaim={() => claim(offer.id)}
          />
        ))}
      </OfferGroup>

      <OfferGroup title="Visit rewards" empty="Aviva has not posted a visit reward yet." items={rewards}>
        {rewards.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            visits={visits}
            claim={claimByOffer.get(offer.id)}
            busy={busyId === offer.id}
            onClaim={() => claim(offer.id)}
          />
        ))}
      </OfferGroup>
    </div>
  )
}

function OfferGroup({
  title,
  empty,
  items,
  children,
}: {
  title: string
  empty: string
  items: Offer[]
  children: ReactNode
}) {
  return (
    <section>
      <h3 className="offer-group-title">{title}</h3>
      {items.length > 0 ? <div className="offer-grid">{children}</div> : <p className="meta">{empty}</p>}
    </section>
  )
}

function OfferCard({
  offer,
  visits = 0,
  claim,
  busy,
  onClaim,
}: {
  offer: Offer
  visits?: number
  claim?: OfferClaim
  busy?: boolean
  onClaim?: () => void
}) {
  const required = offer.visits_required
  const ready = required == null || visits >= required
  const progress = required ? Math.min(100, Math.round((visits / required) * 100)) : 0

  return (
    <article className="offer-card">
      <div className="offer-card-top">
        <div>
          <p className="offer-kind">{OFFER_KIND_LABELS[offer.kind as OfferKind]}</p>
          <h3>{offer.title}</h3>
        </div>
        {offer.highlight ? <span className="offer-badge">{offer.highlight}</span> : null}
      </div>
      <p>{offer.body}</p>
      {required ? (
        <>
          <p className="meta">{progressLabel(visits, required)}</p>
          <div className="loyalty-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </>
      ) : null}
      {offer.kind !== 'announcement' && onClaim ? <ClaimState claim={claim} ready={ready} busy={busy} onClaim={onClaim} /> : null}
    </article>
  )
}

function ClaimState({
  claim,
  ready,
  busy,
  onClaim,
}: {
  claim?: OfferClaim
  ready: boolean
  busy?: boolean
  onClaim: () => void
}) {
  if (claim?.status === 'redeemed') return <p className="meta">Used</p>
  if (claim) return <p className="meta">Claimed — mention it when you book and Aviva will apply it.</p>
  if (!ready) return <p className="meta">Keep booking. This unlocks once you reach the visits Aviva set.</p>
  return (
    <button className="btn btn-primary" type="button" disabled={busy} onClick={onClaim}>
      {busy ? 'Claiming…' : 'Claim'}
    </button>
  )
}
