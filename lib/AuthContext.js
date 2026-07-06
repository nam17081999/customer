import { createContext, useCallback, useContext, useEffect } from 'react'
import {
  getCurrentSession,
  signInWithEmailPassword,
  signOutCurrentUser,
  subscribeToAuthStateChange,
} from '@/api/auth/auth-client'
import { getE2EAuthOverride } from '@/lib/e2e-test-mode'
import { useAuthStore } from '@/lib/authStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const signIn = useCallback((email, password) => (
    signInWithEmailPassword(email, password)
  ), [])

  const signOut = useCallback(async () => {
    try {
      const result = await signOutCurrentUser()
      if (!result?.error) useAuthStore.getState().setUser(null)
      return result
    } catch (err) {
      console.error('signOut failed:', err)
      return { error: err }
    }
  }, [])

  useEffect(() => {
    useAuthStore.getState().setSignIn(() => signIn)
    useAuthStore.getState().setSignOut(() => signOut)
  }, [signIn, signOut])

  useEffect(() => {
    let active = true

    const e2eAuth = getE2EAuthOverride()
    if (e2eAuth.hasOverride) {
      useAuthStore.getState().setUser(e2eAuth.user)
      useAuthStore.getState().setLoading(false)
      return () => { active = false }
    }

    async function hydrateSession() {
      try {
        const { data, error } = await getCurrentSession()
        if (!active) return
        if (error) {
          console.error('Auth session hydrate failed:', error)
          useAuthStore.getState().setUser(null)
        } else {
          useAuthStore.getState().setUser(data?.session?.user ?? null)
        }
      } catch (err) {
        console.error('Auth session hydrate exception:', err)
        if (active) useAuthStore.getState().setUser(null)
      } finally {
        if (active) useAuthStore.getState().setLoading(false)
      }
    }

    hydrateSession()

    const subscription = subscribeToAuthStateChange((_event, session) => {
      if (!active) return
      useAuthStore.getState().setUser(session?.user ?? null)
      useAuthStore.getState().setLoading(false)
    })

    return () => {
      active = false
      subscription?.unsubscribe?.()
    }
  }, [])

  return (
    <AuthContext.Provider value={useAuthStore()}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useAuthStore()
}
