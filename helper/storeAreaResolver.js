import { DISTRICT_SUGGESTIONS, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import { OLD_ADMIN_AREA_BOUNDARIES } from '@/data/oldAdminAreaBoundaries'
import removeVietnameseTones from '@/helper/removeVietnameseTones'

const ADDRESS_SPLIT_REGEX = /[,–—-]/

function isPointInRing(lat, lng, ring) {
  let inside = false
  for (let index = 0, prevIndex = ring.length - 1; index < ring.length; prevIndex = index++) {
    const [lng1, lat1] = ring[index]
    const [lng2, lat2] = ring[prevIndex]
    const intersects = ((lat1 > lat) !== (lat2 > lat))
      && (lng < ((lng2 - lng1) * (lat - lat1)) / ((lat2 - lat1) || Number.EPSILON) + lng1)
    if (intersects) inside = !inside
  }
  return inside
}

function isPointInPolygonGeometry(lat, lng, geometry) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') {
    const [outerRing, ...holes] = geometry.coordinates
    if (!isPointInRing(lat, lng, outerRing)) return false
    return !holes.some((ring) => isPointInRing(lat, lng, ring))
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => {
      const [outerRing, ...holes] = polygon
      if (!isPointInRing(lat, lng, outerRing)) return false
      return !holes.some((ring) => isPointInRing(lat, lng, ring))
    })
  }

  return false
}

function isInsideBounds(lat, lng, bounds) {
  if (!bounds) return false
  return lat >= bounds.minLat
    && lat <= bounds.maxLat
    && lng >= bounds.minLng
    && lng <= bounds.maxLng
}

function lookupOldAdminAreaFromBoundaries(lat, lng) {
  const matches = OLD_ADMIN_AREA_BOUNDARIES.filter((entry) => (
    isInsideBounds(lat, lng, entry.bounds)
    && isPointInPolygonGeometry(lat, lng, entry.geometry)
  ))

  if (matches.length !== 1) {
    return {
      district: '',
      ward: '',
      source: matches.length > 1 ? 'boundary_ambiguous' : 'boundary_unresolved',
    }
  }

  return {
    district: matches[0].district,
    ward: matches[0].ward,
    source: 'boundary_lookup',
  }
}

export function normalizeAreaText(value) {
  return removeVietnameseTones(String(value || ''))
    .replace(/\b(thanh pho|tp\.?|tinh|quan|huyen|thi xa|thi tran|phuong|xa)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function collectAddressCandidates(payload) {
  const values = []

  const pushValue = (value) => {
    const text = String(value || '').trim()
    if (!text) return
    values.push(text)
    for (const part of text.split(ADDRESS_SPLIT_REGEX).map((item) => String(item || '').trim()).filter(Boolean)) {
      values.push(part)
    }
  }

  const components = Array.isArray(payload?.components) ? payload.components : []
  for (const component of components) {
    pushValue(component?.long_name)
    pushValue(component?.short_name)
  }

  const address = payload?.address
  if (address && typeof address === 'object') {
    const orderedKeys = [
      'city_district',
      'district',
      'county',
      'state_district',
      'suburb',
      'quarter',
      'neighbourhood',
      'village',
      'hamlet',
      'town',
      'city',
      'municipality',
      'country',
    ]
    for (const key of orderedKeys) pushValue(address[key])
    for (const value of Object.values(address)) pushValue(value)
  }

  pushValue(payload?.displayName)
  pushValue(payload?.formattedAddress)

  return Array.from(new Set(values))
}

function getDistrictMatches(candidates) {
  const normalizedCandidates = candidates.map((item) => normalizeAreaText(item)).filter(Boolean)
  const matches = []

  for (const district of DISTRICT_SUGGESTIONS) {
    const normalizedDistrict = normalizeAreaText(district)
    let bestScore = 0

    for (const normalizedCandidate of normalizedCandidates) {
      if (normalizedCandidate === normalizedDistrict) {
        bestScore = Math.max(bestScore, 3)
      } else if (normalizedCandidate.includes(normalizedDistrict)) {
        bestScore = Math.max(bestScore, 2)
      } else if (
        normalizedCandidate.length >= 5
        && normalizedDistrict.includes(normalizedCandidate)
      ) {
        bestScore = Math.max(bestScore, 1)
      }
    }

    if (bestScore > 0) {
      matches.push({ district, score: bestScore })
    }
  }

  return matches.sort((left, right) => right.score - left.score)
}

export function findBestDistrict(candidates) {
  const matches = getDistrictMatches(candidates)
  if (matches.length === 0) return ''

  const topScore = matches[0].score
  const topMatches = matches.filter((item) => item.score === topScore)
  if (topMatches.length !== 1) return ''

  return topMatches[0].district
}

function getWardMatches(candidates, districts = DISTRICT_SUGGESTIONS) {
  const normalizedCandidates = candidates.map((item) => normalizeAreaText(item)).filter(Boolean)
  const matches = []

  for (const district of districts) {
    const wardOptions = DISTRICT_WARD_SUGGESTIONS[district] || []
    for (const ward of wardOptions) {
      const normalizedWard = normalizeAreaText(ward)
      let bestScore = 0

      for (const normalizedCandidate of normalizedCandidates) {
        if (normalizedCandidate === normalizedWard) {
          bestScore = Math.max(bestScore, 3)
        } else if (normalizedCandidate.includes(normalizedWard)) {
          bestScore = Math.max(bestScore, 2)
        } else if (
          normalizedCandidate.length >= 5
          && normalizedWard.includes(normalizedCandidate)
        ) {
          bestScore = Math.max(bestScore, 1)
        }
      }

      if (bestScore > 0) {
        matches.push({ district, ward, score: bestScore })
      }
    }
  }

  return matches.sort((left, right) => right.score - left.score)
}

export function findBestWard(candidates, district) {
  const matches = getWardMatches(candidates, district ? [district] : DISTRICT_SUGGESTIONS)
  if (matches.length === 0) return ''

  const topScore = matches[0].score
  const topMatches = matches.filter((item) => item.score === topScore)
  if (topMatches.length !== 1) return ''

  return topMatches[0].ward
}

export function inferDistrictWardFromOldWard(candidates) {
  const matches = getWardMatches(candidates)
  if (matches.length === 0) return { district: '', ward: '' }

  const topScore = matches[0].score
  const topMatches = matches.filter((item) => item.score === topScore)
  if (topMatches.length !== 1) return { district: '', ward: '' }

  return {
    district: topMatches[0].district,
    ward: topMatches[0].ward,
  }
}

export function resolveDistrictWardFromPayload(payload) {
  const candidates = collectAddressCandidates(payload)

  const inferredFromWard = inferDistrictWardFromOldWard(candidates)
  const matchedDistrict = findBestDistrict(candidates)

  const district = inferredFromWard.district || matchedDistrict
  const ward = district
    ? (inferredFromWard.district === district
      ? inferredFromWard.ward
      : findBestWard(candidates, district))
    : ''

  return {
    district,
    ward,
    candidates,
    provider: payload?.provider || payload?.source || 'unknown',
  }
}

export async function resolveDistrictWardFromCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { district: '', ward: '', source: 'invalid' }
  }

  return {
    ...lookupOldAdminAreaFromBoundaries(lat, lng),
    rawAddress: null,
    rawComponents: [],
  }
}
