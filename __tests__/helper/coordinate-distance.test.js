import { describe, it, expect } from 'vitest'
import { parseCoordinate, hasValidCoordinates } from '@/helper/coordinate'
import { haversineKm } from '@/helper/distance'

// ── parseCoordinate ───────────────────────────────────────────────────────────

describe('parseCoordinate', () => {
  it('trả về số hữu hạn khi đầu vào là số hợp lệ', () => {
    expect(parseCoordinate(21.0)).toBe(21.0)
    expect(parseCoordinate(105.8)).toBe(105.8)
    expect(parseCoordinate(0)).toBe(0)
    expect(parseCoordinate(-90)).toBe(-90)
  })

  it('trả về NaN khi đầu vào là Infinity', () => {
    expect(parseCoordinate(Infinity)).toBeNaN()
    expect(parseCoordinate(-Infinity)).toBeNaN()
  })

  it('trả về NaN khi đầu vào là NaN', () => {
    expect(parseCoordinate(NaN)).toBeNaN()
  })

  it('parse chuỗi số hợp lệ', () => {
    expect(parseCoordinate('21.0')).toBe(21.0)
    expect(parseCoordinate('105.8')).toBe(105.8)
    expect(parseCoordinate(' 21.5 ')).toBe(21.5)
  })

  it('parse chuỗi dùng dấu phẩy thay dấu chấm', () => {
    expect(parseCoordinate('21,5')).toBe(21.5)
    expect(parseCoordinate('105,87')).toBe(105.87)
  })

  it('trả về NaN khi chuỗi hoàn toàn không phải số', () => {
    expect(parseCoordinate('abc')).toBeNaN()
    expect(parseCoordinate('')).toBeNaN()
    expect(parseCoordinate('   ')).toBeNaN()
  })

  it('parseFloat lấy phần số ở đầu chuỗi (behaviour của implementation)', () => {
    // parseFloat('12abc') === 12 → đây là behaviour thực tế của Number.parseFloat
    // Implementation dùng Number.parseFloat nên kết quả là 12
    expect(parseCoordinate('12abc')).toBe(12)
  })

  it('trả về NaN khi đầu vào là null', () => {
    // null không phải number, không phải string → NaN
    expect(parseCoordinate(null)).toBeNaN()
  })

  it('trả về NaN khi đầu vào là undefined', () => {
    expect(parseCoordinate(undefined)).toBeNaN()
  })

  it('trả về NaN khi đầu vào là boolean', () => {
    expect(parseCoordinate(true)).toBeNaN()
    expect(parseCoordinate(false)).toBeNaN()
  })

  it('trả về NaN khi đầu vào là object', () => {
    expect(parseCoordinate({})).toBeNaN()
    expect(parseCoordinate([])).toBeNaN()
  })
})

// ── hasValidCoordinates ───────────────────────────────────────────────────────

describe('hasValidCoordinates', () => {
  it('trả về true với tọa độ Hà Nội hợp lệ', () => {
    expect(hasValidCoordinates(21.0283, 105.8542)).toBe(true)
  })

  it('trả về true với ranh giới hợp lệ', () => {
    expect(hasValidCoordinates(-90, -180)).toBe(true)
    expect(hasValidCoordinates(90, 180)).toBe(true)
    expect(hasValidCoordinates(0, 0)).toBe(true)
  })

  it('trả về false khi lat vượt [-90, 90]', () => {
    expect(hasValidCoordinates(91, 105)).toBe(false)
    expect(hasValidCoordinates(-91, 105)).toBe(false)
  })

  it('trả về false khi lng vượt [-180, 180]', () => {
    expect(hasValidCoordinates(21, 181)).toBe(false)
    expect(hasValidCoordinates(21, -181)).toBe(false)
  })

  it('trả về false khi đầu vào là NaN', () => {
    expect(hasValidCoordinates(NaN, 105)).toBe(false)
    expect(hasValidCoordinates(21, NaN)).toBe(false)
  })

  it('trả về false khi đầu vào là null', () => {
    expect(hasValidCoordinates(null, 105)).toBe(false)
    expect(hasValidCoordinates(21, null)).toBe(false)
  })
})

// ── haversineKm ───────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('trả về 0 khi hai điểm trùng nhau', () => {
    expect(haversineKm(21.0, 105.8, 21.0, 105.8)).toBeCloseTo(0, 5)
  })

  it('tính khoảng cách Hà Nội → TP.HCM (~1137 km)', () => {
    // Hà Nội: 21.0245, 105.8412
    // TP.HCM: 10.8231, 106.6297
    // Kết quả thực tế của công thức haversine với các tọa độ này là ~1137 km
    const dist = haversineKm(21.0245, 105.8412, 10.8231, 106.6297)
    expect(dist).toBeGreaterThan(1100)
    expect(dist).toBeLessThan(1200)
  })

  it('tính khoảng cách giữa 2 điểm gần nhau (~0.1 km)', () => {
    // 0.001 độ lat ≈ 0.111 km
    const dist = haversineKm(21.0, 105.8, 21.001, 105.8)
    expect(dist).toBeCloseTo(0.111, 2)
  })

  it('đối xứng: dist(A,B) = dist(B,A)', () => {
    const d1 = haversineKm(21.0, 105.8, 21.1, 105.9)
    const d2 = haversineKm(21.1, 105.9, 21.0, 105.8)
    expect(d1).toBeCloseTo(d2, 8)
  })

  it('trả về số dương cho 2 điểm khác nhau', () => {
    expect(haversineKm(21.0, 105.0, 21.1, 106.0)).toBeGreaterThan(0)
  })

  it('tính đúng khoảng cách vượt ranh giới kinh tuyến 0°', () => {
    // London (51.5, -0.1) → Paris (48.8, 2.3) ≈ 340 km
    const dist = haversineKm(51.5, -0.1, 48.8, 2.3)
    expect(dist).toBeGreaterThan(300)
    expect(dist).toBeLessThan(400)
  })
})
