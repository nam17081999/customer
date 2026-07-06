import { describe, expect, it } from 'vitest'
import {
  isAdminRole,
  isAuthenticatedRole,
  isTelesaleRole,
  resolveUserRole,
  USER_ROLES,
} from '@/lib/authz'

describe('resolveUserRole', () => {
  it('trả về guest khi user là null', () => {
    expect(resolveUserRole(null)).toBe(USER_ROLES.GUEST)
  })

  it('trả về guest khi user là undefined', () => {
    expect(resolveUserRole(undefined)).toBe(USER_ROLES.GUEST)
  })

  it('trả về guest khi user rỗng', () => {
    expect(resolveUserRole({})).toBe(USER_ROLES.GUEST)
  })

  it('trả về admin khi app_metadata.role = admin', () => {
    const user = { app_metadata: { role: 'admin' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.role = administrator', () => {
    const user = { app_metadata: { role: 'administrator' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.role = super_admin', () => {
    const user = { app_metadata: { role: 'super_admin' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.role = superadmin', () => {
    const user = { app_metadata: { role: 'superadmin' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.role viết hoa linh tinh', () => {
    const user = { app_metadata: { role: 'Admin' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('ưu tiên app_metadata.role trước app_metadata.user_role', () => {
    const user = { app_metadata: { role: 'admin', user_role: 'telesale' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.user_role = admin', () => {
    const user = { app_metadata: { user_role: 'admin' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về telesale khi app_metadata.role = telesale', () => {
    const user = { app_metadata: { role: 'telesale' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.TELESALE)
  })

  it('trả về telesale khi app_metadata.role = tele_sale', () => {
    const user = { app_metadata: { role: 'tele_sale' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.TELESALE)
  })

  it('trả về telesale khi app_metadata.role = tele-sale', () => {
    const user = { app_metadata: { role: 'tele-sale' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.TELESALE)
  })

  it('trả về telesale khi app_metadata.role = sales', () => {
    const user = { app_metadata: { role: 'sales' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.TELESALE)
  })

  it('trả về telesale khi app_metadata.role = sale', () => {
    const user = { app_metadata: { role: 'sale' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.TELESALE)
  })

  it('trả về guest khi app_metadata.role không hợp lệ', () => {
    const user = { app_metadata: { role: 'editor' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.GUEST)
  })

  it('trả về admin nếu roles[] chứa admin (mảng)', () => {
    const user = { app_metadata: { roles: ['editor', 'admin'] } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về telesale nếu roles[] chứa telesale (mảng)', () => {
    const user = { app_metadata: { roles: ['telesale'] } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.TELESALE)
  })

  it('ưu tiên admin qua telesale trong roles[]', () => {
    const user = { app_metadata: { roles: ['telesale', 'admin'] } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.is_admin = true', () => {
    const user = { app_metadata: { is_admin: true } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.admin = true', () => {
    const user = { app_metadata: { admin: true } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.is_admin = "true" (string)', () => {
    const user = { app_metadata: { is_admin: 'true' } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về admin khi app_metadata.is_admin = 1 (number)', () => {
    const user = { app_metadata: { is_admin: 1 } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.ADMIN)
  })

  it('trả về guest khi app_metadata.is_admin = false', () => {
    const user = { app_metadata: { is_admin: false } }
    expect(resolveUserRole(user)).toBe(USER_ROLES.GUEST)
  })

  it('không dùng user_metadata.role cho role resolution', () => {
    const user = {
      app_metadata: {},
      user_metadata: { role: 'admin' },
    }
    expect(resolveUserRole(user)).toBe(USER_ROLES.GUEST)
  })

  it('trả về guest khi user không có app_metadata', () => {
    const user = { id: 'abc' }
    expect(resolveUserRole(user)).toBe(USER_ROLES.GUEST)
  })

  it('trả về guest khi app_metadata = null', () => {
    const user = { app_metadata: null, id: 'abc' }
    expect(resolveUserRole(user)).toBe(USER_ROLES.GUEST)
  })
})

describe('isAdminRole', () => {
  it('trả về true khi role là admin', () => {
    expect(isAdminRole(USER_ROLES.ADMIN)).toBe(true)
  })

  it('trả về false khi role là telesale', () => {
    expect(isAdminRole(USER_ROLES.TELESALE)).toBe(false)
  })

  it('trả về false khi role là guest', () => {
    expect(isAdminRole(USER_ROLES.GUEST)).toBe(false)
  })

  it('trả về false khi role là null', () => {
    expect(isAdminRole(null)).toBe(false)
  })

  it('trả về false khi role là undefined', () => {
    expect(isAdminRole(undefined)).toBe(false)
  })
})

describe('isTelesaleRole', () => {
  it('trả về true khi role là telesale', () => {
    expect(isTelesaleRole(USER_ROLES.TELESALE)).toBe(true)
  })

  it('trả về false khi role là admin', () => {
    expect(isTelesaleRole(USER_ROLES.ADMIN)).toBe(false)
  })

  it('trả về false khi role là guest', () => {
    expect(isTelesaleRole(USER_ROLES.GUEST)).toBe(false)
  })
})

describe('isAuthenticatedRole', () => {
  it('trả về true khi role là admin', () => {
    expect(isAuthenticatedRole(USER_ROLES.ADMIN)).toBe(true)
  })

  it('trả về true khi role là telesale', () => {
    expect(isAuthenticatedRole(USER_ROLES.TELESALE)).toBe(true)
  })

  it('trả về false khi role là guest', () => {
    expect(isAuthenticatedRole(USER_ROLES.GUEST)).toBe(false)
  })

  it('trả về false khi role là null', () => {
    expect(isAuthenticatedRole(null)).toBe(false)
  })
})
