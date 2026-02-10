// Utility & parsing functions extracted from create store page
import { toTitleCaseVI } from '@/lib/utils'

// Internal short-link expander implementation (injectable from page)
let expandShortLinkImpl = async function () { return null }
export function setExpandShortLink(fn) { if (typeof fn === 'function') expandShortLinkImpl = fn }

export function cleanNominatimDisplayName(name) {
  if (!name) return ''
  const parts = name.split(',').map((p) => p.trim())
  while (parts.length > 0) {
    const last = parts[parts.length - 1]
    if (last.toLowerCase() === 'việt nam' || /^[0-9]{4,6}$/.test(last)) {
      parts.pop(); continue
    }
    break
  }
  return parts.join(', ')
}

export function parseLatLngFromText(text) {
  if (!text) return null
  try {
    const decoded = decodeURIComponent(text)
    let m = decoded.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
    m = decoded.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/)
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
    m = decoded.match(/(-?\d{1,2}\.\d+)\s*(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i)
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
    m = decoded.match(/(-?\d{1,2}\.\d+)\s+(-?\d{1,3}\.\d+)/i)
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
    m = decoded.match(/\((-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)\)/i)
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
    return null
  } catch { return null }
}

export function parseLatLngFromGoogleMapsUrl(input) {
  if (!input) return null
  let urlStr = input.trim()
  if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
  try {
    const u = new URL(urlStr)
    // NEW ORDER: prefer !3d / !4d marker pair first (true POI) before @ (camera center)
    let m = urlStr.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/)
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
    m = urlStr.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
    const candParams = ['destination','q','query','ll','saddr','daddr','center']
    for (const key of candParams) {
      const val = u.searchParams.get(key)
      if (val) {
        const got = parseLatLngFromText(val)
        if (got) return got
      }
    }
    const fromPath = parseLatLngFromText(u.pathname)
    if (fromPath) return fromPath
    const fromHash = parseLatLngFromText(u.hash)
    if (fromHash) return fromHash
    const fromHref = parseLatLngFromText(u.href)
    if (fromHref) return fromHref
    return null
  } catch { return parseLatLngFromText(input) }
}

export function extractSearchTextFromGoogleMapsUrl(input) {
  if (!input) return null
  let urlStr = input.trim()
  if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
  try {
    const u = new URL(urlStr)
    const qParams = ['q','query','destination']
    for (const k of qParams) {
      const v = u.searchParams.get(k)
      if (v) {
        const decoded = decodeURIComponent(v.replace(/\+/g,' '))
        if (!/^-?\d+\.\d+/.test(decoded)) return decoded
      }
    }
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex(p=>p.toLowerCase()==='place')
    if (idx !== -1 && parts[idx+1]) return decodeURIComponent(parts[idx+1].replace(/\+/g,' '))
    const searchIdx = parts.findIndex(p=>p.toLowerCase()==='search')
    if (searchIdx !== -1 && parts[searchIdx+1]) return decodeURIComponent(parts[searchIdx+1].replace(/\+/g,' '))
    return null
  } catch { return null }
}

export async function geocodeWithGoogle(address) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return await geocodeTextToLatLngAddress(address)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=vi&region=vn`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Google Geocoding API error')
    const data = await res.json()
    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0]
      const { lat, lng } = result.geometry.location
      return { lat, lng, address: result.formatted_address }
    }
    return null
  } catch { return await geocodeTextToLatLngAddress(address) }
}

export async function geocodeTextToLatLngAddress(text) {
  if (!text) return null
  try {
    const q = encodeURIComponent(text)
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}&accept-language=vi`
    const res = await fetch(url)
    if (!res.ok) return null
    const arr = await res.json()
    if (!Array.isArray(arr) || arr.length===0) return null
    const item = arr[0]
    const lat = parseFloat(item.lat); const lon = parseFloat(item.lon)
    if (!isFinite(lat) || !isFinite(lon)) return null
    return { lat, lng: lon, address: cleanNominatimDisplayName(item.display_name || '') }
  } catch { return null }
}

export async function resolveLatLngFromAnyLink(input) {
  if (!input || !input.trim()) return null
  const urlStr = input.trim()
  const direct = parseLatLngFromGoogleMapsUrl(urlStr)
  if (direct) return direct
  try {
    let fullUrl = urlStr
    if (!/^https?:\/\//i.test(fullUrl)) fullUrl = `https://${fullUrl}`
    const finalUrl = await expandShortLinkImpl(fullUrl)
    if (finalUrl && finalUrl !== fullUrl) {
      const parsed = parseLatLngFromGoogleMapsUrl(finalUrl)
      if (parsed) return parsed
    }
  } catch {}
  const text = extractSearchTextFromGoogleMapsUrl(urlStr)
  if (text) {
    const geo = await geocodeWithGoogle(text)
    if (geo) return { lat: geo.lat, lng: geo.lng }
  }
  return null
}

export async function reverseGeocodeFromLatLng(lat, lon, setAddress) {
  const latR = Number(lat.toFixed(5))
  const lonR = Number(lon.toFixed(5))
  const cacheKey = `revgeo:${latR},${lonR}`
  const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null
  if (cached) { setAddress(cached); return }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latR}&lon=${lonR}&zoom=18&addressdetails=1&accept-language=vi`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Reverse geocoding failed')
    const data = await res.json()
    const text = data?.display_name || ''
    const cleaned = cleanNominatimDisplayName(text)
    if (cleaned) {
      setAddress(cleaned)
      try { sessionStorage.setItem(cacheKey, cleaned) } catch {}
    }
  } catch {}
}

export async function reverseGeocodeToParts(lat, lon) {
  const latR = Number(lat.toFixed(5))
  const lonR = Number(lon.toFixed(5))
  const cacheKey = `revgeo_parts:${latR},${lonR}`
  const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latR}&lon=${lonR}&zoom=18&addressdetails=1&accept-language=vi`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Reverse geocoding failed')
    const data = await res.json()
    const addr = data?.address || {}
    const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || addr.hamlet || ''
    const district = addr.city_district || addr.state_district || addr.county || addr.district || ''
    const detailParts = []
    if (addr.house_number) detailParts.push(addr.house_number)
    if (addr.road || addr.residential) detailParts.push(addr.road || addr.residential)
    if ((addr.hamlet || addr.village) && ward !== addr.hamlet && ward !== addr.village) {
      detailParts.push(addr.hamlet || addr.village)
    }
    const address_detail = detailParts.join(', ')
    let finalDistrict = district
    if (!finalDistrict) {
      const cleaned = cleanNominatimDisplayName(data?.display_name || '')
      const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 2) {
        if (!finalDistrict && parts.length >= 3) finalDistrict = parts[parts.length - 2]
      }
    }

    const result = {
      address_detail,
      ward,
      district: finalDistrict || ''
    }
    try { sessionStorage.setItem(cacheKey, JSON.stringify(result)) } catch {}
    return result
  } catch {
    return null
  }
}
