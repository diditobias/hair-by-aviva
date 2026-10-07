import { type FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BookingType, Service, ServiceCategory } from '../../lib/types'
import { formatPrice } from '../../lib/format'

const empty = {
  name: '',
  category: 'haircuts' as ServiceCategory,
  description: '',
  duration_minutes: 60,
  price_from: 0,
  display_price: true,
  booking_type: 'home_visit' as const,
  home_call_eligible: true,
  wig_appointment: false,
  active: true,
  sort_order: 0,
}

export function ServicesAdminPage() {
  const [services, setServices] = useState<Service[]>([])
  const [editing, setEditing] = useState<Partial<Service> | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase.from('services').select('*').order('sort_order')
    setServices((data as Service[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!editing?.name) return
    setBusy(true)
    if (editing.id) {
      await supabase.from('services').update(editing).eq('id', editing.id)
    } else {
      await supabase.from('services').insert(editing)
    }
    setBusy(false)
    setEditing(null)
    await load()
  }

  return (
    <>
      <div className="admin-topbar">
        <h1>Services</h1>
        <button className="btn btn-primary" type="button" onClick={() => setEditing({ ...empty })}>
          Add service
        </button>
      </div>

      <div className="list">
        {services.map((s) => (
          <button
            key={s.id}
            type="button"
            className="list-item"
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setEditing(s)}
          >
            <div>
              <h3>
                {s.name} {!s.active ? '(inactive)' : ''}
              </h3>
              <p className="meta">
                {s.duration_minutes} mins · {s.display_price && s.price_from != null ? `from ${formatPrice(Number(s.price_from))}` : 'Price hidden'} ·{' '}
                {s.booking_type === 'pickup' ? 'Collection' : s.wig_appointment ? 'Wig' : 'Home visit'}
              </p>
            </div>
          </button>
        ))}
      </div>

      {editing ? (
        <form className="panel admin-form" onSubmit={onSave}>
          <h2>{editing.id ? 'Edit service' : 'New service'}</h2>
          <div className="row two">
            <label className="field">
              Name
              <input required value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className="field">
              Category
              <select
                value={editing.category ?? 'other'}
                onChange={(e) => setEditing({ ...editing, category: e.target.value as ServiceCategory })}
              >
                <option value="haircuts">Haircuts</option>
                <option value="styling">Styling</option>
                <option value="occasion">Occasion</option>
                <option value="wigs">Wigs</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">
              Used for
              <select
                value={editing.booking_type ?? 'home_visit'}
                onChange={(e) => setEditing({ ...editing, booking_type: e.target.value as BookingType })}
              >
                <option value="home_visit">Home visit</option>
                <option value="wig">Wig / Sheitel</option>
                <option value="pickup">Wig collection</option>
              </select>
            </label>
            <label className="field">
              Duration (mins)
              <input
                type="number"
                value={editing.duration_minutes ?? 60}
                onChange={(e) => setEditing({ ...editing, duration_minutes: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              Price from
              <input
                type="number"
                value={editing.price_from ?? 0}
                onChange={(e) => setEditing({ ...editing, price_from: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="field">
            Description
            <textarea
              value={editing.description ?? ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </label>
          <div className="action-row">
            {(
              [
                ['display_price', 'Display price'],
                ['home_call_eligible', 'Home-call eligible'],
                ['wig_appointment', 'Wig appointment'],
                ['active', 'Active'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="field" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={Boolean(editing[key])}
                  onChange={(e) => setEditing({ ...editing, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
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
    </>
  )
}
