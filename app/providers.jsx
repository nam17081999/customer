'use client'

import { AuthProvider } from '@/lib/AuthContext'
import ErrorBoundary from '@/components/error-boundary'

/**
 * Client-side providers wrapper for App Router.
 * AuthProvider uses useEffect + useState so must be a Client Component.
 * ErrorBoundary is a React class component so must also be client-only.
 */
export function Providers({ children }) {
  return (
    <AuthProvider>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </AuthProvider>
  )
}
