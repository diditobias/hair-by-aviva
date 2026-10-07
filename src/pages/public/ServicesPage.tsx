import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Service } from '../../lib/types'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'
import { formatPrice } from '../../lib/format'

export function ServicesPage() {
  const { settings } = useBusinessSettings()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        setServices((data as Service[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>Services</h2>
        <p>
          Hair home visits across Johannesburg and private wig appointments. Prices in South African Rand
          where shown.
        </p>
      </div>

      {loading ? <p>Loading services…</p> : null}

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

      {!loading && services.length === 0 ? (
        <p className="notice">Services will appear here once the database is connected.</p>
      ) : null}
    </section>
  )
}
