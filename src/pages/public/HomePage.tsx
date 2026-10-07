import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import heroImg from '../../assets/hero-sheitel-v3.jpg'
import logo from '../../assets/logo.png'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'
import { formatPrice, whatsappLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { ideas } from '../../lib/ideas'
import type { Service } from '../../lib/types'

export function HomePage() {
  const { settings } = useBusinessSettings()
  const wa = whatsappLink(settings?.whatsapp ?? settings?.phone ?? '+27725783392', 'Hi Aviva!')
  const [services, setServices] = useState<Service[]>([])

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .limit(4)
      .then(({ data }) => setServices((data as Service[]) ?? []))
  }, [])

  return (
    <>
      <section className="hero">
        <img className="hero-media" src={heroImg} alt="" />
        <div className="hero-copy">
          <img className="brand-logo brand-logo--hero" src={logo} alt="Hair by Aviva" />
          <h1>Hair at home. Wigs with expertise.</h1>
          <p>
            {settings?.tagline ??
              'Home visits and wig styling across Johannesburg — with care, calm and precision.'}
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/book">
              Request a booking
            </Link>
            <Link className="btn btn-ghost" to="/availability">
              See available times
            </Link>
            {wa ? (
              <a className="btn btn-ghost" href={wa} target="_blank" rel="noreferrer">
                WhatsApp Aviva
              </a>
            ) : (
              <Link className="btn btn-ghost" to="/services">
                View services
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How Aviva works with you</h2>
          <p>
            Home hair visits and private wig appointments across Johannesburg — requested online,
            confirmed personally.
          </p>
        </div>
        <div className="service-list">
          {settings?.home_visits_enabled !== false ? (
            <div className="service-row">
              <div>
                <h3>Home hair visits</h3>
                <p>Cuts, blow-drys and occasion styling in the comfort of your home.</p>
              </div>
              <Link className="btn btn-secondary" to="/book?type=home_visit">
                Book a visit
              </Link>
            </div>
          ) : null}
          {settings?.wig_appointments_enabled !== false ? (
            <div className="service-row">
              <div>
                <h3>Wig & sheitel appointments</h3>
                <p>Cutting and styling for wigs and sheitels in a private studio setting.</p>
              </div>
              <Link className="btn btn-secondary" to="/book?type=wig">
                Book wig appointment
              </Link>
            </div>
          ) : null}
          <div className="service-row">
            <div>
              <h3>Wig collection</h3>
              <p>Pick up a finished wig or sheitel in a short released slot.</p>
            </div>
            <Link className="btn btn-secondary" to="/book?type=pickup">
              Book a collection
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-narrow">
        <div className="section-head">
          <h2>Booking in three steps</h2>
          <p>No account needed to request an appointment.</p>
        </div>
        <div className="service-list">
          <div className="service-row">
            <div>
              <h3>1. Choose a service</h3>
              <p>Pick home visit or wig styling, and share your preferred date and time.</p>
            </div>
          </div>
          <div className="service-row">
            <div>
              <h3>2. Aviva reviews your request</h3>
              <p>She checks travel, timing and availability, then confirms or suggests another slot.</p>
            </div>
          </div>
          <div className="service-row">
            <div>
              <h3>3. You get confirmation</h3>
              <p>Once locked in, you receive confirmation. Manage appointments anytime in My account.</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <Link className="btn btn-primary" to="/book">
            Request a booking
          </Link>
          <Link className="btn btn-ghost" to="/availability">
            See available times
          </Link>
          <Link className="btn btn-ghost" to="/services">
            Browse services
          </Link>
        </div>
      </section>

      {services.length > 0 ? (
        <section className="section section-narrow">
          <div className="section-head">
            <h2>Popular services</h2>
            <p>A few of Aviva&apos;s regular offerings. Full list on the services page.</p>
          </div>
          <div className="service-list">
            {services.map((s) => (
              <div className="service-row" key={s.id}>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <p className="meta">
                    {s.duration_minutes} mins · {s.wig_appointment ? 'Wig / sheitel' : 'Home visit'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {settings?.show_prices && s.display_price && s.price_from != null ? (
                    <div className="price">from {formatPrice(Number(s.price_from))}</div>
                  ) : null}
                  <Link className="btn btn-secondary" style={{ marginTop: '0.6rem' }} to={`/book?service=${s.id}`}>
                    Request
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <Link className="btn btn-ghost" to="/services">
              View all services
            </Link>
          </div>
        </section>
      ) : null}

      <section className="section section-narrow">
        <div className="section-head">
          <h2>Deals, news, and visit rewards</h2>
          <p>
            Create a free account to get Aviva&apos;s announcements and claim deals. Visit a few times and
            you can unlock a reward she chooses — a free visit, or something else — once your completed
            appointments reach the number she sets.
          </p>
        </div>
        <Link className="btn btn-secondary" to="/offers">
          See offers
        </Link>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Looks to bring along</h2>
          <p>Browse waves, layers and occasion styles, then tell Aviva which one you have in mind.</p>
        </div>
        <div className="ideas-strip">
          {ideas.map((idea) => (
            <Link key={idea.id} className="ideas-strip-item" to={`/ideas?idea=${idea.id}`}>
              <img src={idea.image} alt={idea.alt} />
              <span>{idea.title}</span>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: '1.25rem' }}>
          <Link className="btn btn-secondary" to="/ideas">
            Browse ideas
          </Link>
        </div>
      </section>

      <section className="section section-narrow">
        <div className="section-head">
          <h2>Questions or ready to book?</h2>
          <p>
            {settings?.service_areas?.length
              ? `Serving ${settings.service_areas.join(', ')}.`
              : 'Based in Johannesburg — ask about your suburb when you get in touch.'}{' '}
            {settings?.travel_fee_message ?? ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/book">
            Request booking
          </Link>
          <Link className="btn btn-secondary" to="/contact">
            Contact Aviva
          </Link>
          <Link className="btn btn-ghost" to="/faq">
            FAQs
          </Link>
        </div>
      </section>
    </>
  )
}
