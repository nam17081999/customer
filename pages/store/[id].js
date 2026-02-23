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
import {
  cleanNominatimDisplayName,
  parseLatLngFromText,
  parseLatLngFromGoogleMapsUrl,
  extractSearchTextFromGoogleMapsUrl,
  geocodeTextToLatLngAddress,
} from '@/lib/createStoreUtils'
// browser-image-compression is dynamically imported at usage point to reduce bundle size
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'
import { invalidateStoreCache } from '@/lib/storeCache'

const StoreLocationPicker = dynamic(() => import('@/components/map/store-location-picker'), { ssr: false })

export default function StoreDetail() {
  const router = useRouter()
  const { id } = router.query

  const [store, setStore] = useState(null)
  const [notFound, setNotFound] = useState(false)
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
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
          return
        }
        setStore(data)
        setName(toTitleCaseVI(data.name || ''))
        setAddressDetail(data.address_detail || '')
        setWard(data.ward || '')
        setDistrict(data.district || '')
        setPhone(data.phone || '')
        setNote(data.note || '')
        setPickedLat(typeof data.latitude === 'number' ? data.latitude : null)
        setPickedLng(typeof data.longitude === 'number' ? data.longitude : null)
        setUserHasEditedMap(false)
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
          const { default: imageCompression } = await import('browser-image-compression')
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

      invalidateStoreCache()

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
        setAddressDetail(result)
      } else if (result?.cleaned) {
        setAddressDetail(result.cleaned)
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

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="px-3 sm:px-4 py-4 sm:py-6 max-w-screen-md mx-auto text-center space-y-4">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Không tìm thấy cửa hàng</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Cửa hàng này không tồn tại hoặc đã bị xóa.</p>
          <Button variant="outline" size="sm" onClick={() => router.push('/')}>Quay lại trang chủ</Button>
        </div>
      </div>
    )
  }

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

              {/* Map with controls inside */}
              <StoreLocationPicker
                initialLat={pickedLat}
                initialLng={pickedLng}
                onChange={handleLocationChange}
                editable={mapEditable}
                onToggleEditable={() => setMapEditable(v => !v)}
                showControls={true}
              />
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
