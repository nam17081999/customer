import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import Image from 'next/image'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { toTitleCaseVI } from '@/lib/utils'
import { getFullImageUrl } from '@/helper/imageUtils'
import imageCompression from 'browser-image-compression'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'

const LocationPicker = dynamic(() => import('@/components/map/location-picker'), { ssr: false })

export default function StoreDetail() {
  const router = useRouter()
  const { id } = router.query

  const [store, setStore] = useState(null)
  const [name, setName] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [ward, setWard] = useState('')
  const [district, setDistrict] = useState('')
  // unified message state
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  function showMessage(type, text, duration = 2000) {
    if (msgTimerRef.current) { clearTimeout(msgTimerRef.current); msgTimerRef.current = null }
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(() => { setMsgState((s) => ({ ...s, show: false })); msgTimerRef.current = null }, duration)
  }
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [gmapLink, setGmapLink] = useState('')
  const [gmapResolving, setGmapResolving] = useState(false)
  const [gmapStatus, setGmapStatus] = useState('') // 'success', 'error', 'processing'
  const [gmapMessage, setGmapMessage] = useState('')
  const lastParsedRef = useRef(null)
  const [showMapPicker, setShowMapPicker] = useState(true)
  const [pickedLat, setPickedLat] = useState(null)
  const [pickedLng, setPickedLng] = useState(null)
  const mapWrapperRef = useRef(null)
  const [mapEditable, setMapEditable] = useState(false)
  const [userHasEditedMap, setUserHasEditedMap] = useState(false)

  // stable handler for LocationPicker to avoid conditional hook calls and
  // ensure the same reference is passed across renders
  const handleLocationChange = useCallback((lat, lng) => {
    setPickedLat(lat)
    setPickedLng(lng)
    if (mapEditable) setUserHasEditedMap(true)
  }, [mapEditable])


  useEffect(() => {
    if (!id) return
    supabase
      .from('stores')
      .select('id,name,address_detail,ward,district,phone,note,image_url,latitude,longitude')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setStore(data)
        if (data) {
          setName(toTitleCaseVI(data.name || ''))
          setAddressDetail(data.address_detail || '')
          setWard(data.ward || '')
          setDistrict(data.district || '')
          setPhone(data.phone || '')
          setNote(data.note || '')
          setPickedLat(typeof data.latitude === 'number' ? data.latitude : null)
          setPickedLng(typeof data.longitude === 'number' ? data.longitude : null)
          setUserHasEditedMap(false)
        }
      })
  }, [id])

  function getImageFilenameFromUrl(url) {
    if (!url) return null;
    
    // If it's already just a filename, return as is
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url;
    }
    
    // Extract filename from ImageKit URL
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      return pathname.split('/').pop().split('?')[0]
    } catch {
      return null
    }
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
      
      // Pattern 4: lat,lng in pathname
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
    } catch { return null }
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

    // Step 3: Fallback: extract search text and geocode
    console.log('🔍 Trying text extraction...')
    const text = extractSearchTextFromGoogleMapsUrl(urlStr)
    if (text) {
      console.log('✅ Extracted text:', text)
      const geo = await geocodeTextToLatLngAddress(text)
      if (geo) {
        console.log('✅ Geocoding success:', { lat: geo.lat, lng: geo.lng })
        return { lat: geo.lat, lng: geo.lng }
      }
    }

    console.log('❌ All resolution methods failed')
    return null
  }

  async function reverseGeocodeFromLatLng(lat, lon) {
    try {
      console.log('🔄 Reverse geocoding coordinates:', { lat, lon })
      const latR = Number(lat.toFixed(5))
      const lonR = Number(lon.toFixed(5))
      const cacheKey = `revgeo:${latR},${lonR}`
      
      // Check cache first
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null
      if (cached) {
        console.log('✅ Found cached address:', cached)
        setAddressDetail(cached)
        return
      }
      
      // Make API call to get address
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latR}&lon=${lonR}&zoom=18&addressdetails=1&accept-language=vi`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Reverse geocoding failed')
      
      const data = await res.json()
      const text = data?.display_name || ''
      const cleaned = cleanNominatimDisplayName(text)
      
      if (cleaned) {
        console.log('✅ Reverse geocoded address:', cleaned)
        setAddressDetail(cleaned)
        // Cache the result
        try { 
          sessionStorage.setItem(cacheKey, cleaned) 
        } catch {}
      } else {
        console.log('⚠️ No address found from reverse geocoding')
      }
    } catch (e) {
      console.error('❌ Reverse geocode error:', e)
      setGmapStatus('error')
      setGmapMessage('Không lấy được địa chỉ từ tọa độ')
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
        console.log('🔍 Processing Google Maps link:', gmapLink.trim())
        
        // Step 1: Try to extract coordinates from the link
        let coordinates = null
        
        // First try direct parse
        const direct = parseLatLngFromGoogleMapsUrl(gmapLink.trim())
        if (direct) {
          coordinates = direct
          console.log('✅ Direct parse success:', coordinates)
        } else {
          // Try expand via API then parse
          const finalUrl = await expandShortLink(gmapLink.trim())
          if (finalUrl) {
            const parsed = parseLatLngFromGoogleMapsUrl(finalUrl)
            if (parsed) {
              coordinates = parsed
              console.log('✅ Parse from expanded URL success:', coordinates)
            }
          }
        }
        
        if (coordinates) {
          // Step 2: Got coordinates from link - now reverse geocode to get address
          const last = lastParsedRef.current
          if (!last || Math.abs(last.lat - coordinates.lat) > 1e-5 || Math.abs(last.lng - coordinates.lng) > 1e-5) {
            lastParsedRef.current = coordinates
            console.log('🔄 Reverse geocoding coordinates to address...')
            await reverseGeocodeFromLatLng(coordinates.lat, coordinates.lng)
            setGmapStatus('success')
            console.log('✅ Successfully updated address from coordinates')
          }
          return
        }
        
        // Step 3: Fallback - extract search text and geocode to get both coordinates and address
        console.log('🔍 Trying text extraction fallback...')
        const text = extractSearchTextFromGoogleMapsUrl(gmapLink.trim())
        if (text) {
          console.log('✅ Extracted text:', text)
          const geo = await geocodeTextToLatLngAddress(text)
          if (geo) {
            lastParsedRef.current = { lat: geo.lat, lng: geo.lng }
            console.log('✅ Geocoding success:', { lat: geo.lat, lng: geo.lng })
            if (geo.address) {
            setAddressDetail(geo.address)
              console.log('✅ Updated address:', geo.address)
            }
            setGmapStatus('success')
          } else {
            setGmapStatus('error')
            setGmapMessage('Không tìm thấy địa điểm từ liên kết')
          }
        } else {
          setGmapStatus('error')
          setGmapMessage('Không thể đọc được thông tin từ liên kết')
        }
      } catch (error) {
        console.error('❌ Google Maps link processing error:', error)
        setGmapStatus('error')
        setGmapMessage('Lỗi khi xử lý liên kết')
      } finally {
        setGmapResolving(false)
      }
    }, 400)
    
    return () => clearTimeout(t)
  }, [gmapLink])

  async function onSave(e) {
    e.preventDefault()
    if (resolvingAddr) {
      showMessage('info', 'Đang lấy vị trí, vui lòng đợi')
      return
    }
    if (!district) {
      showMessage('error', 'Vui lòng nhập quận/huyện')
      return
    }
    setSaving(true)

    const normalizedName = toTitleCaseVI(name.trim())

    // Determine coordinates: prefer link if provided; else prefer manually edited map coords,
    // then existing store coords, else geolocation
    let latitude = store?.latitude ?? null
    let longitude = store?.longitude ?? null

    if (gmapLink && gmapLink.trim()) {
      // User provided Google Maps link - prioritize coordinates from this link
      console.log('🔍 Processing Google Maps link for coordinates...')
      
      // Use coordinates that were already parsed and stored in lastParsedRef
      if (lastParsedRef.current) {
        latitude = lastParsedRef.current.lat
        longitude = lastParsedRef.current.lng
        console.log('✅ Using parsed coordinates from Maps link:', { latitude, longitude })
      } else {
        // Fallback: try to parse again if not already parsed
        const resolved = await resolveLatLngFromAnyLink(gmapLink.trim())
        if (resolved) {
          latitude = resolved.lat
          longitude = resolved.lng
          console.log('✅ Got coordinates from Maps link (fallback):', { latitude, longitude })
        } else {
          // Link processing failed
          setSaving(false)
          setGmapStatus('error')
          setGmapMessage('Không đọc được tọa độ từ liên kết Maps')
          return
        }
      }
    } else if (userHasEditedMap && typeof pickedLat === 'number' && typeof pickedLng === 'number') {
      // Use position only if user manually adjusted map
      latitude = pickedLat
      longitude = pickedLng
    } else if (!latitude || !longitude) {
      // No Maps link and no existing coordinates → use current geolocation as fallback
      try {
        console.log('📍 No Maps link or picked coords, getting current location...')
        const coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err)
          )
        })
        latitude = coords.latitude
        longitude = coords.longitude
        console.log('✅ Got current location:', { latitude, longitude })
      } catch (geoErr) {
        console.error('❌ Cannot get current location:', geoErr)
        setSaving(false)
        showMessage('error', 'Không thể lấy vị trí GPS. Vui lòng bật GPS và cấp quyền hoặc dùng link Google Maps')
        return
      }
    }
    // If we have existing coordinates and no Maps link, keep the existing ones

    // Final validation: Ensure we have valid coordinates
    if (latitude == null || longitude == null || !isFinite(latitude) || !isFinite(longitude)) {
      setSaving(false)
      showMessage('error', 'Thiếu thông tin vị trí. Vị trí cửa hàng chưa được xác định. Vui lòng dán link Google Maps hoặc mở khóa bản đồ và chọn vị trí')
      return
    }
    let image_url = store?.image_url || null
    let uploadedFileId = null

    try {
      if (imageFile) {
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
        image_url = uploadResult.name // Store filename
        uploadedFileId = uploadResult.fileId
      }

      // compute normalized search name when updating
      const name_search = removeVietnameseTones(normalizedName)

    const normalizedDetail = toTitleCaseVI(addressDetail.trim())
    const normalizedWard = toTitleCaseVI(ward.trim())
    const normalizedDistrict = toTitleCaseVI(district.trim())
    const { error: updateErr } = await supabase
      .from('stores')
      .update({
        name: normalizedName,
        name_search,
        address_detail: normalizedDetail,
        ward: normalizedWard,
        district: normalizedDistrict,
        phone,
        note,
        image_url,
        latitude,
        longitude
      })
      .eq('id', id)
      if (updateErr) throw updateErr

      // Optional cleanup: delete old image if replaced
      if (imageFile && store?.image_url) {
        const oldFilename = store.image_url
        if (oldFilename) {
          try {
            await fetch('/api/upload-image', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: oldFilename }),
            })
          } catch (deleteErr) {
            console.warn('Could not delete old image:', deleteErr)
          }
        }
      }

      showMessage('success', 'Đã lưu')
      router.push('/')
    } catch (err) {
      console.error(err)
      // Rollback new upload if DB update failed
      if (uploadedFileId) {
        try {
          await fetch('/api/upload-image', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: uploadedFileId }),
          })
        } catch (deleteErr) {
          console.warn('Could not delete uploaded image on rollback:', deleteErr)
        }
      }
      showMessage('error', 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

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

  async function handleFillAddress() {
    try {
      setResolvingAddr(true)

      // Create a timeout promise that will reject after 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      })

      // Race between getting location and timeout
      const fillAddressPromise = (async () => {
        const coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err)
          )
        })
        // Cache by rounded coordinates in sessionStorage to cut repeat hits
        const lat = Number(coords.latitude.toFixed(5))
        const lon = Number(coords.longitude.toFixed(5))
        const cacheKey = `revgeo:${lat},${lon}`
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null
        if (cached) {
          return cached
        }
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=vi`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Reverse geocoding failed')
        const data = await res.json()
        const text = data?.display_name || ''
        const cleaned = cleanNominatimDisplayName(text)
        return { cleaned, cacheKey }
      })()

      const result = await Promise.race([fillAddressPromise, timeoutPromise])

      if (typeof result === 'string') {
        // Cached result
        setAddress(result)
      } else if (result?.cleaned) {
        setAddress(result.cleaned)
        try { sessionStorage.setItem(result.cacheKey, result.cleaned) } catch {}
      } else {
        showMessage('error', 'Không lấy được địa chỉ từ Nominatim')
      }
    } catch (err) {
      console.error('Auto fill address error:', err)

      if (err.message === 'TIMEOUT') {
        showMessage('error', 'Lấy địa chỉ tự động quá lâu (>5s). Vui lòng thử lại hoặc nhập thủ công.')
      } else {
        showMessage('error', 'Không lấy được địa chỉ. Vui lòng cấp quyền định vị cho trang này và thử lại.')
      }
    } finally {
      setResolvingAddr(false)
    }
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
    } catch { return null }
  }

  useEffect(() => {
    if (showMapPicker && mapWrapperRef.current) {
      try { mapWrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (e) {}
    }
  }, [showMapPicker])

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="px-3 sm:px-4 py-4 sm:py-6 max-w-screen-md mx-auto">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">Đang tải...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
      <FullPageLoading visible={saving || gmapResolving || resolvingAddr} message={saving ? 'Đang lưu thay đổi…' : gmapResolving ? 'Đang phân tích liên kết…' : 'Đang lấy vị trí…'} />
      <div className="px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-screen-md mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chỉnh sửa cửa hàng</h1>
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Quay lại</Button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Phần 1: Thông tin cửa hàng</h2>
          <div className="space-y-1.5">
            <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ảnh hiện tại</Label>
            <Dialog>
              <DialogTrigger asChild>
                <Image src={getFullImageUrl(store.image_url)} alt={store.name} width={96} height={96} sizes="96px" quality={70} className="h-24 w-24 cursor-zoom-in rounded object-cover ring-1 ring-gray-200 dark:ring-gray-800" />
              </DialogTrigger>
              <DialogContent className="overflow-hidden p-0">
                <Image src={getFullImageUrl(store.image_url)} alt={store.name} width={800} height={800} className="max-h-[80vh] w-auto object-contain" />
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-1.5">
            <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Địa chỉ</Label>
            <div className="grid gap-2">
              <Input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                onBlur={() => { if (district) setDistrict(toTitleCaseVI(district.trim())) }}
                disabled={false}
                className="text-sm"
                placeholder="Quận / Huyện"
              />
              <Input
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                onBlur={() => { if (ward) setWard(toTitleCaseVI(ward.trim())) }}
                disabled={false}
                className="text-sm"
                placeholder="Xã / Phường"
              />
              <Input
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                onBlur={() => { if (addressDetail) setAddressDetail(toTitleCaseVI(addressDetail.trim())) }}
                disabled={false}
                className="text-sm"
                placeholder="Địa chỉ cụ thể (số nhà, đường, thôn/xóm/đội...)"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Số điện thoại</Label>
            <Input
              type="tel"
              inputMode="numeric"
              pattern="[0-9+ ]*"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={false}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ghi chú</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Đổi ảnh (tùy chọn)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Link Google Maps (không bắt buộc)</Label>
            <Input
              value={gmapLink}
              onChange={(e) => setGmapLink(e.target.value)}
              placeholder="Dán liên kết chia sẻ vị trí từ Google Maps"
              disabled={false}
              className={`text-sm ${gmapStatus === 'error' ? 'border-red-500' : gmapStatus === 'success' ? 'border-green-500' : ''}`}
            />
            {gmapMessage && gmapStatus === 'error' && (
              <div className="text-xs text-red-600">
                {gmapMessage}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">{gmapResolving ? (
              <span className="inline-flex items-center gap-2">
                  <span>Đang lấy địa chỉ từ liên kết…</span>
                  <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
                </span>
              ) : 'Nếu nhập, sẽ ưu tiên tọa độ và tự cập nhật địa chỉ từ liên kết.'}</p>
            </div>
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 pt-2">Phần 2: Bản đồ</h2>
            {/* Always-visible map picker */}
            <div className="space-y-1.5">
              <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Vị trí trên bản đồ</Label>

              {/* Map controls - above map */}
              <div className="flex items-center justify-end py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  size="sm"
                  variant={mapEditable ? "default" : "outline"}
                  onClick={() => setMapEditable(v => !v)}
                  className="text-xs flex items-center gap-1.5 h-8"
                >
                  {mapEditable ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Khóa lại
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      Mở khóa để chỉnh
                    </>
                  )}
                </Button>
              </div>

              {/* Map with overlay badges */}
              <div className="relative">
                {/* Position status badge - top left inside map */}
                {pickedLat && pickedLng ? (
                  <div className="absolute top-2 left-2 z-[1000] bg-green-600 text-white px-2 py-1 rounded-md shadow-lg flex items-center gap-1 text-xs font-medium pointer-events-none">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Đã có vị trí
                  </div>
                ) : (
                  <div className="absolute top-2 left-2 z-[1000] bg-orange-600 text-white px-2 py-1 rounded-md shadow-lg flex items-center gap-1 text-xs font-medium pointer-events-none">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Chưa có vị trí
                  </div>
                )}

                {/* Lock status badge - top right inside map */}
                {mapEditable ? (
                  <div className="absolute top-2 right-2 z-[1000] bg-orange-600 text-white px-2 py-1 rounded-md shadow-lg flex items-center gap-1 text-xs font-medium pointer-events-none">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Đang mở khóa
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 z-[1000] bg-gray-700 text-white px-2 py-1 rounded-md shadow-lg flex items-center gap-1 text-xs font-medium pointer-events-none">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Đã khóa
                  </div>
                )}

                <LocationPicker
                  initialLat={pickedLat}
                  initialLng={pickedLng}
                  onChange={handleLocationChange}
                  className="rounded-md overflow-hidden"
                  editable={mapEditable}
                  onToggleEditable={() => setMapEditable(v => !v)}
                />
              </div>
            </div>

          <div className="pt-2">
            <Button type="submit" disabled={saving || gmapResolving || resolvingAddr} className="w-full text-sm sm:text-base">
              {(saving || gmapResolving || resolvingAddr) ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
