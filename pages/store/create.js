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
import { toTitleCaseVI } from '@/lib/utils'
import imageCompression from 'browser-image-compression'

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
  const [gmapStatus, setGmapStatus] = useState('') // 'success', 'error', 'processing'
  const [gmapMessage, setGmapMessage] = useState('')
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
      console.log('🔍 Parsing text for coordinates:', decoded)
      
      // Pattern 1: @lat,lng,zoom (most common)
      let m = decoded.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          console.log('✅ Found @lat,lng pattern:', { lat, lng })
          return { lat, lng }
        }
      }
      
      // Pattern 2: !3dlat!4dlng (Google deep params)
      m = decoded.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          console.log('✅ Found !3d!4d pattern:', { lat, lng })
          return { lat, lng }
        }
      }
      
      // Pattern 3: lat,lng separated by comma or %2C
      m = decoded.match(/(-?\d{1,2}\.\d+)\s*(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          console.log('✅ Found lat,lng pattern:', { lat, lng })
          return { lat, lng }
        }
      }
      
      // Pattern 4: lat,lng with space separator
      m = decoded.match(/(-?\d{1,2}\.\d+)\s+(-?\d{1,3}\.\d+)/i)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          console.log('✅ Found lat lng pattern:', { lat, lng })
          return { lat, lng }
        }
      }
      
      // Pattern 5: lat,lng in parentheses
      m = decoded.match(/\((-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)\)/i)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          console.log('✅ Found (lat,lng) pattern:', { lat, lng })
          return { lat, lng }
        }
      }
      
      console.log('❌ No coordinate patterns found in text')
      return null
    } catch (error) {
      console.log('❌ Text parsing error:', error)
      return null
    }
  }

  function parseLatLngFromGoogleMapsUrl(input) {
    if (!input) return null
    let urlStr = input.trim()
    if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
    
    console.log('🔍 Parsing URL:', urlStr)
    
    try {
      const u = new URL(urlStr)
      
      // Pattern 1: @lat,lng,zoom (most common in shared links)
      let m = urlStr.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          console.log('✅ Found coordinates via @pattern:', { lat, lng })
          return { lat, lng }
        }
      }
      
      // Pattern 2: !3dlat!4dlng (Google deep params)
      m = urlStr.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/)
      if (m) {
        const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          console.log('✅ Found coordinates via !3d!4d pattern:', { lat, lng })
          return { lat, lng }
        }
      }
      
      // Pattern 3: lat,lng in query params
      const candParams = ['destination', 'q', 'query', 'll', 'saddr', 'daddr', 'center']
      for (const key of candParams) {
        const val = u.searchParams.get(key)
        if (val) {
          console.log(`🔍 Checking param ${key}:`, val)
          const got = parseLatLngFromText(val)
          if (got) {
            console.log('✅ Found coordinates in param', key, ':', got)
            return got
          }
        }
      }
      
      // Pattern 4: lat,lng in pathname (for some Google Maps URLs)
      const fromPath = parseLatLngFromText(u.pathname)
      if (fromPath) {
        console.log('✅ Found coordinates in pathname:', fromPath)
        return fromPath
      }
      
      // Pattern 5: lat,lng in hash fragment
      const fromHash = parseLatLngFromText(u.hash)
      if (fromHash) {
        console.log('✅ Found coordinates in hash:', fromHash)
        return fromHash
      }
      
      // Pattern 6: Check for coordinates in the entire URL string
      const fromHref = parseLatLngFromText(u.href)
      if (fromHref) {
        console.log('✅ Found coordinates in full URL:', fromHref)
        return fromHref
      }
      
      console.log('❌ No coordinates found in URL')
      return null
    } catch (error) {
      console.log('❌ URL parsing error:', error)
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
      
      // Try query parameters first
      const qParams = ['q', 'query', 'destination']
      for (const k of qParams) {
        const v = u.searchParams.get(k)
        if (v) {
          const decoded = decodeURIComponent(v.replace(/\+/g, ' '))
          // Skip if it looks like coordinates
          if (!/^-?\d+\.\d+/.test(decoded)) {
            return decoded
          }
        }
      }
      
      // Try /place/<name>/... → take the segment after /place/
      const parts = u.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex((p) => p.toLowerCase() === 'place')
      if (idx !== -1 && parts[idx + 1]) {
        return decodeURIComponent(parts[idx + 1].replace(/\+/g, ' '))
      }
      
      // Try /search/<name>/... → take the segment after /search/
      const searchIdx = parts.findIndex((p) => p.toLowerCase() === 'search')
      if (searchIdx !== -1 && parts[searchIdx + 1]) {
        return decodeURIComponent(parts[searchIdx + 1].replace(/\+/g, ' '))
      }
      
      return null
    } catch {
      return null
    }
  }

  async function geocodeWithGoogle(address) {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        console.log('⚠️ Google Maps API key not configured, falling back to Nominatim')
        return await geocodeTextToLatLngAddress(address)
      }
      
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=vi&region=vn`
      const res = await fetch(url)
      
      if (!res.ok) throw new Error('Google Geocoding API error')
      
      const data = await res.json()
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0]
        const { lat, lng } = result.geometry.location
        const formattedAddress = result.formatted_address
        
        console.log('✅ Google Geocoding success:', { lat, lng, address: formattedAddress })
        return { lat, lng, address: formattedAddress }
      }
      
      console.log('❌ Google Geocoding no results:', data.status)
      return null
    } catch (error) {
      console.error('❌ Google Geocoding error:', error)
      // Fallback to Nominatim
      return await geocodeTextToLatLngAddress(address)
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
    if (!input || !input.trim()) return null
    
    const urlStr = input.trim()
    console.log('🔍 Resolving coordinates from:', urlStr)
    
    // Step 1: Try direct parse first
    const direct = parseLatLngFromGoogleMapsUrl(urlStr)
    if (direct) {
      console.log('✅ Direct parse success:', direct)
      return direct
    }

    // Step 2: Try following redirect to expand short link and parse final URL
    try {
      let fullUrl = urlStr
      if (!/^https?:\/\//i.test(fullUrl)) fullUrl = `https://${fullUrl}`
      
      console.log('🔄 Expanding short link...')
      const finalUrl = await expandShortLink(fullUrl)
      if (finalUrl && finalUrl !== fullUrl) {
        console.log('✅ Expanded to:', finalUrl)
        const parsed = parseLatLngFromGoogleMapsUrl(finalUrl)
        if (parsed) {
          console.log('✅ Parse from expanded URL success:', parsed)
          return parsed
        }
      }
    } catch (error) {
      console.log('❌ Link expansion failed:', error)
    }

    // Step 3: Fallback: extract search text and use Google Geocoding
    console.log('🔍 Trying text extraction with Google Geocoding...')
    const text = extractSearchTextFromGoogleMapsUrl(urlStr)
    if (text) {
      console.log('✅ Extracted text:', text)
      const geo = await geocodeWithGoogle(text)
      if (geo) {
        console.log('✅ Google Geocoding success:', { lat: geo.lat, lng: geo.lng })
        return { lat: geo.lat, lng: geo.lng }
      }
    }

    console.log('❌ All resolution methods failed')
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
    if (!gmapLink || !gmapLink.trim()) {
      setGmapStatus('')
      setGmapMessage('')
      return
    }
    
    const t = setTimeout(async () => {
      setGmapResolving(true)
      setGmapStatus('processing')
      
      try {
        // First try direct parse
        const direct = parseLatLngFromGoogleMapsUrl(gmapLink.trim())
        if (direct) {
          const last = lastParsedRef.current
          if (!last || Math.abs(last.lat - direct.lat) > 1e-5 || Math.abs(last.lng - direct.lng) > 1e-5) {
            lastParsedRef.current = direct
            await reverseGeocodeFromLatLng(direct.lat, direct.lng)
            setGmapStatus('success')
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
            setGmapStatus('success')
            return
          }
        }
        
        // Fallback to Google Geocoding
        const text = extractSearchTextFromGoogleMapsUrl(gmapLink.trim())
        if (text) {
          const geo = await geocodeWithGoogle(text)
          if (geo) {
            lastParsedRef.current = { lat: geo.lat, lng: geo.lng }
            if (geo.address) {
              setAddress(geo.address)
              setGmapStatus('success')
              setGmapMessage('✅ Lấy được vị trí từ Google Geocoding')
            } else {
              setGmapStatus('success')
              setGmapMessage('✅ Lấy được tọa độ từ Google Geocoding')
            }
          } else {
            setGmapStatus('error')
            setGmapMessage('Không tìm thấy địa điểm')
          }
        } else {
          setGmapStatus('error')
          setGmapMessage('Không thể đọc được thông tin từ liên kết')
        }
      } catch (error) {
        console.error('Google Maps link processing error:', error)
        setGmapStatus('error')
        setGmapMessage('Lỗi khi xử lý liên kết')
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
      setLoading(true)
      
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
        setLoading(false)
        setGmapStatus('error')
        setGmapMessage('Không đọc được tọa độ từ liên kết')
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
        setLoading(false)
        setGmapStatus('error')
        setGmapMessage('Cần quyền truy cập vị trí')
        return
      }
    }

    try {
      setLoading(true)

      // Nén ảnh với cài đặt vừa phải hơn để giữ chất lượng
      const options = {
        maxSizeMB: 1, // Tăng từ 0.35 lên 1MB
        maxWidthOrHeight: 1600, // Tăng từ 1024 lên 1600px
        useWebWorker: true,
        initialQuality: 0.8, // Tăng từ 0.65 lên 0.8
        fileType: 'image/jpeg',
      }
      let fileToUpload = imageFile
      try {
        const compressed = await imageCompression(imageFile, options)
        fileToUpload = compressed
      } catch (cmpErr) {
        console.warn('Nén ảnh thất bại, dùng ảnh gốc:', cmpErr)
      }

      // Upload lên ImageKit
      const formData = new FormData()
      formData.append('file', fileToUpload)
      formData.append('fileName', `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.jpg`)
      formData.append('useUniqueFileName', 'true')

      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload ảnh thất bại')
      }

      const uploadResult = await uploadResponse.json()
      
      // Lưu tên file vào database 
      const imageFilename = uploadResult.name

      const nameSearch = removeVietnameseTones(normalizedName)

      const { error: insertError } = await supabase.from('stores').insert([
        {
          name: normalizedName,
          name_search: nameSearch,
          address,
          note,
          phone,
          image_url: imageFilename, // Store only filename
          latitude,
          longitude,
        },
      ])

      if (insertError) {
        console.error(insertError)
        // Try to delete uploaded image on error
        try {
          await fetch('/api/upload-image', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: uploadResult.fileId }),
          })
        } catch (deleteErr) {
          console.warn('Could not delete uploaded image:', deleteErr)
        }
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
      setGmapStatus('')
      setGmapMessage('')
    } catch (err) {
      console.error(err)
      alert('Đã xảy ra lỗi')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 px-3 sm:px-4 py-8 dark:bg-black">
        <div className="mx-auto max-w-screen-md w-full">
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
    <div className="min-h-screen bg-gray-50 px-3 sm:px-4 py-8 dark:bg-black">
      <div className="mx-auto max-w-screen-md w-full">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Thêm cửa hàng</h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nhập thông tin cửa hàng và tải ảnh đại diện.</p>
        <Card className="mt-5 sm:mt-6">
          <CardContent className="p-5 sm:p-6">
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
                    placeholder={gmapResolving ? 'Đang lấy địa chỉ...' : (resolvingAddr ? 'Đang lấy địa chỉ...' : 'Nhập địa chỉ')}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleFillAddress} disabled={resolvingAddr}>
                    {resolvingAddr ? 'Đang lấy…' : 'Lấy lại'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Có thể chỉnh sửa địa chỉ trước khi lưu.</p>
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
                  placeholder="Dán liên kết Google Maps"
                  className={gmapStatus === 'error' ? 'border-red-500' : gmapStatus === 'success' ? 'border-green-500' : ''}
                />
                {gmapMessage && gmapStatus === 'error' && (
                  <div className="text-xs text-red-600">
                    {gmapMessage}
                  </div>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="image">Ảnh đại diện</Label>
                <Input id="image" type="file" accept="image/*;capture=camera" capture="environment" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={loading || gmapResolving} className="w-full text-sm sm:text-base">
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
    console.log('🔄 Expanding short link:', urlStr)
    
    const res = await fetch('/api/expand-maps-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlStr }),
    })
    
    if (!res.ok) {
      console.log('❌ API error:', res.status, res.statusText)
      return null
    }
    
    const data = await res.json()
    console.log('✅ API response:', data)
    
    if (data?.finalUrl && data.finalUrl !== urlStr) {
      console.log('✅ Successfully expanded:', urlStr, '→', data.finalUrl)
      return data.finalUrl
    } else {
      console.log('⚠️ No expansion needed or failed')
      return null
    }
  } catch (error) {
    console.log('❌ Expand link error:', error)
    return null
  }
}
