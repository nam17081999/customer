const OSRM_BASE_URL = 'https://router.project-osrm.org'
const MAX_WAYPOINTS = 25
const EARTH_RADIUS_M = 6371000

function normalizePoint(point) {
  const lat = Number(point?.lat)
  const lng = Number(point?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return {
    lat,
    lng,
    name: typeof point?.name === 'string' ? point.name : '',
    id: point?.id != null ? String(point.id) : '',
  }
}

function getCoordinates(waypoints) {
  return waypoints.map((point) => `${point.lng},${point.lat}`).join(';')
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function haversineMeters(from, to) {
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)
  const dLat = lat2 - lat1
  const dLng = toRadians(to.lng - from.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_M * c
}

function buildHaversineDistanceMatrix(waypoints) {
  return waypoints.map((from) => (
    waypoints.map((to) => {
      if (from === to) return 0
      return haversineMeters(from, to)
    })
  ))
}

async function fetchOsrmJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'storevis-map-route/1.0',
      },
    })

    if (!response.ok) return { ok: false, data: null }
    const data = await response.json().catch(() => null)
    if (!data || typeof data !== 'object') return { ok: false, data: null }
    return { ok: true, data }
  } catch (error) {
    console.warn('OSRM request failed:', error)
    return { ok: false, data: null }
  }
}

async function fetchRouteLeg(from, to) {
  const coordinates = getCoordinates([from, to])
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?alternatives=false&annotations=false&continue_straight=true&geometries=geojson&overview=full&steps=false`
  const { ok, data } = await fetchOsrmJson(url)
  if (!ok) return null

  const route = data?.routes?.[0]
  const geometry = route?.geometry?.coordinates
  if (!Number.isFinite(route?.distance) || !Array.isArray(geometry) || geometry.length < 2) return null

  return {
    distance: Number(route.distance),
    duration: Number(route.duration) || null,
    coordinates: geometry,
  }
}

function appendCoordinates(target, segment) {
  if (!Array.isArray(segment) || segment.length === 0) return
  if (target.length === 0) {
    target.push(...segment)
    return
  }

  const [firstLng, firstLat] = segment[0] || []
  const [lastLng, lastLat] = target[target.length - 1] || []
  if (firstLng === lastLng && firstLat === lastLat) {
    target.push(...segment.slice(1))
    return
  }

  target.push(...segment)
}

async function buildRouteByLegs(waypoints) {
  const geometryCoordinates = []
  let totalDistance = 0
  let totalDuration = 0

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const from = waypoints[index]
    const to = waypoints[index + 1]
    const leg = await fetchRouteLeg(from, to)

    if (leg?.coordinates?.length) {
      appendCoordinates(geometryCoordinates, leg.coordinates)
      totalDistance += leg.distance
      totalDuration += leg.duration ?? (leg.distance / 8.33)
      continue
    }

    const fallbackSegment = [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]
    appendCoordinates(geometryCoordinates, fallbackSegment)
    const fallbackDistance = haversineMeters(from, to)
    totalDistance += fallbackDistance
    totalDuration += fallbackDistance / 8.33
  }

  if (geometryCoordinates.length < 2) return null

  return {
    distance: totalDistance,
    duration: totalDuration,
    geometry: {
      type: 'LineString',
      coordinates: geometryCoordinates,
    },
  }
}

function getTourDistance(distances, order) {
  let total = 0
  for (let index = 0; index < order.length - 1; index += 1) {
    const from = order[index]
    const to = order[index + 1]
    const distance = Number(distances?.[from]?.[to])
    if (!Number.isFinite(distance)) return Number.POSITIVE_INFINITY
    total += distance
  }
  return total
}

function pickNearestNeighbor(distances, currentIndex, remainingIndexes) {
  let nextIndex = remainingIndexes[0]
  let nextDistance = Number.POSITIVE_INFINITY

  for (const candidateIndex of remainingIndexes) {
    const distance = Number(distances?.[currentIndex]?.[candidateIndex])
    if (!Number.isFinite(distance)) continue
    if (distance < nextDistance) {
      nextDistance = distance
      nextIndex = candidateIndex
    }
  }

  return nextIndex
}

function buildGreedyOrder(distances, startIndex, candidateIndexes) {
  const remaining = [...candidateIndexes]
  const order = []
  let currentIndex = startIndex

  while (remaining.length > 0) {
    const nextIndex = pickNearestNeighbor(distances, currentIndex, remaining)
    order.push(nextIndex)
    currentIndex = nextIndex
    remaining.splice(remaining.indexOf(nextIndex), 1)
  }

  return order
}

function runTwoOpt(distances, initialOrder) {
  let bestOrder = [...initialOrder]
  let bestDistance = getTourDistance(distances, [0, ...bestOrder, 0])
  let improved = true

  while (improved) {
    improved = false
    for (let start = 0; start < bestOrder.length - 1; start += 1) {
      for (let end = start + 1; end < bestOrder.length; end += 1) {
        const candidateOrder = [
          ...bestOrder.slice(0, start),
          ...bestOrder.slice(start, end + 1).reverse(),
          ...bestOrder.slice(end + 1),
        ]
        const candidateDistance = getTourDistance(distances, [0, ...candidateOrder, 0])
        if (candidateDistance + 1e-6 < bestDistance) {
          bestOrder = candidateOrder
          bestDistance = candidateDistance
          improved = true
        }
      }
    }
  }

  return bestOrder
}

function getOptimizedStopIndexes(distances, stopCount) {
  const candidateIndexes = Array.from({ length: stopCount }, (_, index) => index + 1)
  if (candidateIndexes.length === 0) return []

  const seeds = []
  seeds.push(buildGreedyOrder(distances, 0, candidateIndexes))
  for (const startIndex of candidateIndexes) {
    const remaining = candidateIndexes.filter((index) => index !== startIndex)
    seeds.push([startIndex, ...buildGreedyOrder(distances, startIndex, remaining)])
  }

  let bestOrder = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const seed of seeds) {
    const improved = runTwoOpt(distances, seed)
    const distance = getTourDistance(distances, [0, ...improved, 0])
    if (distance < bestDistance) {
      bestDistance = distance
      bestOrder = improved
    }
  }

  if (!bestOrder) return candidateIndexes.map((index) => index - 1)
  return bestOrder.map((index) => index - 1)
}

async function handleBuildRoute(req, res, start, end, stops) {
  const waypoints = [...(start ? [start] : []), ...stops, ...(end ? [end] : [])]
  if (waypoints.length < 2) {
    return res.status(400).json({ error: 'Cần ít nhất 2 điểm để tạo tuyến.' })
  }

  if (waypoints.length > MAX_WAYPOINTS) {
    return res.status(400).json({ error: 'Tuyến hiện hỗ trợ tối đa 25 điểm.' })
  }

  const coordinates = getCoordinates(waypoints)
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?alternatives=false&annotations=false&continue_straight=true&geometries=geojson&overview=full&steps=false`
  const { ok, data } = await fetchOsrmJson(url)
  const route = ok ? data?.routes?.[0] : null

  if (route?.geometry?.coordinates?.length) {
    return res.status(200).json({
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    })
  }

  const fallbackRoute = await buildRouteByLegs(waypoints)
  if (fallbackRoute?.geometry?.coordinates?.length) {
    return res.status(200).json(fallbackRoute)
  }

  return res.status(502).json({ error: 'Dịch vụ chỉ đường tạm thời không phản hồi.' })
}

