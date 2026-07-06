import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore, getAuthStoreState } from '@/lib/authStore'

beforeEach(() => {
  useAuthStore.getState().reset()
})

describe('authStore', () => {
  it('khởi tạo với state mặc định', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.loading).toBe(true)
    expect(state.role).toBeNull()
    expect(state.isSignedIn).toBe(false)
    expect(state.isAdmin).toBe(false)
    expect(state.isTelesale).toBe(false)
    expect(state.isAuthenticated).toBe(false)
    expect(state.signIn).toBeNull()
    expect(state.signOut).toBeNull()
  })

  it('setUser(null) set user null và role=guest', () => {
    useAuthStore.getState().setUser(null)
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.role).toBe('guest')
    expect(state.isSignedIn).toBe(false)
  })

  it('setUser(admin) tính đúng role và flags', () => {
    useAuthStore.getState().setUser({ email: 'admin@test.com', app_metadata: { role: 'admin' } })
    const state = useAuthStore.getState()
    expect(state.user).toEqual({ email: 'admin@test.com', app_metadata: { role: 'admin' } })
    expect(state.role).toBe('admin')
    expect(state.isSignedIn).toBe(true)
    expect(state.isAdmin).toBe(true)
    expect(state.isTelesale).toBe(false)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setUser(telesale) tính đúng role và flags', () => {
    useAuthStore.getState().setUser({ email: 'telesale@test.com', app_metadata: { role: 'telesale' } })
    const state = useAuthStore.getState()
    expect(state.role).toBe('telesale')
    expect(state.isSignedIn).toBe(true)
    expect(state.isAdmin).toBe(false)
    expect(state.isTelesale).toBe(true)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setUser(user không có role) tính đúng flags (role=guest)', () => {
    useAuthStore.getState().setUser({ email: 'user@test.com' })
    const state = useAuthStore.getState()
    expect(state.role).toBe('guest')
    expect(state.isSignedIn).toBe(true)
    expect(state.isAdmin).toBe(false)
    expect(state.isTelesale).toBe(false)
    expect(state.isAuthenticated).toBe(false)
  })

  it('setLoading thay đổi loading state', () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().loading).toBe(false)
    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().loading).toBe(true)
  })

  it('reset trả về initial state', () => {
    useAuthStore.getState().setUser({ email: 'admin@test.com', app_metadata: { role: 'admin' } })
    useAuthStore.getState().setLoading(false)
    useAuthStore.getState().reset()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.loading).toBe(true)
    expect(state.role).toBeNull()
    expect(state.isSignedIn).toBe(false)
  })

  it('getAuthStoreState trả về state hiện tại', () => {
    useAuthStore.getState().setUser({ email: 'test@test.com' })
    const state = getAuthStoreState()
    expect(state.user.email).toBe('test@test.com')
  })
})
