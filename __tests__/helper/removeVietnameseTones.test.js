import { describe, it, expect } from 'vitest'
import removeVietnameseTones, { normalizeVietnamesePhonetics } from '@/helper/removeVietnameseTones'

describe('removeVietnameseTones', () => {
  it('loại bỏ dấu tiếng Việt cơ bản', () => {
    expect(removeVietnameseTones('Hà Nội')).toBe('ha noi')
    expect(removeVietnameseTones('Tạp Hóa Minh Anh')).toBe('tap hoa minh anh')
    expect(removeVietnameseTones('Cửa Hàng Đức')).toBe('cua hang duc')
  })

  it('chuyển đổi chữ đ/Đ sang d/D', () => {
    expect(removeVietnameseTones('đường')).toBe('duong')
    expect(removeVietnameseTones('Đà Nẵng')).toBe('da nang')
  })

  it('giữ nguyên chuỗi không dấu', () => {
    expect(removeVietnameseTones('abc123')).toBe('abc123')
    expect(removeVietnameseTones('hello world')).toBe('hello world')
  })

  it('kết quả luôn là lowercase', () => {
    expect(removeVietnameseTones('ABC')).toBe('abc')
    expect(removeVietnameseTones('XYZ')).toBe('xyz')
  })

  it('xử lý chuỗi rỗng', () => {
    expect(removeVietnameseTones('')).toBe('')
  })

  it('xử lý chuỗi chỉ có dấu cách', () => {
    expect(removeVietnameseTones('   ')).toBe('   ')
  })

  it('xử lý chuỗi có số và ký tự đặc biệt', () => {
    expect(removeVietnameseTones('Số 12, Đường Lý Thường Kiệt')).toBe('so 12, duong ly thuong kiet')
  })
})

describe('normalizeVietnamesePhonetics', () => {
  it('chuẩn hoá tr → ch', () => {
    const result = normalizeVietnamesePhonetics('trắng')
    expect(result).toBe('chang') // tr + ang dấu sắc → ch + ang
  })

  it('chuẩn hoá gi → d', () => {
    const result = normalizeVietnamesePhonetics('giảm')
    expect(result).toBe('dam')
  })

  it('chuẩn hoá r → d', () => {
    const result = normalizeVietnamesePhonetics('rau')
    expect(result).toBe('dau')
  })

  it('chuẩn hoá x → s', () => {
    const result = normalizeVietnamesePhonetics('xanh')
    expect(result).toBe('sanh')
  })

  it('chuẩn hoá ngh → ng', () => {
    const result = normalizeVietnamesePhonetics('nghề')
    expect(result).toBe('nge')
  })

  it('chuẩn hoá n đứng đầu từ → l (khi không có h hoặc g theo sau)', () => {
    const result = normalizeVietnamesePhonetics('nước')
    expect(result).toBe('luoc')
  })

  it('không chuẩn hoá ng (giữ nguyên)', () => {
    const result = normalizeVietnamesePhonetics('ngon')
    // n theo sau bởi g → không thay thế
    expect(result).toBe('ngon')
  })

  it('xử lý nhiều từ', () => {
    const result = normalizeVietnamesePhonetics('tạp hoá xanh')
    // t không thay (không bắt đầu bằng tr/gi/r/x/n/ngh), hoá → hoa, xanh → sanh
    expect(result).toBe('tap hoa sanh')
  })

  it('xử lý chuỗi rỗng', () => {
    expect(normalizeVietnamesePhonetics('')).toBe('')
  })

  it('xử lý null/undefined an toàn', () => {
    expect(normalizeVietnamesePhonetics(null)).toBe('')
    expect(normalizeVietnamesePhonetics(undefined)).toBe('')
  })
})
