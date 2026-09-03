import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'wouter'
import { LogOut } from 'lucide-react'
import EsBrandLogo from '@/components/design-system/EsBrandLogo'
import ThemeToggle from '@/components/shared/ThemeToggle'
import UserAvatar from '@/components/shared/UserAvatar'
import { EsScrollMotion } from '@/components/design-system'
import { useTheme } from '@/context/ThemeContext'
import PublicFooter from '@/pages/public/PublicFooter'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQs' },
  { href: '/gallery', label: 'Gallery' },
]

/**
 * Public / guest chrome — same floating stage as role dashboards, no sidebar.
 */
export default function PublicShell({
  title,
  eyebrow,
  children,
  hideTitle = false,
  variant = 'public',
  identity,
  onLogout,
  showFooter,
}) {
  const [path] = useLocation()
  const { theme, setTheme } = useTheme()
  const scrollRef = useRef(null)
  const isHub = variant === 'hub'
  const footerVisible = showFooter ?? !isHub

  useEffect(() => {
    scrollRef.current?.scrollTo?.(0, 0)
  }, [path])

  return (
    <div className="es-public-shell app-shell es-shell" data-testid={isHub ? 'guest-hub-shell' : 'guest-shell'}>
      <main className="es-public-shell__column">
        <header className="topbar es-public-topbar">
          <span className="es-lightning-ring es-lightning-ring--topbar" aria-hidden="true" />
          <div className="es-public-topbar__start">
            <EsBrandLogo
              href={isHub ? '/guest' : '/'}
              caption={isHub ? 'Public guest' : 'EventSphere'}
              testId={isHub ? 'link-guest-hub-brand' : 'link-public-brand'}
              className="es-public-topbar__brand"
            />
          </div>

          <nav className="es-public-topbar__nav" aria-label="Public navigation">
            {!isHub
              ? NAV.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`btn btn-quiet es-public-nav-link ${
                      path === l.href || (l.href !== '/' && path.startsWith(l.href)) ? 'active' : ''
                    }`}
                  >
                    {l.label}
                  </Link>
                ))
              : (
                <>
                  <Link href="/events" className="btn btn-quiet es-public-nav-link">
                    Browse events
                  </Link>
                  <Link href="/" className="btn btn-quiet es-public-nav-link">
                    Public home
                  </Link>
                </>
              )}
          </nav>

          <div className="es-public-topbar__actions">
            <ThemeToggle theme={theme} setTheme={setTheme} className="es-public-theme-toggle" />
            {isHub ? (
              <>
                <Link href="/guest/profile" className="btn btn-quiet es-public-hub-profile" data-testid="link-guest-profile">
                  <UserAvatar src={identity?.avatarUrl} initials={identity?.initials || 'G'} size={28} />
                  <span className="es-public-hub-profile__name">{identity?.name || 'Guest'}</span>
                </Link>
                <button
                  type="button"
                  className="btn btn-quiet es-public-logout"
                  onClick={onLogout}
                  data-testid="button-guest-logout"
                  aria-label="Logout"
                >
                  <LogOut size={16} />
                  <span className="es-public-logout__label">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-quiet" data-testid="link-guest-login">
                  Login
                </Link>
                <Link href="/signup?intent=guest" className="btn btn-primary" data-testid="link-guest-signup">
                  Guest signup
                </Link>
                <Link href="/login" className="btn btn-quiet es-public-campus-signup" data-testid="link-campus-login">
                  Campus login
                </Link>
              </>
            )}
          </div>
        </header>

        <div className="content es-stage es-public-stage pub-skin">
          <span className="es-lightning-ring es-lightning-ring--content" aria-hidden="true" />
          <div className="es-stage__scroll" ref={scrollRef}>
            <EsScrollMotion scrollRef={scrollRef} routeKey={path}>
              <div className="es-public-stage__inner page-enter">
                {!hideTitle && (title || eyebrow) ? (
                  <div className="page-head es-public-page-head">
                    <div>
                      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
                      {title ? <h1 className="es-public-page-head__title">{title}</h1> : null}
                    </div>
                  </div>
                ) : null}
                {children}
                {footerVisible ? <PublicFooter /> : null}
              </div>
            </EsScrollMotion>
          </div>
        </div>
      </main>
    </div>
  )
}
