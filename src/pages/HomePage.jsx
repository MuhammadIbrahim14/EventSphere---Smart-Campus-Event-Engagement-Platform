import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { configured } = useAuth()

  return (
    <div className="landing">
      <header className="landing-header">
        <p className="brand">SYNVEX FORGE</p>
        <div className="landing-actions">
          <Link to="/login" className="btn btn-ghost">
            Sign in
          </Link>
          <Link to="/signup" className="btn btn-primary">
            Create account
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <h1>SYNVEX FORGE</h1>
        <p>
          Techwiz 2026 foundation — Supabase auth, role-based access, and CRUD APIs ready
          for competition features.
        </p>
        <div className="cta-row">
          <Link to="/signup" className="btn btn-primary">
            Get started
          </Link>
          <Link to="/login" className="btn btn-ghost">
            Sign in
          </Link>
        </div>
        {!configured && (
          <p className="banner warn">
            Supabase keys missing. Copy <code>.env.example</code> to <code>.env</code>, add
            your project URL and anon key, then run <code>supabase/schema.sql</code>.
          </p>
        )}
      </section>
    </div>
  )
}
