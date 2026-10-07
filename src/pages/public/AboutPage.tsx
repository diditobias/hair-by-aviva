import { Link } from 'react-router-dom'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'

export function AboutPage() {
  const { settings } = useBusinessSettings()

  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>Meet Aviva</h2>
        <p>
          Based in Johannesburg, Aviva brings personal hair and sheitel care to clients across the city —
          because for her, hair is more than just a service.
        </p>
      </div>

      <div className="prose" style={{ display: 'grid', gap: '1.25rem', marginBottom: '2rem' }}>
        <p>
          With a natural eye for style and a passion for helping people feel confident and beautiful,
          Aviva brings care, creativity, and personal attention to every appointment. Whether she&apos;s
          creating a fresh haircut, styling hair for a special occasion, or working with a sheitel, her
          focus is always on creating a look that feels natural, flattering, and right for the person
          wearing it.
        </p>
        <p>
          Aviva completed a <strong>professional sheitel and wig styling course in Jerusalem</strong>,
          where she developed specialist skills in cutting, styling, shaping, and caring for wigs. She
          has since spent the past year putting those skills into practice and continuing to grow her
          experience with both natural hair and sheitels.
        </p>
        <p>
          What makes <strong>Hair by Aviva</strong> special is the personal approach. There&apos;s no
          rushed salon experience or one-style-fits-all attitude. Aviva takes the time to understand
          what each client wants and works with their hair, face shape, style, and preferences to create
          something they&apos;ll genuinely love.
        </p>
        <p>
          For regular hair services, Aviva offers convenient <strong>home-call appointments</strong>,
          bringing the experience to you. Sheitel and wig services are offered through{' '}
          <strong>private appointments</strong>, giving each piece the time, attention, and care it
          deserves.
        </p>
        <p>
          Hair is Aviva&apos;s passion, and Hair by Aviva is about turning that passion into a personal
          experience — helping every client leave feeling polished, comfortable, and confident.
        </p>
        <p style={{ fontStyle: 'italic' }}>
          Beautiful hair, personal service, and attention to every detail.
        </p>
      </div>

      <div className="service-list">
        <div className="service-row">
          <div>
            <h3>Home visits</h3>
            <p>
              Aviva travels to clients across Johannesburg for hair appointments. Tell her your suburb
              when you request a booking so she can plan travel time.
            </p>
            {settings?.service_areas?.length ? (
              <p className="meta" style={{ marginTop: '0.75rem' }}>
                Areas: {settings.service_areas.join(' · ')}
              </p>
            ) : (
              <p className="meta" style={{ marginTop: '0.75rem' }}>
                Johannesburg & surrounds — ask about your area.
              </p>
            )}
            {settings?.travel_fee_message ? (
              <p className="meta">{settings.travel_fee_message}</p>
            ) : null}
          </div>
        </div>
        <div className="service-row">
          <div>
            <h3>Wig & sheitel studio</h3>
            <p>
              Wig appointments take place at Aviva&apos;s private Johannesburg location. Exact address
              details are shared after your appointment is confirmed.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
        <Link className="btn btn-primary" to="/book">
          Request a booking
        </Link>
        <Link className="btn btn-ghost" to="/contact">
          Contact Aviva
        </Link>
      </div>
    </section>
  )
}
