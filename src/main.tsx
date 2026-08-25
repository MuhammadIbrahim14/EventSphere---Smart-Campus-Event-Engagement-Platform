import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { ErrorBoundary } from '@/components/error-boundary'
import './index.css'

createRoot(document.getElementById('root'), {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack)
  },
}).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>,
)