async function handleOptimizeRoute(req, res, start, end, stops) {
  if (stops.length < 2) {
    return res.status(400).json({ error: 'Chọn ít nhất 2 cửa hàng để sắp xếp.' })
  }

  const depot = start || end
  if (!depot) {
    return res.status(400).json({ error: 'Thiếu điểm xuất phát cố định để sắp xếp.' })
  }

  const waypoints = [depot, ...stops]
  if (waypoints.length > MAX_WAYPOINTS) {
    return res.status(400).json({ error: 'Danh sách hiện hỗ trợ tối đa 25 điểm.' })
  }

  const coordinates = getCoordinates(waypoints)
  const tableUrl = `${OSRM_BASE_URL}/table/v1/driving/${coordinates}?annotations=distance`
  const { ok, data } = await fetchOsrmJson(tableUrl)

  const distances = (
    ok
    && Array.isArray(data?.distances)
    && data.distances.length === waypoints.length
  )
    ? data.distances
    : buildHaversineDistanceMatrix(waypoints)

  const orderedStopIndexes = getOptimizedStopIndexes(distances, stops.length)
  const orderedStops = orderedStopIndexes.map((index) => stops[index]).filter(Boolean)

  if (orderedStops.length !== stops.length) {
    return res.status(502).json({ error: 'Không thể sắp xếp lại danh sách cửa hàng.' })
  }

  return res.status(200).json({
    orderedStopIds: orderedStops.map((stop) => stop.id),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const mode = req.body?.mode === 'optimize' ? 'optimize' : 'route'
    const start = normalizePoint(req.body?.start)
    const end = normalizePoint(req.body?.end)
    const stops = Array.isArray(req.body?.stops)
      ? req.body.stops.map(normalizePoint).filter(Boolean)
      : []

    if (mode === 'optimize') {
      return await handleOptimizeRoute(req, res, start, end, stops)
    }

    return await handleBuildRoute(req, res, start, end, stops)
  } catch (error) {
    console.error('Route API failed:', error)
    return res.status(500).json({ error: 'Không thể xử lý yêu cầu chỉ đường.' })
  }
}
