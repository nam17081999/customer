import { supabase } from '@/lib/supabaseClient'

export async function getCurrentSession() {
  return supabase.auth.getSession()
}

export function subscribeToAuthStateChange(listener) {
  const { data } = supabase.auth.onAuthStateChange(listener)
  return data?.subscription || null
}

export async function signInWithEmailPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

function getSupabaseStorageKeys() {
  const keys = new Set(['supabase.auth.token'])
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return Array.from(keys)
    const hostname = new URL(supabaseUrl).hostname
    const projectRef = hostname.split('.')[0]
    if (projectRef) {
      keys.add(`sb-${projectRef}-auth-token`)
      keys.add(`sb-${projectRef}-auth-token-code-verifier`)
    }
  } catch {
    // ignore malformed env
  }
  return Array.from(keys)
}

function clearAuthStorageFallback() {
  if (typeof window === 'undefined') return
  const keys = getSupabaseStorageKeys()
  const wildcardKeys = []

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key) continue
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        wildcardKeys.push(key)
      }
    }
  } catch {
    // ignore storage enumeration errors
  }

  const allKeys = Array.from(new Set([...keys, ...wildcardKeys]))

  for (const key of allKeys) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore storage errors
    }
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      // ignore storage errors
    }
  }
}

export async function signOutCurrentUser() {
  // Prefer clearing local session first to guarantee app logout.
  const localResult = await supabase.auth.signOut({ scope: 'local' })
  if (!localResult?.error) return localResult

  // If session is already missing after local sign-out attempt,
  // treat it as success to avoid false negative UI errors.
  const { data: localSessionData, error: localSessionError } = await supabase.auth.getSession()
  if (!localSessionError && !localSessionData?.session) {
    return { error: null, data: null }
  }

  // Best-effort global revoke for remaining cases.
  const globalResult = await supabase.auth.signOut()
  if (!globalResult?.error) return globalResult

  const { data: globalSessionData, error: globalSessionError } = await supabase.auth.getSession()
  if (!globalSessionError && !globalSessionData?.session) {
    return { error: null, data: null }
  }

  // Last fallback: force clear persisted auth tokens in browser storage.
  clearAuthStorageFallback()
  const { data: forcedSessionData, error: forcedSessionError } = await supabase.auth.getSession()
  if (!forcedSessionError && !forcedSessionData?.session) {
    return { error: null, data: null }
  }

  return globalResult?.error ? globalResult : localResult
}
