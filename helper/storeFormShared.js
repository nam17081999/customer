export function extractCoordsFromMapsUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return null
  const htmlDecoded = raw
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u002c/g, ',')
    .replace(/&amp;/g, '&')
  const safelyDecode = (value) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  const candidates = Array.from(new Set([
    raw,
    htmlDecoded,
    safelyDecode(raw),
    safelyDecode(htmlDecoded),
  ]))

  const coord = '([+-]?\\d+(?:\\.\\d+)?)'
  const separator = '\\s*(?:,|%2C)\\s*'
  const patterns = [
    new RegExp(`!3d${coord}!4d${coord}`, 'i'),
    new RegExp(`[?&]q=${coord}${separator}${coord}`, 'i'),
    new RegExp(`[?&]ll=${coord}${separator}${coord}`, 'i'),
    new RegExp(`[?&]query=${coord}${separator}${coord}`, 'i'),
    new RegExp(`[?&]markers=${coord}${separator}${coord}`, 'i'),
    new RegExp(`[?&]markers=[^"'&<>]*?${coord}${separator}${coord}`, 'i'),
    new RegExp(`/maps/search/${coord}${separator}${coord}`, 'i'),
    new RegExp(`/search/${coord}${separator}${coord}`, 'i'),
    new RegExp(`/place/[^/]*/@${coord}${separator}${coord}`, 'i'),
    new RegExp(`@${coord}${separator}${coord}`, 'i'),
    new RegExp(`[?&]center=${coord}${separator}${coord}`, 'i'),
  ]

  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const match = candidate.match(pattern)
      if (!match) continue
      const lat = Number.parseFloat(match[1])
      const lng = Number.parseFloat(match[2])
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng }
      }
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

    if (
      data.coords
      && Number.isFinite(Number(data.coords.lat))
      && Number.isFinite(Number(data.coords.lng))
      && Number(data.coords.lat) >= -90
      && Number(data.coords.lat) <= 90
      && Number(data.coords.lng) >= -180
      && Number(data.coords.lng) <= 180
    ) {
      return {
        coords: {
          lat: Number(data.coords.lat),
          lng: Number(data.coords.lng),
        },
        error: '',
      }
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
