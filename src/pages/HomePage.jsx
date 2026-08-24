import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Public / guest landing — no login required.
 * Teammate: mount public frontend here (or add sibling public routes in App.jsx
 * outside ProtectedRoute). Auth panels stay under /app, /admin, /organizer.
 */
export default function HomePage() {
  const { configured, isGuest, user } = useAuth()

  return (
    <div className="landing">
      <header className="landing-header">
        <p className="brand">SYNVEX FORGE</p>
        <div className="landing-actions">
          {isGuest ? (
            <>
              <Link to="/login" className="btn btn-ghost">
                Sign in
              </Link>
              <Link to="/signup" className="btn btn-primary">
                Create account
              </Link>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              Open panel
            </Link>
          )}
        </div>
      </header>

      <section className="landing-hero">
        <h1>SYNVEX FORGE</h1>
        <p>
          Techwiz 2026 foundation — Supabase auth, role-based access, and CRUD APIs ready
          for competition features. Browse as guest; sign in only for your panel.
        </p>
        <div className="cta-row">
          {isGuest ? (
            <>
              <Link to="/signup" className="btn btn-primary">
                Get started
              </Link>
              <Link to="/login" className="btn btn-ghost">
                Sign in
              </Link>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              Continue as {user?.email || 'member'}
            </Link>
          )}
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
