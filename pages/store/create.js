import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-context'
import Link from 'next/link'
import imageCompression from 'browser-image-compression'
import { toTitleCaseVI } from '@/lib/utils'

export default function AddStore() {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [gmapLink, setGmapLink] = useState('')
  const [gmapResolving, setGmapResolving] = useState(false)
  const lastParsedRef = useRef(null)

  useEffect(() => {
    if (!user) return
    const qName = typeof router.query.name === 'string' ? router.query.name.trim() : ''
    if (qName) setName(toTitleCaseVI(qName))
  }, [user, router.query.name])

  // Auto-fill address on mount (no manual typing needed)
  useEffect(() => {
    if (!user) return
    if (!address && !resolvingAddr) {
      handleFillAddress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function cleanNominatimDisplayName(name) {
    if (!name) return ''
    const parts = name.split(',').map((p) => p.trim())
    while (parts.length > 0) {
      const last = parts[parts.length - 1]
      if (last.toLowerCase() === 'việt nam' || /^[0-9]{4,6}$/.test(last)) {
        parts.pop()
        continue
      }
      break
    }
    return parts.join(', ')
  }

  function parseLatLngFromText(text) {
    if (!text) return null
    try {
      const decoded = decodeURIComponent(text)
      // Pattern 1: @lat,lng,zoom
      let m = decoded.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
      }
      // Pattern 2: !3dlat!4dlng (Google deep params)
      m = decoded.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
      }
      // Pattern 3: lat,lng separated by comma or %2C
      m = decoded.match(/(-?\d{1,2}\.\d+)\s*(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
      }
      return null
    } catch {
      return null
    }
  }

  function parseLatLngFromGoogleMapsUrl(input) {
    if (!input) return null
    let urlStr = input.trim()
    if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
    try {
      const u = new URL(urlStr)
      // Common query params
      const candParams = ['destination', 'q', 'query', 'll']
      for (const key of candParams) {
        const val = u.searchParams.get(key)
        if (val) {
          const got = parseLatLngFromText(val)
          if (got) return got
        }
      }
      // Try full href and path
      const fromHref = parseLatLngFromText(u.href)
      if (fromHref) return fromHref
      const fromPath = parseLatLngFromText(u.pathname)
      if (fromPath) return fromPath
      return null
    } catch {
      // Last resort: try raw text regex
      return parseLatLngFromText(input)
    }
  }

  function extractSearchTextFromGoogleMapsUrl(input) {
    if (!input) return null
    let urlStr = input.trim()
    if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
    try {
      const u = new URL(urlStr)
      const qParams = ['q', 'query']
      for (const k of qParams) {
        const v = u.searchParams.get(k)
        if (v) return decodeURIComponent(v.replace(/\+/g, ' '))
      }
      // /place/<name>/... → take the segment after /place/
      const parts = u.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex((p) => p.toLowerCase() === 'place')
      if (idx !== -1 && parts[idx + 1]) {
        return decodeURIComponent(parts[idx + 1].replace(/\+/g, ' '))
      }
      return null
    } catch {
      return null
    }
  }

  async function geocodeTextToLatLngAddress(text) {
    if (!text) return null
    try {
      const q = encodeURIComponent(text)
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}&accept-language=vi`
      const res = await fetch(url)
      if (!res.ok) return null
      const arr = await res.json()
      if (!Array.isArray(arr) || arr.length === 0) return null
      const item = arr[0]
      const lat = parseFloat(item.lat)
      const lon = parseFloat(item.lon)
      if (!isFinite(lat) || !isFinite(lon)) return null
      const cleaned = cleanNominatimDisplayName(item.display_name || '')
      return { lat, lng: lon, address: cleaned }
    } catch {
      return null
    }
  }

  async function resolveLatLngFromAnyLink(input) {
    // Try direct parse first
    const direct = parseLatLngFromGoogleMapsUrl(input)
    if (direct) return direct

    // Try following redirect to expand short link and parse final URL (via API)
    try {
      let urlStr = input.trim()
      if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
      const finalUrl = await expandShortLink(urlStr)
      if (finalUrl) {
        const parsed = parseLatLngFromGoogleMapsUrl(finalUrl)
        if (parsed) return parsed
      }
    } catch {}

    // Fallback: extract search text and geocode
    const text = extractSearchTextFromGoogleMapsUrl(input)
    if (text) {
      const geo = await geocodeTextToLatLngAddress(text)
      if (geo) return { lat: geo.lat, lng: geo.lng }
    }

    return null
  }

  async function reverseGeocodeFromLatLng(lat, lon) {
    try {
      setGmapResolving(true)
      const latR = Number(lat.toFixed(5))
      const lonR = Number(lon.toFixed(5))
      const cacheKey = `revgeo:${latR},${lonR}`
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null
      if (cached) {
        setAddress(cached)
        return
      }
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
    } catch (e) {
      console.error('Reverse geocode (from link) error:', e)
    } finally {
      setGmapResolving(false)
    }
  }

  useEffect(() => {
    if (!gmapLink || !gmapLink.trim()) return
    const t = setTimeout(async () => {
      setGmapResolving(true)
      try {
        // First try direct
        const direct = parseLatLngFromGoogleMapsUrl(gmapLink.trim())
        if (direct) {
          const last = lastParsedRef.current
          if (!last || Math.abs(last.lat - direct.lat) > 1e-5 || Math.abs(last.lng - direct.lng) > 1e-5) {
            lastParsedRef.current = direct
            await reverseGeocodeFromLatLng(direct.lat, direct.lng)
          }
          return
        }
        // Try expand via API then parse
        const finalUrl = await expandShortLink(gmapLink.trim())
        if (finalUrl) {
          const parsed = parseLatLngFromGoogleMapsUrl(finalUrl)
          if (parsed) {
            lastParsedRef.current = parsed
            await reverseGeocodeFromLatLng(parsed.lat, parsed.lng)
            return
          }
        }
        // Fallback to text geocoding
        const text = extractSearchTextFromGoogleMapsUrl(gmapLink.trim())
        if (text) {
          const geo = await geocodeTextToLatLngAddress(text)
          if (geo) {
            lastParsedRef.current = { lat: geo.lat, lng: geo.lng }
            if (geo.address) setAddress(geo.address)
          }
        }
      } finally {
        setGmapResolving(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [gmapLink])

  async function handleFillAddress() {
    try {
      setResolvingAddr(true)
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => reject(err)
        )
      })
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1&accept-language=vi`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Reverse geocoding failed')
      const data = await res.json()
      const text = data?.display_name || ''
      const cleaned = cleanNominatimDisplayName(text)
      if (cleaned) setAddress(cleaned)
      else alert('Không lấy được địa chỉ từ Nominatim')
    } catch (err) {
      console.error('Auto fill address error:', err)
      alert('Không lấy được địa chỉ. Vui lòng cấp quyền định vị cho trang này và thử lại.')
    } finally {
      setResolvingAddr(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) {
      alert('Vui lòng đăng nhập để tạo cửa hàng')
      return
    }

    if (!name || !address || !imageFile) {
      alert('Tên, địa chỉ và ảnh là bắt buộc')
      return
    }

    // Normalize name to Title Case before saving
    const normalizedName = toTitleCaseVI(name.trim())

    // Determine coordinates: prefer link if provided; else geolocation
    let latitude = null
    let longitude = null

    if (gmapLink && gmapLink.trim()) {
      const resolved = await resolveLatLngFromAnyLink(gmapLink.trim())
      if (!resolved) {
        // Try expand and parse as last resort
        const finalUrl = await expandShortLink(gmapLink.trim())
        if (finalUrl) {
          const parsed = parseLatLngFromGoogleMapsUrl(finalUrl)
          if (parsed) {
            latitude = parsed.lat
            longitude = parsed.lng
          }
        }
      } else {
        latitude = resolved.lat
        longitude = resolved.lng
      }
      if (latitude == null || longitude == null) {
        alert('Không đọc được tọa độ từ liên kết Google Maps. Vui lòng nhập liên kết hợp lệ hoặc xóa trường này để dùng vị trí hiện tại.')
        return
      }
    } else {
      // No link → fallback to current position
      try {
        const coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err)
          )
        })
        latitude = coords.latitude
        longitude = coords.longitude
      } catch (geoErr) {
        console.error('Không lấy được tọa độ:', geoErr)
        alert('Ứng dụng cần quyền truy cập vị trí để tiếp tục.')
        return
      }
    }

    try {
      setLoading(true)

      // Aggressive client-side compression
      const options = {
        maxSizeMB: 0.35,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        initialQuality: 0.65,
        fileType: 'image/jpeg',
      }
      let fileToUpload = imageFile
      try {
        const compressed = await imageCompression(imageFile, options)
        fileToUpload = compressed
      } catch (cmpErr) {
        console.warn('Nén ảnh thất bại, dùng ảnh gốc:', cmpErr)
      }

      const ext = fileToUpload.type.includes('jpeg') ? 'jpg' : (imageFile.name.split('.').pop() || 'jpg')
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('stores')
        .upload(fileName, fileToUpload, { contentType: fileToUpload.type })
      if (uploadError) {
        console.error(uploadError)
        alert('Lỗi khi upload ảnh')
        setLoading(false)
        return
      }

      // Store only the filename
      const imageUrl = fileName

      const nameSearch = removeVietnameseTones(normalizedName)

      const { error: insertError } = await supabase.from('stores').insert([
        {
          name: normalizedName,
          name_search: nameSearch,
          address,
          note,
          phone,
          image_url: imageUrl,
          latitude,
          longitude,
        },
      ])

      if (insertError) {
        console.error(insertError)
        await supabase.storage.from('stores').remove([fileName])
        alert('Lỗi khi lưu dữ liệu')
        setLoading(false)
        return
      }

      alert('Tạo cửa hàng thành công!')
      e.target.reset()
      setName('')
      setAddress('')
      setPhone('')
      setNote('')
      setImageFile(null)
      setGmapLink('')
    } catch (err) {
      console.error(err)
      alert('Đã xảy ra lỗi')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-black">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Vui lòng <Link href="/login" className="text-blue-600 underline">đăng nhập</Link> để tạo cửa hàng.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Thêm cửa hàng</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Nhập thông tin cửa hàng và tải ảnh đại diện.</p>

        <Card className="mt-6">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Tên cửa hàng</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Cửa hàng ABC" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="address">Địa chỉ</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={gmapResolving ? 'Đang lấy địa chỉ từ liên kết…' : (resolvingAddr ? 'Đang tự động lấy địa chỉ…' : 'Nhập địa chỉ hoặc bấm “Lấy lại” để tự điền')}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleFillAddress} disabled={resolvingAddr}>
                    {resolvingAddr ? 'Đang lấy…' : 'Lấy lại'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Bạn có thể chỉnh sửa địa chỉ trước khi lưu.</p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9+ ]*"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0901234567"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="note">Ghi chú</Label>
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú thêm (không bắt buộc)" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="gmap">Link Google Maps (không bắt buộc)</Label>
                <Input
                  id="gmap"
                  value={gmapLink}
                  onChange={(e) => setGmapLink(e.target.value)}
                  placeholder="Dán liên kết chia sẻ vị trí từ Google Maps (có dạng chứa @lat,lng hoặc q=lat,lng)"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {gmapResolving ? (
                    <span className="inline-flex items-center gap-2">
                      <span>Đang lấy địa chỉ từ liên kết…</span>
                      <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
                    </span>
                  ) : (
                    'Nếu nhập, hệ thống sẽ ưu tiên tọa độ từ liên kết và tự cập nhật địa chỉ.'
                  )}
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="image">Ảnh đại diện</Label>
                <Input id="image" type="file" accept="image/*;capture=camera" capture="environment" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={loading || gmapResolving} className="w-full">
                  {loading || gmapResolving ? 'Đang thêm…' : 'Thêm cửa hàng'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function expandShortLink(urlStr) {
  try {
    const res = await fetch('/api/expand-maps-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlStr }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.finalUrl || null
  } catch {
    return null
  }
}
