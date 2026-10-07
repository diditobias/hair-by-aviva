import { MemberOffers } from '../../components/offers/MemberOffers'

export function AccountOffersPage() {
  return (
    <section className="account-page">
      <div className="section-head">
        <h2>Offers & announcements</h2>
        <p>Deals, sales, and visit rewards from Aviva. Only signed-in clients can see and claim these.</p>
      </div>
      <MemberOffers />
    </section>
  )
}
