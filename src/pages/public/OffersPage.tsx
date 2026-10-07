import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MemberOffers } from '../../components/offers/MemberOffers'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

type Teaser = {
  id: string
  title: string
  highlight: string | null
  kind: string
}

export function OffersPage() {
  const { session, loading, isStaff } = useAuth()
  const [teasers, setTeasers] = useState<Teaser[]>([])

  useEffect(() => {
    if (session) return
    supabase.rpc('list_offer_teasers').then(({ data }) => {
      setTeasers((data as Teaser[]) ?? [])
    })
  }, [session])

  if (loading) {
    return (
      <section className="section section-narrow">
        <p className="meta">Loading…</p>
      </section>
    )
  }

  if (session && !isStaff) {
    return (
      <section className="section section-narrow">
        <div className="section-head">
          <h2>Offers & announcements</h2>
          <p>Signed-in clients can read announcements and claim the deals Aviva posts.</p>
        </div>
        <MemberOffers />
      </section>
    )
  }

  if (session && isStaff) {
    return (
      <section className="section section-narrow">
        <div className="section-head">
          <h2>Offers & announcements</h2>
          <p>Post deals, sales, announcements, and visit rewards from the owner portal.</p>
        </div>
        <Link className="btn btn-primary" to="/admin/offers">
          Manage offers
        </Link>
      </section>
    )
  }

  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>Offers & announcements</h2>
        <p>
          Create a free account to hear from Aviva and claim deals. If you visit a few times, you can
          also unlock a reward — such as a free visit — once you reach the number of completed
          appointments she sets.
        </p>
      </div>

      {teasers.length > 0 ? (
        <div className="offer-grid">
          {teasers.map((teaser) => (
            <article className="offer-card" key={teaser.id}>
              <div className="offer-card-top">
                <div>
                  <p className="offer-kind">{teaser.kind === 'sale' ? 'Sale' : 'Deal'}</p>
                  <h3>{teaser.title}</h3>
                </div>
                {teaser.highlight ? <span className="offer-badge">{teaser.highlight}</span> : null}
              </div>
              <p className="meta">Sign in to read the details and claim this.</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="meta">
          There is no public deal posted right now. An account still receives announcements and loyalty
          rewards when Aviva publishes them.
        </p>
      )}

      <div className="account-quick-actions">
        <Link className="btn btn-primary" to="/signup" state={{ from: '/offers' }}>
          Create account
        </Link>
        <Link className="btn btn-ghost" to="/login" state={{ from: '/offers' }}>
          Log in
        </Link>
      </div>
    </section>
  )
}
