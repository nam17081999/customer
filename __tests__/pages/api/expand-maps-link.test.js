import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '@/pages/api/expand-maps-link'

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

describe('pages/api/expand-maps-link', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns 405 for non-POST requests', async () => {
    const res = createRes()

    await handler({ method: 'GET', body: {} }, res)

    expect(res.statusCode).toBe(405)
    expect(res.payload).toEqual({ error: 'Method not allowed' })
  })

  it('rejects non-google domains before fetch', async () => {
    const res = createRes()

    await handler({ method: 'POST', body: { url: 'https://example.com/x' } }, res)

    expect(res.statusCode).toBe(400)
    expect(res.payload.error).toContain('URL domain not allowed')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns coords parsed from expanded finalUrl', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.google.com/maps/place/X/@21.02851,105.80482,17z',
    })

    const res = createRes()
    await handler({ method: 'POST', body: { url: 'https://maps.app.goo.gl/share123' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      success: true,
      finalUrl: 'https://www.google.com/maps/place/X/@21.02851,105.80482,17z',
      coords: { lat: 21.02851, lng: 105.80482 },
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch.mock.calls[0][1].method).toBe('HEAD')
  })

  it('returns coords for Google Maps share link that redirects to /maps/search/lat,+lng', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.google.com/maps/search/21.069855,+105.707641?entry=tts&skid=7976d1ca',
    })

    const res = createRes()
    await handler({ method: 'POST', body: { url: 'https://maps.app.goo.gl/qQwGK1e8fYaDH4HW6' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      success: true,
      finalUrl: 'https://www.google.com/maps/search/21.069855,+105.707641?entry=tts&skid=7976d1ca',
      coords: { lat: 21.069855, lng: 105.707641 },
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to GET and parses coords from Google Maps share HTML metadata', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        url: 'https://www.google.com/maps/place/Cua+Hang+Minh+Anh',
      })
      .mockResolvedValueOnce({
        ok: true,
        url: 'https://www.google.com/maps/place/Cua+Hang+Minh+Anh',
        text: async () => '<meta property="og:image" content="https://maps.googleapis.com/maps/api/staticmap?center=21.02851%2C105.80482&amp;zoom=17">',
      })

    const res = createRes()
    await handler({ method: 'POST', body: { url: 'https://maps.app.goo.gl/share123' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      success: true,
      finalUrl: 'https://www.google.com/maps/place/Cua+Hang+Minh+Anh',
      coords: { lat: 21.02851, lng: 105.80482 },
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch.mock.calls[1][1].method).toBe('GET')
  })

  it('returns success with null coords when expanded page has no parseable coordinates', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        url: 'https://www.google.com/maps/place/Cua+Hang+Minh+Anh',
      })
      .mockResolvedValueOnce({
        ok: true,
        url: 'https://www.google.com/maps/place/Cua+Hang+Minh+Anh',
        text: async () => '<html>No coordinates here</html>',
      })

    const res = createRes()
    await handler({ method: 'POST', body: { url: 'https://maps.app.goo.gl/share123' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.coords).toBeNull()
  })
})
