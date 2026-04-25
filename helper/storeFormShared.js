export function extractCoordsFromMapsUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return null

  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /\/place\/[^/]*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ]

  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (!match) continue
    const lat = Number.parseFloat(match[1])
    const lng = Number.parseFloat(match[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }

  return null
}

export async function resolveMapsLinkCoordinates(link, fetcher = fetch) {
  const trimmed = String(link || '').trim()
  if (!trimmed) return { coords: null, error: '' }

  const directCoords = extractCoordsFromMapsUrl(trimmed)
  if (directCoords) return { coords: directCoords, error: '' }

  const isShortLink = /goo\.gl|maps\.app\.goo\.gl/i.test(trimmed)
  if (!isShortLink) {
    return { coords: null, error: 'Không tìm thấy tọa độ trong link' }
  }

  try {
    const res = await fetcher('/api/expand-maps-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
    })
    const data = await res.json()
    if (!data.success || !data.finalUrl) {
      return { coords: null, error: 'Không mở được link' }
    }

    const expandedCoords = extractCoordsFromMapsUrl(data.finalUrl)
    if (expandedCoords) return { coords: expandedCoords, error: '' }
    return { coords: null, error: 'Không tìm thấy tọa độ từ link' }
  } catch {
    return { coords: null, error: 'Lỗi khi xử lý link' }
  }
}

export function getStoreFormFinalCoordinates({
  userHasEditedMap,
  pickedLat,
  pickedLng,
  initialGPSLat,
  initialGPSLng,
}) {
  if (userHasEditedMap && pickedLat != null && pickedLng != null) {
    return { latitude: pickedLat, longitude: pickedLng }
  }
  if (initialGPSLat != null && initialGPSLng != null) {
    return { latitude: initialGPSLat, longitude: initialGPSLng }
  }
  if (pickedLat != null && pickedLng != null) {
    return { latitude: pickedLat, longitude: pickedLng }
  }
  return { latitude: null, longitude: null }
}

export function buildDuplicatePhoneMessage(matches, label = 'Số điện thoại') {
  const labels = (matches || []).slice(0, 3).map((entry) => entry.name || 'Cửa hàng')
  return `${label} đã tồn tại ở ${labels.join('; ')}`
}
