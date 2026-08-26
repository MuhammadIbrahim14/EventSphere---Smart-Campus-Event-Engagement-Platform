import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { Menu, X } from 'lucide-react'
import EsBrandLogo from '@/components/design-system/EsBrandLogo'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQs' },
  { href: '/gallery', label: 'Gallery' },
]

/**
 * Sidebar-free guest chrome: sticky header + mobile drawer.
 */
export default function PublicShell({
  title,
  eyebrow,
  children,
  hideTitle = false,
  wide = false,
}) {
  const [path] = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [path])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="es-guest-shell es-public" data-testid="guest-shell">
      <header className="es-guest-shell__header">
        <EsBrandLogo href="/" caption="Guest orbit" testId="link-public-brand" className="es-guest-shell__brand" />
        <nav className="es-guest-shell__nav" aria-label="Guest navigation">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`btn btn-quiet ${path === l.href || (l.href !== '/' && path.startsWith(l.href)) ? 'active' : ''}`}
              style={{ fontSize: 12 }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="es-guest-shell__actions">
          <div className="es-guest-shell__actions-auth">
            <Link href="/login" className="btn btn-quiet" data-testid="link-guest-login">
              Login
            </Link>
            <Link href="/signup" className="btn btn-primary" data-testid="link-guest-signup">
              Create account
            </Link>
          </div>
          <button
            type="button"
            className="icon-btn es-guest-shell__menu-btn"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            data-testid="button-guest-menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {open ? (
        <div className="es-guest-shell__drawer" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="es-guest-shell__drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong>Menu</strong>
              <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className="btn" style={{ justifyContent: 'flex-start' }}>
                {l.label}
              </Link>
            ))}
            <Link href="/login" className="btn" style={{ justifyContent: 'flex-start' }}>
              Login
            </Link>
            <Link href="/signup" className="btn btn-primary" style={{ justifyContent: 'flex-start' }}>
              Create account
            </Link>
            <Link href="/sitemap" className="btn btn-quiet" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
              Sitemap
            </Link>
          </div>
        </div>
      ) : null}

      <main className="es-guest-shell__main" style={wide ? { maxWidth: 1100 } : undefined}>
        {!hideTitle && (title || eyebrow) ? (
          <div className="page-head" style={{ marginBottom: 18 }}>
            <div>
              {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
              {title ? (
                <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', color: 'var(--text)', margin: 0 }}>
                  {title}
                </h1>
              ) : null}
            </div>
          </div>
        ) : null}
        {children}
      </main>

      <footer className="es-guest-shell__footer">
        EventSphere ·{' '}
        <Link href="/sitemap">Sitemap</Link>
        {' · '}
        <Link href="/about">About</Link>
        {' · '}
        <Link href="/contact">Contact</Link>
      </footer>
    </div>
  )
}
