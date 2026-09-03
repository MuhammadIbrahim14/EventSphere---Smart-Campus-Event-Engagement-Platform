import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import { NeonTrailProvider } from './context/NeonTrailContext'
import { ThemeEngineProvider } from './context/ThemeEngineContext'
import { FutureImprovementsProvider } from './context/FutureImprovementsContext'
import { MascotLibraryProvider } from './context/MascotLibraryContext'
import { applyNeonTrailConfig, loadNeonTrailConfig } from './lib/neonTrail'
import { applyThemeEngine, loadThemeEngine } from './lib/themeEngine'
import App from './App'
import { ErrorBoundary } from '@/components/error-boundary'
import './styles/eventsphere-design-system.css'
import './styles/eventsphere-skins.css'
import './styles/eventsphere-orbit.css'
import './styles/eventsphere-guest.css'
import './styles/eventsphere-public-shell.css'
import './styles/eventsphere-auth.css'
import './styles/eventsphere-promo.css'
import './styles/eventsphere-checkin.css'
import './styles/eventsphere-boot-loader.css'
import './styles/eventsphere-workspace-footer.css'
import './styles/eventsphere-organizer-regs.css'
import './styles/eventsphere-certificates.css'
import './styles/eventsphere-feedback.css'
import './styles/eventsphere-contact.css'
import './styles/eventsphere-future-improvements.css'
import './index.css'

applyThemeEngine(loadThemeEngine())
applyNeonTrailConfig(loadNeonTrailConfig())

createRoot(document.getElementById('root'), {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack)
  },
}).render(
  <ErrorBoundary>
    <AuthProvider>
      <ThemeEngineProvider>
        <NeonTrailProvider>
          <FutureImprovementsProvider>
            <MascotLibraryProvider>
              <App />
            </MascotLibraryProvider>
          </FutureImprovementsProvider>
        </NeonTrailProvider>
      </ThemeEngineProvider>
    </AuthProvider>
  </ErrorBoundary>,
)
