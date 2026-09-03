import { Link } from 'wouter'

/** Site footer — rendered outside the main floating content panel. */
export default function PublicFooter() {
  return (
    <footer className="es-public-footer">
      <div className="es-public-footer__grid">
        <div className="es-public-footer__brand">
          <strong>EventSphere</strong>
          <p className="muted">
            Smart campus events — public guests and campus members on one orbit.
          </p>
        </div>
        <div>
          <div className="eyebrow">Explore</div>
          <div className="es-public-footer__links">
            <Link href="/events">Events</Link>
            <Link href="/gallery">Gallery</Link>
            <Link href="/faq">FAQs</Link>
            <Link href="/sitemap">Sitemap</Link>
          </div>
        </div>
        <div>
          <div className="eyebrow">Join</div>
          <div className="es-public-footer__links">
            <Link href="/signup?intent=guest">Public guest</Link>
            <Link href="/login">Campus student login</Link>
            <Link href="/login">Login</Link>
          </div>
        </div>
        <div>
          <div className="eyebrow">Contact</div>
          <div className="es-public-footer__links">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </div>
      <div className="es-public-footer__copy">
        © {new Date().getFullYear()} EventSphere · Campus event management
      </div>
    </footer>
  )
}
