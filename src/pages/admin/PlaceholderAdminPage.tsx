import { Link } from 'react-router-dom'

export function PlaceholderAdminPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <>
      <div className="admin-topbar">
        <h1>{title}</h1>
      </div>
      <div className="panel">
        <p>{description}</p>
        <p className="meta" style={{ marginTop: '0.75rem' }}>
          Schema tables are ready. Full management UI ships in the next phase.
        </p>
        <Link className="btn btn-secondary" style={{ marginTop: '1rem' }} to="/admin">
          Back to dashboard
        </Link>
      </div>
    </>
  )
}
