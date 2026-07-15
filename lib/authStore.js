import { create } from 'zustand'
import { isAdminRole, isAuthenticatedRole, isStaffRole, isTelesaleRole, resolveUserRole } from '@/lib/authz'

const INITIAL_STATE = {
  user: null,
  loading: true,
  role: null,
  isSignedIn: false,
  isAdmin: false,
  isStaff: false,
  isTelesale: false,
  isAuthenticated: false,
}

function computeDerived(user) {
  const role = resolveUserRole(user)
  return {
    user,
    role,
    isSignedIn: Boolean(user),
    isAdmin: isAdminRole(role),
    isStaff: isStaffRole(role),
    isTelesale: isTelesaleRole(role),
    isAuthenticated: isAuthenticatedRole(role),
  }
}

export const useAuthStore = create((set) => ({
  ...INITIAL_STATE,
  signIn: null,
  signOut: null,

  setUser(user) {
    set(computeDerived(user))
  },

  setLoading(loading) {
    set({ loading })
  },

  setSignIn(fn) {
    set({ signIn: fn })
  },

  setSignOut(fn) {
    set({ signOut: fn })
  },

  reset() {
    set({ ...INITIAL_STATE, signIn: null, signOut: null })
  },
}))

export function getAuthStoreState() {
  return useAuthStore.getState()
}
