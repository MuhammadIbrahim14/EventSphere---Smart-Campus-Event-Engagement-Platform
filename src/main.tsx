import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import { NeonTrailProvider } from './context/NeonTrailContext'
import { MascotLibraryProvider } from './context/MascotLibraryContext'
import { applyNeonTrailConfig, loadNeonTrailConfig } from './lib/neonTrail'
import App from './App'
import { ErrorBoundary } from '@/components/error-boundary'
import './styles/eventsphere-design-system.css'
import './styles/eventsphere-skins.css'
import './index.css'

applyNeonTrailConfig(loadNeonTrailConfig())

createRoot(document.getElementById('root'), {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack)
  },
}).render(
  <ErrorBoundary>
    <AuthProvider>
      <NeonTrailProvider>
        <MascotLibraryProvider>
          <App />
        </MascotLibraryProvider>
      </NeonTrailProvider>
    </AuthProvider>
  </ErrorBoundary>,
)
