import { useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IDEA_FILTERS, ideaById, ideas, type IdeaCategory, type HairIdea } from '../../lib/ideas'

type FilterId = 'all' | IdeaCategory

export function IdeasPage() {
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<FilterId>('all')
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const selected = ideaById(params.get('idea'))
  const visible = filter === 'all' ? ideas : ideas.filter((idea) => idea.category === filter)

  const openIdea = (idea: HairIdea) => {
    const next = new URLSearchParams(params)
    next.set('idea', idea.id)
    setParams(next)
  }

  const closeIdea = () => {
    const next = new URLSearchParams(params)
    next.delete('idea')
    setParams(next, { replace: true })
  }

  const stepIdea = (direction: -1 | 1) => {
    if (!selected) return
    const list = visible.length > 0 ? visible : ideas
    const index = list.findIndex((idea) => idea.id === selected.id)
    const start = index === -1 ? 0 : index
    const next = list[(start + direction + list.length) % list.length]
    openIdea(next)
  }

  useEffect(() => {
    if (!selected) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeIdea()
      if (event.key === 'ArrowRight') stepIdea(1)
      if (event.key === 'ArrowLeft') stepIdea(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
    // closeIdea and stepIdea close over the current selection; rebind when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, filter])

  return (
    <section className="section">
      <div className="section-head">
        <h2>Ideas</h2>
        <p>
          Browse looks to bring to your appointment. Tell Aviva which one you have in mind, and she
          will shape it to your hair.
        </p>
      </div>

      <div className="ideas-filters" role="group" aria-label="Filter looks">
        {IDEA_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ideas-filter${filter === item.id ? ' is-selected' : ''}`}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="meta">No looks in this group yet.</p>
      ) : (
        <div className="ideas-grid">
          {visible.map((idea) => (
            <article className="ideas-card" key={idea.id}>
              <button type="button" className="ideas-card-open" onClick={() => openIdea(idea)}>
                <span className="ideas-card-media">
                  <img src={idea.image} alt={idea.alt} />
                </span>
                <span className="ideas-card-copy">
                  <span className="ideas-kicker">
                    {idea.category === 'occasion' ? 'Occasion' : 'Everyday'}
                  </span>
                  <strong>{idea.title}</strong>
                  <span>{idea.summary}</span>
                </span>
              </button>
            </article>
          ))}
        </div>
      )}

      {selected ? (
        <div className="ideas-dialog-backdrop" role="presentation" onClick={closeIdea}>
          <div
            className="ideas-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ideas-dialog-media">
              <img src={selected.image} alt={selected.alt} />
            </div>
            <div className="ideas-dialog-copy">
              <div className="ideas-dialog-toolbar">
                <p className="ideas-kicker">
                  {selected.category === 'occasion' ? 'Occasion' : 'Everyday'}
                </p>
                <button
                  ref={closeRef}
                  type="button"
                  className="ideas-close"
                  onClick={closeIdea}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <h3 id={titleId}>{selected.title}</h3>
              <p>{selected.details}</p>
              <ul className="ideas-tags">
                {selected.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <p className="meta">
                This is a style reference. Aviva adapts the cut, colour and finish to your hair.
              </p>
              <div className="ideas-dialog-actions">
                <Link
                  className="btn btn-primary"
                  to={`/book?look=${encodeURIComponent(selected.title)}`}
                >
                  Request this look
                </Link>
                <button type="button" className="btn btn-ghost" onClick={() => stepIdea(1)}>
                  Next look
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
