import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '@/pages/api/reverse-geocode-area'

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.payload = body
      return this
    },
  }
}

describe('pages/api/reverse-geocode-area', () => {
  const originalFetch = global.fetch
  const originalEnv = {
    GEOAPIFY_API_KEY: process.env.GEOAPIFY_API_KEY,
    NEXT_PUBLIC_GEOAPIFY_API_KEY: process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
    OPENMAP_API_KEY: process.env.OPENMAP_API_KEY,
    NEXT_PUBLIC_OPENMAP_API_KEY: process.env.NEXT_PUBLIC_OPENMAP_API_KEY,
    GOONG_API_KEY: process.env.GOONG_API_KEY,
    NEXT_PUBLIC_GOONG_API_KEY: process.env.NEXT_PUBLIC_GOONG_API_KEY,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn()
    delete process.env.GEOAPIFY_API_KEY
    delete process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY
    delete process.env.OPENMAP_API_KEY
    delete process.env.NEXT_PUBLIC_OPENMAP_API_KEY
    delete process.env.GOONG_API_KEY
    delete process.env.NEXT_PUBLIC_GOONG_API_KEY
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.GEOAPIFY_API_KEY = originalEnv.GEOAPIFY_API_KEY
    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY = originalEnv.NEXT_PUBLIC_GEOAPIFY_API_KEY
    process.env.OPENMAP_API_KEY = originalEnv.OPENMAP_API_KEY
    process.env.NEXT_PUBLIC_OPENMAP_API_KEY = originalEnv.NEXT_PUBLIC_OPENMAP_API_KEY
    process.env.GOONG_API_KEY = originalEnv.GOONG_API_KEY
    process.env.NEXT_PUBLIC_GOONG_API_KEY = originalEnv.NEXT_PUBLIC_GOONG_API_KEY
  })

  it('returns 405 for non-POST requests', async () => {
    const req = { method: 'GET', body: {} }
    const res = createRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.payload).toEqual({ error: 'Method not allowed' })
  })

  it('returns 400 for invalid coordinates', async () => {
    const req = { method: 'POST', body: { lat: 'abc', lng: 105 } }
    const res = createRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.payload).toEqual({ error: 'Tọa độ không hợp lệ.' })
  })

  it('prefers Geoapify and preserves district-level data when provider returns suburb district city country', async () => {
    process.env.GEOAPIFY_API_KEY = 'geoapify-key'
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            suburb: 'Mỹ Đình 1',
            district: 'Nam Từ Liêm',
            city: 'Hà Nội',
            county: 'Hà Nội',
            country: 'Việt Nam',
            formatted: 'Mỹ Đình 1, Nam Từ Liêm, Hà Nội, Việt Nam',
            result_type: 'suburb',
          },
        ],
      }),
    })

    const req = { method: 'POST', body: { lat: 21.028, lng: 105.78 } }
    const res = createRes()

    await handler(req, res)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url] = global.fetch.mock.calls[0]
    expect(url).toContain('api.geoapify.com/v1/geocode/reverse')
    expect(url).toContain('format=json')
    expect(url).toContain('lang=vi')
    expect(url).toContain('lat=21.028')
    expect(url).toContain('lon=105.78')
    expect(res.statusCode).toBe(200)
    expect(res.payload.provider).toBe('geoapify')
    expect(res.payload.address).toEqual({
      suburb: 'Mỹ Đình 1',
      city_district: 'Nam Từ Liêm',
      city: 'Hà Nội',
      county: 'Hà Nội',
      country: 'Việt Nam',
    })
    expect(res.payload.formattedAddress).toBe('Mỹ Đình 1, Nam Từ Liêm, Hà Nội, Việt Nam')
  })

  it('falls back to OpenMap when Geoapify fails', async () => {
    process.env.GEOAPIFY_API_KEY = 'geoapify-key'
    process.env.OPENMAP_API_KEY = 'openmap-key'
    global.fetch
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              formatted_address: 'An Khánh, Hoài Đức, Hà Nội',
              address_components: [
                { long_name: 'An Khánh', short_name: 'An Khánh' },
                { long_name: 'Hoài Đức', short_name: 'Hoài Đức' },
                { long_name: 'Hà Nội', short_name: 'Hà Nội' },
              ],
            },
          ],
        }),
      })

    const req = { method: 'POST', body: { lat: 21.01, lng: 105.7 } }
    const res = createRes()

    await handler(req, res)

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch.mock.calls[0][0]).toContain('geoapify.com')
    expect(global.fetch.mock.calls[1][0]).toContain('openmap.vn')
    expect(res.statusCode).toBe(200)
    expect(res.payload.provider).toBe('openmap')
  })

  it('falls back to Goong when Geoapify and OpenMap fail', async () => {
    process.env.GEOAPIFY_API_KEY = 'geoapify-key'
    process.env.OPENMAP_API_KEY = 'openmap-key'
    process.env.GOONG_API_KEY = 'goong-key'
    global.fetch
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              formatted_address: 'An Khánh, Hoài Đức, Hà Nội',
              address_components: [
                { long_name: 'An Khánh', short_name: 'An Khánh' },
                { long_name: 'Hoài Đức', short_name: 'Hoài Đức' },
                { long_name: 'Hà Nội', short_name: 'Hà Nội' },
              ],
            },
          ],
        }),
      })

    const req = { method: 'POST', body: { lat: 21.01, lng: 105.7 } }
    const res = createRes()

    await handler(req, res)

    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(global.fetch.mock.calls[0][0]).toContain('geoapify.com')
    expect(global.fetch.mock.calls[1][0]).toContain('openmap.vn')
    expect(global.fetch.mock.calls[2][0]).toContain('goong.io')
    expect(res.statusCode).toBe(200)
    expect(res.payload.provider).toBe('goong')
  })

  it('falls back to Nominatim when all keyed providers fail or are missing', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: {
          suburb: 'An Khánh',
          city_district: 'Hoài Đức',
          city: 'Hà Nội',
          country: 'Việt Nam',
        },
        display_name: 'An Khánh, Hoài Đức, Hà Nội, Việt Nam',
      }),
    })

    const req = { method: 'POST', body: { lat: 21.01, lng: 105.7 } }
    const res = createRes()

    await handler(req, res)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url] = global.fetch.mock.calls[0]
    expect(url).toContain('nominatim.openstreetmap.org/reverse')
    expect(url).toContain('accept-language=vi')
    expect(res.statusCode).toBe(200)
    expect(res.payload.provider).toBe('nominatim')
    expect(res.payload.address.city_district).toBe('Hoài Đức')
  })
})
