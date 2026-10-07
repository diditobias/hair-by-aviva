import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { GalleryImage } from '../../lib/types'

export function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('gallery_images')
      .select('*')
      .eq('visible', true)
      .order('sort_order')
      .then(({ data }) => {
        setImages((data as GalleryImage[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <section className="section">
      <div className="section-head">
        <h2>Gallery</h2>
        <p>Cuts, styling and wig work from Hair by Aviva.</p>
      </div>

      {!loading && images.length === 0 ? (
        <div className="section-narrow" style={{ padding: 0 }}>
          <div className="notice" style={{ marginBottom: '1.25rem' }}>
            Photos needed from Aviva: haircuts, occasion styling, wig/sheitel work, and before-and-after
            shots. Once uploaded in admin, they will appear here automatically.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/book">
              Request a booking
            </Link>
            <Link className="btn btn-ghost" to="/contact">
              Contact Aviva
            </Link>
          </div>
        </div>
      ) : null}

      {images.length > 0 ? (
        <div className="gallery-grid">
          {images.map((img) => (
            <article className="gallery-item" key={img.id}>
              <img
                src={img.image_url}
                alt={img.title ?? img.caption ?? 'Gallery'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <span>{img.caption ?? img.title ?? img.category}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
