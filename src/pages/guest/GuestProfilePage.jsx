import { Link, useLocation } from 'wouter'
import { ArrowLeft, LogOut } from 'lucide-react'
import EsBrandLogo from '@/components/design-system/EsBrandLogo'
import ProfileManage from '@/components/shared/ProfileManage'

export default function GuestProfilePage({ onLogout, setToast }) {
  const [, setLocation] = useLocation()
  return (
    <div className="es-guest-hub" data-testid="guest-profile-page">
      <header className="es-guest-hub__header">
        <EsBrandLogo href="/guest" caption="Public guest" testId="link-guest-profile-brand" />
        <div className="es-guest-hub__header-actions">
          <Link href="/guest" className="btn btn-quiet" style={{ fontSize: 12 }}>
            <ArrowLeft size={14} /> Hub
          </Link>
          <button type="button" className="btn btn-quiet" onClick={onLogout}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>
      <main className="es-guest-hub__main">
        <ProfileManage
          role="guest"
          setToast={setToast}
          go={(href) => setLocation(href?.includes('settings') ? '/guest' : href || '/guest')}
        />
      </main>
    </div>
  )
}
