import { describe, expect, it } from 'vitest'
import { USER_ROLES } from '@/lib/authz'
import {
  mapSupabaseAdminUser,
  normalizeAdminUserEmail,
  validateCreateAdminUserInput,
  validateResetAdminUserPasswordInput,
} from '@/helper/adminUserManagement'

describe('adminUserManagement', () => {
  it('chuẩn hóa email về dạng trim + lowercase', () => {
    expect(normalizeAdminUserEmail('  TEST@Example.COM ')).toBe('test@example.com')
  })

  it('validate create user trả lỗi khi email sai', () => {
    expect(validateCreateAdminUserInput({
      email: 'abc',
      password: '123456',
      role: USER_ROLES.TELESALE,
    })).toEqual({ error: 'Email chưa hợp lệ.' })
  })

  it('validate create user trả values chuẩn hóa', () => {
    expect(validateCreateAdminUserInput({
      email: ' Staff@Example.com ',
      password: '123456',
      role: USER_ROLES.ADMIN,
    })).toEqual({
      error: '',
      values: {
        email: 'staff@example.com',
        password: '123456',
        role: USER_ROLES.ADMIN,
      },
    })
  })

  it('validate reset password chặn mật khẩu ngắn', () => {
    expect(validateResetAdminUserPasswordInput({
      userId: 'user-1',
      password: '123',
    })).toEqual({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' })
  })

  it('map user trả role từ app_metadata', () => {
    expect(mapSupabaseAdminUser({
      id: 'u1',
      email: 'a@example.com',
      created_at: '2026-04-26T00:00:00.000Z',
      last_sign_in_at: null,
      app_metadata: { role: USER_ROLES.ADMIN },
    })).toEqual({
      id: 'u1',
      email: 'a@example.com',
      created_at: '2026-04-26T00:00:00.000Z',
      last_sign_in_at: null,
      role: USER_ROLES.ADMIN,
    })
  })
})
