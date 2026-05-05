const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const GOONG_REVERSE_URL = 'https://rsapi.goong.io/Geocode'
const OPENMAP_REVERSE_URL = 'https://mapapis.openmap.vn/v1/geocode/reverse'
const GEOAPIFY_REVERSE_URL = 'https://api.geoapify.com/v1/geocode/reverse'

function isValidCoordinate(lat, lng) {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
}

async function reverseWithGeoapify(lat, lng, apiKey) {
  const url = new URL(GEOAPIFY_REVERSE_URL)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('lang', 'vi')
  url.searchParams.set('format', 'json')
  url.searchParams.set('apiKey', apiKey)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NPP-Ha-Cong/1.0 (reverse-geocode-area)',
    },
  })

  if (!response.ok) {
    throw new Error('GEOAPIFY_REVERSE_FAILED')
  }

  const payload = await response.json()
  const firstResult = Array.isArray(payload?.results) ? payload.results[0] : null
  return {
    provider: 'geoapify',
    address: {
      suburb: firstResult?.suburb || firstResult?.quarter || firstResult?.village || '',
      city_district: firstResult?.district || firstResult?.county || '',
      city: firstResult?.city || firstResult?.state || '',
      county: firstResult?.county || '',
      country: firstResult?.country || '',
    },
    displayName: firstResult?.formatted || '',
    formattedAddress: firstResult?.formatted || '',
    components: [],
  }
}

async function reverseWithGoong(lat, lng, apiKey) {
  const url = new URL(GOONG_REVERSE_URL)
  url.searchParams.set('latlng', `${lat},${lng}`)
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NPP-Ha-Cong/1.0 (reverse-geocode-area)',
    },
  })

  if (!response.ok) {
    throw new Error('GOONG_REVERSE_FAILED')
  }

  const payload = await response.json()
  const firstResult = Array.isArray(payload?.results) ? payload.results[0] : null
  return {
    provider: 'goong',
    components: Array.isArray(firstResult?.address_components) ? firstResult.address_components : [],
    formattedAddress: firstResult?.formatted_address || '',
    displayName: firstResult?.formatted_address || '',
    address: null,
  }
}

async function reverseWithOpenMap(lat, lng, apiKey) {
  const url = new URL(OPENMAP_REVERSE_URL)
  url.searchParams.set('latlng', `${lat},${lng}`)
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('admin_v2', 'false')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NPP-Ha-Cong/1.0 (reverse-geocode-area)',
    },
  })

  if (!response.ok) {
    throw new Error('OPENMAP_REVERSE_FAILED')
  }

  const payload = await response.json()
  const firstResult = Array.isArray(payload?.results) ? payload.results[0] : null
  return {
    provider: 'openmap',
    components: Array.isArray(firstResult?.address_components) ? firstResult.address_components : [],
    formattedAddress: firstResult?.formatted_address || '',
    displayName: firstResult?.formatted_address || '',
    address: null,
  }
}

async function reverseWithNominatim(lat, lng) {
  const url = new URL(NOMINATIM_REVERSE_URL)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('zoom', '18')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('namedetails', '0')
  url.searchParams.set('accept-language', 'vi')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'vi',
      'User-Agent': 'NPP-Ha-Cong/1.0 (reverse-geocode-area)',
    },
  })

  if (!response.ok) {
    throw new Error('NOMINATIM_REVERSE_FAILED')
  }

  const payload = await response.json()
  return {
    provider: 'nominatim',
    address: payload?.address || {},
    displayName: payload?.display_name || '',
    formattedAddress: payload?.display_name || '',
    components: [],
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const lat = Number(req.body?.lat)
    const lng = Number(req.body?.lng)

    if (!isValidCoordinate(lat, lng)) {
      return res.status(400).json({ error: 'Tọa độ không hợp lệ.' })
    }

    const geoapifyApiKey = process.env.GEOAPIFY_API_KEY || process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || ''
    const openMapApiKey = process.env.OPENMAP_API_KEY || process.env.NEXT_PUBLIC_OPENMAP_API_KEY || ''
    const goongApiKey = process.env.GOONG_API_KEY || process.env.NEXT_PUBLIC_GOONG_API_KEY || ''

    try {
      if (geoapifyApiKey) {
        const result = await reverseWithGeoapify(lat, lng, geoapifyApiKey)
        return res.status(200).json(result)
      }
    } catch (error) {
      console.error('Geoapify reverse geocode failed, fallback to next provider:', error)
    }

    try {
      if (openMapApiKey) {
        const result = await reverseWithOpenMap(lat, lng, openMapApiKey)
        return res.status(200).json(result)
      }
    } catch (error) {
      console.error('OpenMap reverse geocode failed, fallback to next provider:', error)
    }

    try {
      if (goongApiKey) {
        const result = await reverseWithGoong(lat, lng, goongApiKey)
        return res.status(200).json(result)
      }
    } catch (error) {
      console.error('Goong reverse geocode failed, fallback to Nominatim:', error)
    }

    const fallbackResult = await reverseWithNominatim(lat, lng)
    return res.status(200).json(fallbackResult)
  } catch (error) {
    console.error('Reverse geocode area error:', error)
    return res.status(500).json({ error: 'Không reverse geocode được vị trí.' })
  }
}
