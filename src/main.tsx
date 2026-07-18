import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'overlayscrollbars/overlayscrollbars.css'
import './index.css'
import Root from './ui/Root.tsx'
import { ErrorBoundary } from './ui/components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
)
