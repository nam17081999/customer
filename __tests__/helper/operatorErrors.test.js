import { describe, expect, it } from 'vitest'
import { getOperatorErrorMessage, normalizeOperatorError, toOperatorErrorPayload } from '@/helper/operatorErrors'

describe('operator error normalization', () => {
  it('maps critical postgres/rpc errors to Vietnamese operator-safe messages', () => {
    expect(getOperatorErrorMessage({ message: 'Insufficient stock for product' })).toBe('Tồn kho không đủ để thực hiện thao tác.')
    expect(getOperatorErrorMessage({ message: 'duplicate key value violates unique constraint "idx_products_sku"', code: '23505' })).toBe('Dữ liệu đã tồn tại. Vui lòng kiểm tra mã/SKU hoặc thử lại.')
    expect(getOperatorErrorMessage({ message: 'invalid input syntax for type uuid', code: '22P02' })).toBe('Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin nhập.')
    expect(getOperatorErrorMessage({ message: 'Admin permission required', code: '42501' })).toBe('Không có quyền thực hiện thao tác này.')
  })

  it('does not leak raw SQL/internal messages for unknown technical errors', () => {
    expect(getOperatorErrorMessage({ message: 'SQLSTATE XX000 internal stack trace at plpgsql function' })).toBe('Có lỗi xảy ra. Vui lòng thử lại hoặc báo quản trị viên.')
    expect(normalizeOperatorError({ message: 'network timeout' }).message).toBe('Kết nối không ổn định. Vui lòng thử lại.')
  })

  it('returns retryable payload for network failure', () => {
    expect(toOperatorErrorPayload({ message: 'Failed to fetch' })).toEqual({
      message: 'Kết nối không ổn định. Vui lòng thử lại.',
      code: null,
      retryable: true,
    })
  })
})
