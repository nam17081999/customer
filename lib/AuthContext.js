import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  getCurrentSession,
  signInWithEmailPassword,
  signOutCurrentUser,
  subscribeToAuthStateChange,
} from '@/api/auth/auth-client'
import { isAdminRole, isAuthenticatedRole, isTelesaleRole, resolveUserRole } from '@/lib/authz'
import { getE2EAuthOverride } from '@/lib/e2e-test-mode'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const e2eAuth = getE2EAuthOverride()
    if (e2eAuth.hasOverride) {
      setUser(e2eAuth.user)
      setLoading(false)
      return () => {
        active = false
      }
    }

    async function hydrateSession() {
      const { data, error } = await getCurrentSession()
      if (!active) return
      if (error) {
        console.error('Auth session hydrate failed:', error)
        setUser(null)
      } else {
        setUser(data?.session?.user ?? null)
      }
      setLoading(false)
    }

    hydrateSession()

    const subscription = subscribeToAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription?.unsubscribe?.()
    }
  }, [])

  const signIn = useCallback((email, password) => (
    signInWithEmailPassword(email, password)
  ), [])

  const signOut = useCallback(async () => {
    const result = await signOutCurrentUser()
    const { data: currentSessionData } = await getCurrentSession()
    if (!result?.error || !currentSessionData?.session) {
      setUser(null)
    }
    return result
  }, [])
  const role = useMemo(() => resolveUserRole(user), [user])
  const isSignedIn = Boolean(user)
  const isAdmin = isAdminRole(role)
  const isTelesale = isTelesaleRole(role)
  const isAuthenticated = isAuthenticatedRole(role)

  const value = useMemo(() => ({
    user,
    loading,
    signIn,
    signOut,
    role,
    isSignedIn,
    isAdmin,
    isTelesale,
    isAuthenticated,
  }), [user, loading, signIn, signOut, role, isSignedIn, isAdmin, isTelesale, isAuthenticated])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
