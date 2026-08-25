import { Link } from 'wouter'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQs' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/sitemap', label: 'Sitemap' },
  { href: '/login', label: 'Sign in' },
]

export default function PublicShell({ title, eyebrow, children }) {
  return (
    <div className="landing" style={{ alignItems: 'stretch', padding: '28px 18px 48px', color: 'var(--text)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', width: '100%' }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <Link href="/" className="brand" data-testid="link-public-brand">
            <span className="brand-mark" />
            <span>
              <span className="brand-name">EVENTSPHERE</span>
              <span className="brand-caption">CAMPUS COMMAND CENTER</span>
            </span>
          </Link>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginRight: 48 }}>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="btn btn-quiet" style={{ fontSize: 11 }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="page-head" style={{ marginBottom: 18 }}>
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', color: 'var(--text)' }}>{title}</h1>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
