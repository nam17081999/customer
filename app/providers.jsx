'use client'

import { AuthProvider } from '@/lib/AuthContext'
import ErrorBoundary from '@/components/error-boundary'
import { useEffect } from 'react'

/**
 * Client-side providers wrapper for App Router.
 * AuthProvider uses useEffect + useState so must be a Client Component.
 * ErrorBoundary is a React class component so must also be client-only.
 */
export function Providers({ children }) {
  useEffect(() => {
    const removePortals = () => {
      try {
        document.querySelectorAll('nextjs-portal').forEach((el) => el.remove())
      } catch (e) {
        // ignore
      }
    }

    removePortals()
    const obs = new MutationObserver(() => removePortals())
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  return (
    <AuthProvider>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </AuthProvider>
  )
}
