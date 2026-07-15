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

export async function signInWithOtp(email) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
}

export async function getAccessToken() {
  const { data: sessionData } = await supabase.auth.getSession()
  return sessionData?.session?.access_token || null
}

export async function verifyUserToken(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return { user, error }
}

function getSupabaseStorageKeys() {
  const keys = new Set([
    'supabase.auth.token',
    'supabase.auth.token-code-verifier',
    'supabase.auth.token-user',
  ])
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return Array.from(keys)
    const hostname = new URL(supabaseUrl).hostname
    const projectRef = hostname.split('.')[0]
    if (projectRef) {
      keys.add(`sb-${projectRef}-auth-token`)
      keys.add(`sb-${projectRef}-auth-token-code-verifier`)
      keys.add(`sb-${projectRef}-auth-token-user`)
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
  // 1. Blast storage FIRST — guarantees tokens are gone even if the
  //    signOut API call hangs or the tab crashes mid-request.
  clearAuthStorageFallback()

  // 2. Best-effort server-side revoke.  This calls POST /logout which
  //    @supabase/auth-js may throw/error on for non-AuthError failures
  //    (network timeout, DNS, TypeError).  We catch everything — the
  //    local session is already gone.
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Ignore — storage already cleared above.
  }

  // 3. Blast storage AGAIN to catch any edge-case where the SDK
  //    re-hydrated a session during the signOut handshake.
  clearAuthStorageFallback()

  return { error: null }
}
