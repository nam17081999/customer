import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-context'
import Link from 'next/link'
import { toTitleCaseVI } from '@/lib/utils'
import imageCompression from 'browser-image-compression'
import { Msg } from '@/components/ui/msg'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import {
  cleanNominatimDisplayName,
  parseLatLngFromGoogleMapsUrl,
  extractSearchTextFromGoogleMapsUrl,
  resolveLatLngFromAnyLink,
  reverseGeocodeFromLatLng,
  setExpandShortLink
} from '@/lib/createStoreUtils'

export default function AddStore() {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  // unified message state
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  function showMessage(type, text, duration = 2500) {
    if (msgTimerRef.current) { clearTimeout(msgTimerRef.current); msgTimerRef.current = null }
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(() => { setMsgState((s) => ({ ...s, show: false })); msgTimerRef.current = null }, duration)
  }
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [gmapLink, setGmapLink] = useState('')
  const [gmapResolving, setGmapResolving] = useState(false)
  const [gmapStatus, setGmapStatus] = useState('') // 'success', 'error', 'processing'
  const [gmapMessage, setGmapMessage] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // 1 = Store Info, 2 = Location

  // Map states
  const [pickedLat, setPickedLat] = useState(null)
  const [pickedLng, setPickedLng] = useState(null)
  const [mapEditable, setMapEditable] = useState(false)
  const [userHasEditedMap, setUserHasEditedMap] = useState(false) // Track if user manually edited map
  const [initialGPSLat, setInitialGPSLat] = useState(null) // Store initial GPS position
  const [initialGPSLng, setInitialGPSLng] = useState(null)
  const [heading, setHeading] = useState(null) // Store compass heading for map rotation
  const mapWrapperRef = useRef(null)

  // Dynamically import LocationPicker (client-side only)
  const LocationPicker = dynamic(() => import('@/components/map/location-picker'), { ssr: false })

  // Stable handler for LocationPicker - track manual edits
  const handleLocationChange = useCallback((lat, lng) => {
    setPickedLat(lat)
    setPickedLng(lng)
    // If map is editable and user is dragging, mark as manually edited
    if (mapEditable) {
      setUserHasEditedMap(true)
    }
  }, [mapEditable])
  const lastParsedRef = useRef(null)
  const parseTimerRef = useRef(null)
  const nameAutoFillRef = useRef({ filled: false, link: null })

  // Improved GPS location with progressive timeout and maxWaitTime
  async function getBestPosition({
    attempts = 4,
    timeout = 5000,        // Giảm từ 10s → 5s
    maxWaitTime = 10000,   // Tổng thời gian tối đa 10s
    desiredAccuracy = 25   // Mục tiêu 25m
  } = {}) {
    if (!navigator.geolocation) throw new Error('Geolocation not supported')

    const samples = []
    const startTime = Date.now()

    // Try to get cached position first (< 30 seconds old)
    try {
      const cached = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true, // Changed to true to get heading
            timeout: 1000,
            maximumAge: 30000 // Accept 30s old
          }
        )
      })
      if (cached?.coords?.accuracy && cached.coords.accuracy <= desiredAccuracy * 1.5) {
        console.log('✅ Dùng vị trí cache:', cached.coords.accuracy + 'm')
        return cached.coords
      }
    } catch (err) {
      // No cache, continue to get fresh location
    }

    for (let i = 0; i < attempts; i++) {
      // Check total elapsed time
      const elapsed = Date.now() - startTime
      if (elapsed > maxWaitTime) {
        console.log('⏱️ Đã hết thời gian chờ tối đa:', elapsed + 'ms')
        break
      }

      try {
        // Progressive timeout: 5s → 4s → 3s → 2s
        const dynamicTimeout = Math.max(2000, timeout - (i * 1000))
        const remainingTime = maxWaitTime - elapsed
        const actualTimeout = Math.min(dynamicTimeout, remainingTime)

        if (actualTimeout < 1000) break // Too little time left

        const pos = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Timeout')), actualTimeout)
          navigator.geolocation.getCurrentPosition(
            (result) => {
              clearTimeout(timeoutId)
              resolve(result)
            },
            (err) => {
              clearTimeout(timeoutId)
              reject(err)
            },
            {
              enableHighAccuracy: true,
              timeout: actualTimeout,
              maximumAge: 0
            }
          )
        })

        if (pos?.coords) {
          samples.push(pos.coords)
          console.log(`📍 Sample ${i+1}: ${pos.coords.accuracy?.toFixed(1) || '?'}m, heading: ${pos.coords.heading || 'N/A'} (${Date.now() - startTime}ms)`)

          // Early exit if good enough
          if (pos.coords.accuracy && pos.coords.accuracy <= desiredAccuracy) {
            console.log('✅ Đạt độ chính xác mong muốn')
            return pos.coords
          }
        }
      } catch (err) {
        console.warn(`⚠️ Attempt ${i+1} failed:`, err.message)
      }
    }

    if (samples.length === 0) {
      throw new Error('Không lấy được vị trí sau nhiều lần thử')
    }

    // Return best sample
    samples.sort((a, b) => (a.accuracy || Infinity) - (b.accuracy || Infinity))
    console.log(`📊 Chọn sample tốt nhất: ${samples[0].accuracy?.toFixed(1) || '?'}m`)
    return samples[0]
  }

  useEffect(() => {
    if (!user) return
    const qName = typeof router.query.name === 'string' ? router.query.name.trim() : ''
    if (qName) setName(toTitleCaseVI(qName))
  }, [user, router.query.name])

  // Auto-fetch location when entering step 2
  useEffect(() => {
    if (currentStep === 2 && !pickedLat && !pickedLng && !resolvingAddr) {
      handleFillAddress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  async function handleFillAddress() {
    try {
      setResolvingAddr(true)

      // Get GPS coordinates with improved logic
      const coords = await getBestPosition({
        attempts: 3,           // Giảm từ 4 → 3
        timeout: 4000,         // 4s thay vì 10s
        maxWaitTime: 8000,     // Tổng tối đa 8s
        desiredAccuracy: 25
      })

      // Save as initial GPS position (reference for submit)
      setInitialGPSLat(coords.latitude)
      setInitialGPSLng(coords.longitude)

      // Update map display
      setPickedLat(coords.latitude)
      setPickedLng(coords.longitude)

      // Save heading/bearing if available for map rotation
      if (coords.heading !== null && coords.heading !== undefined && !isNaN(coords.heading)) {
        setHeading(coords.heading)
        console.log('📍 Heading:', coords.heading)
      }

      // Don't auto-fill address anymore - user must enter manually
    } catch (err) {
      console.error('Get location error:', err)
      showMessage('error', 'Không lấy được vị trí GPS. Vui lòng bật GPS và cấp quyền.')
    } finally {
      setResolvingAddr(false)
    }
  }

  // Paste Google Maps link from clipboard
  async function handlePasteGmap() {
    try {
      if (!navigator.clipboard?.readText) {
        showMessage('error', 'Trình duyệt không hỗ trợ đọc clipboard')
        return
      }
      const text = (await navigator.clipboard.readText()).trim()
      if (!text) {
        showMessage('info', 'Clipboard trống')
        return
      }
      setGmapLink(text)
    } catch (e) {
      console.warn('Clipboard read error:', e)
      showMessage('error', 'Không đọc được clipboard. Hãy dán thủ công (Cmd+V).')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) {
      showMessage('error', 'Vui lòng đăng nhập để tạo cửa hàng')
      return
    }

    if (!name || !address || !imageFile) {
      showMessage('error', 'Tên, địa chỉ và ảnh là bắt buộc')
      return
    }

    // Normalize name to Title Case before saving
    const normalizedName = toTitleCaseVI(name.trim())

    // NEW LOGIC: Determine coordinates based on user actions
    // Priority:
    // 1. If user unlocked map and edited → use edited position (pickedLat/Lng)
    // 2. If Google Maps link provided → use link coordinates
    // 3. Otherwise → use initial GPS position (initialGPSLat/Lng)
    let latitude = null
    let longitude = null

    if (gmapLink && gmapLink.trim()) {
      // Google Maps link has highest priority - auto set position
      setLoading(true)
      const resolved = await resolveLatLngFromAnyLink(gmapLink.trim())
      if (!resolved) {
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
    } else if (userHasEditedMap && pickedLat != null && pickedLng != null) {
      // User unlocked and edited map → use edited position
      latitude = pickedLat
      longitude = pickedLng
      console.log('✅ Using edited map position:', { latitude, longitude })
    } else if (initialGPSLat != null && initialGPSLng != null) {
      // User did NOT edit map → use initial GPS
      latitude = initialGPSLat
      longitude = initialGPSLng
      console.log('✅ Using initial GPS position:', { latitude, longitude })
    } else if (pickedLat != null && pickedLng != null) {
      // Fallback: use whatever is on map
      latitude = pickedLat
      longitude = pickedLng
    } else {
      // Last resort: get current GPS
      try {
        const coords = await getBestPosition({ attempts: 4, timeout: 10000, desiredAccuracy: 25 })
        latitude = coords.latitude
        longitude = coords.longitude
      } catch (geoErr) {
        console.error('Không lấy được tọa độ:', geoErr)
        setLoading(false)
        showMessage('error', 'Không thể lấy vị trí GPS. Vui lòng cấp quyền định vị hoặc dùng link Google Maps')
        return
      }
    }

    // Final validation: Ensure we have valid coordinates
    if (latitude == null || longitude == null || !isFinite(latitude) || !isFinite(longitude)) {
      setLoading(false)
      showMessage('error', 'Thiếu thông tin vị trí. Vui lòng bật "Địa chỉ tự động" hoặc dán link Google Maps hoặc mở khóa bản đồ và chọn vị trí')
      return
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

      // Chuẩn hoá địa chỉ: nếu toàn bộ ở dạng lowercase hoặc uppercase thì chuyển sang dạng viết hoa chữ cái đầu mỗi từ
      let finalAddress = address.trim()
      if (finalAddress && (finalAddress === finalAddress.toLowerCase() || finalAddress === finalAddress.toUpperCase())) {
        finalAddress = toTitleCaseVI(finalAddress.toLowerCase())
        if (finalAddress !== address) setAddress(finalAddress)
      }

      const { error: insertError } = await supabase.from('stores').insert([
        {
          name: normalizedName,
          name_search: nameSearch,
          address: finalAddress,
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
        showMessage('error', 'Lỗi khi lưu dữ liệu')
        setLoading(false)
        return
      }

      // Success
      showMessage('success', 'Lưu thành công', 2500)
      e.target.reset()
      setName('')
      setAddress('')
      setPhone('')
      setNote('')
      setImageFile(null)
      setGmapLink('')
      setGmapStatus('')
      setGmapMessage('')
      // Reset map states
      setPickedLat(null)
      setPickedLng(null)
      setMapEditable(false)
      setUserHasEditedMap(false)
      setInitialGPSLat(null)
      setInitialGPSLng(null)
      // Reset to step 1
      setCurrentStep(1)
      // Clear ?name from URL so it does not persist on next visit
      if (router.query?.name) {
        try {
          const { name: _discard, ...rest } = router.query
          router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
        } catch {
          router.replace(router.pathname)
        }
      }
    } catch (err) {
      console.error(err)
      showMessage('error', 'Đã xảy ra lỗi khi tạo cửa hàng')
    } finally {
      setLoading(false)
    }
  }

  // Debounced parsing of Google Maps link
  useEffect(() => {
    if (!gmapLink) {
      setGmapStatus('')
      setGmapMessage('')
      return
    }
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current)
    parseTimerRef.current = setTimeout(async () => {
      const current = gmapLink.trim()
      if (!current) return
      // Auto-fill name only once per distinct link if input currently empty
      if (!name.trim() && (!nameAutoFillRef.current.filled || nameAutoFillRef.current.link !== current)) {
        try {
          const possibleName = extractSearchTextFromGoogleMapsUrl(current)
          if (possibleName) {
            setName(toTitleCaseVI(possibleName))
            nameAutoFillRef.current = { filled: true, link: current }
          }
        } catch { }
      }
      if (lastParsedRef.current === current) return
      lastParsedRef.current = current
      setGmapResolving(true)
      setGmapStatus('processing')
      setGmapMessage('Đang đọc link…')
      try {
        const coords = await resolveLatLngFromAnyLink(current)
        if (coords) {
          setGmapStatus('success')
          setGmapMessage(`Tọa độ: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
          // Update map coordinates and mark as link-based (will be used for submit)
          setPickedLat(coords.lat)
          setPickedLng(coords.lng)
          // When link is provided, we'll use these coordinates (handled in submit logic)
          try { await reverseGeocodeFromLatLng(coords.lat, coords.lng, setAddress) } catch { }
        } else {
          setGmapStatus('error')
          setGmapMessage('Không trích xuất được tọa độ từ link')
        }
      } catch (err) {
        console.warn('Parse gmap link error', err)
        setGmapStatus('error')
        setGmapMessage('Lỗi khi xử lý link')
      } finally {
        setGmapResolving(false)
      }
    }, 400)
    return () => { if (parseTimerRef.current) clearTimeout(parseTimerRef.current) }
  }, [gmapLink, name])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="px-3 sm:px-4 py-4 sm:py-6 max-w-screen-md mx-auto">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-900/40 rounded-md p-6">
            Vui lòng <Link href="/login" className="text-blue-600 underline">đăng nhập</Link> để tạo cửa hàng.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
      <FullPageLoading visible={loading || resolvingAddr || gmapResolving} message={loading ? 'Đang tạo cửa hàng…' : resolvingAddr ? 'Đang lấy vị trí…' : 'Đang xử lý liên kết…'} />
      <div className="px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-screen-md mx-auto">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
              {currentStep === 1 ? '1' : '✓'}
            </div>
            <span className={`text-sm font-medium ${currentStep === 1 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
              Thông tin cửa hàng
            </span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              2
            </div>
            <span className={`text-sm font-medium ${currentStep === 2 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
              Xác định vị trí
            </span>
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {currentStep === 1 ? 'Bước 1: Thông tin cửa hàng' : 'Bước 2: Xác định vị trí'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Store Info */}
          {currentStep === 1 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Tên cửa hàng (bắt buộc)</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cửa hàng Tạp Hóa Minh Anh" className="text-sm" />
              </div>

              {/* Ảnh */}
              <div className="space-y-1.5">
                <Label htmlFor="image" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ảnh cửa hàng (bắt buộc)</Label>
                <div className="relative w-full">
                  {imageFile ? (
                    <div className="relative group w-full">
                      <img
                        src={URL.createObjectURL(imageFile)}
                        alt="Ảnh xem trước"
                        className="w-full max-w-full h-40 object-cover rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                      />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-full p-1 shadow hover:bg-red-100 dark:hover:bg-red-900 text-gray-400 hover:text-red-600 cursor-pointer"
                        onClick={() => setImageFile(null)}
                        aria-label="Xoá ảnh"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M6 6l8 8M6 14L14 6" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="image" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                      <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4a1 1 0 011-1h8a1 1 0 011 1v12m-4 4h-4a1 1 0 01-1-1v-4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1z" /></svg>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Chụp ảnh</span>
                      <input
                        id="image"
                        type="file"
                        accept="image/*;capture=camera"
                        capture="environment"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Toggle optional */}
              <div className="pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(v => !v)}
                  className="h-7 px-2 text-sm sm:text-xs text-gray-600 dark:text-gray-300"
                >
                  {showAdvanced ? 'Ẩn bớt thông tin' : 'Thêm thông tin khác'}
                  <span className="ml-1 text-gray-400">{showAdvanced ? '−' : '+'}</span>
                </Button>
              </div>

              {showAdvanced && (
                <div className="grid gap-3 pt-2 animate-fadeIn">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Số điện thoại</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9+ ]*"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0901 234 567"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ghi chú</Label>
                    <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bán từ 6:00 - 22:00 (nghỉ trưa 12h-13h)" className="text-sm" />
                  </div>
                </div>
              )}

              {/* Next button for step 1 */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (!name || !imageFile) {
                      showMessage('error', 'Vui lòng nhập tên cửa hàng và chụp ảnh trước khi tiếp tục')
                      return
                    }
                    setCurrentStep(2)
                  }}
                  className="w-full text-sm sm:text-base"
                >
                  Tiếp theo: Xác định vị trí →
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Location */}
          {currentStep === 2 && (
            <>
              {/* Địa chỉ */}
              <div className="space-y-1.5">
                <Label htmlFor="address" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Địa chỉ (bắt buộc - nhập tay)</Label>
                <div className="relative">
                  <textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={() => {
                      if (!address) return;
                      const isAllLower = address === address.toLowerCase();
                      const isAllUpper = address === address.toUpperCase();
                      if ((isAllLower || isAllUpper) && address.length > 2) {
                        const fixed = toTitleCaseVI(address.toLowerCase())
                        setAddress(fixed)
                      }
                    }}
                    placeholder="Nhập địa chỉ: 123 Đường Lê Lợi, Phường 7, Quận 3, TP. Hồ Chí Minh"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 resize-y min-h-[72px] pr-9"
                  />
                  {address && address.length > 0 && (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-2 top-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none cursor-pointer"
                      onClick={() => setAddress('')}
                      aria-label="Xoá nhanh địa chỉ"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M6 6l8 8M6 14L14 6" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Google Maps Link (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="gmap" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Link Google Maps (tùy chọn)</Label>
                <div className="flex gap-2">
                  <Input
                    id="gmap"
                    value={gmapLink}
                    onChange={(e) => setGmapLink(e.target.value)}
                    placeholder="https://maps.app.goo.gl/AbCd1234"
                    className={`${gmapStatus === 'error' ? 'border-red-500' : gmapStatus === 'success' ? 'border-green-500' : ''} text-sm flex-1`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handlePasteGmap}
                    disabled={gmapResolving}
                    className="h-10 px-3 shrink-0 text-sm"
                    aria-label="Dán link Google Maps"
                  >
                    Dán
                  </Button>
                </div>
                {gmapMessage && (
                  <div className={`text-[11px] ${gmapStatus === 'error' ? 'text-red-600' : gmapStatus === 'success' ? 'text-green-600' : 'text-gray-500'}`}>{gmapMessage}</div>
                )}
              </div>

              {/* Map Picker */}
              <div className="space-y-1.5 pt-2" ref={mapWrapperRef}>
                <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                  Vị trí trên bản đồ
                </Label>

                {/* Map controls - above map */}
                <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        try {
                          setResolvingAddr(true)

                          // Get fresh GPS with heading
                          const coords = await getBestPosition({
                            attempts: 3,
                            timeout: 4000,
                            maxWaitTime: 8000,
                            desiredAccuracy: 25
                          })

                          // Update initial GPS reference (for submit if not edited)
                          setInitialGPSLat(coords.latitude)
                          setInitialGPSLng(coords.longitude)

                          // Update map display
                          setPickedLat(coords.latitude)
                          setPickedLng(coords.longitude)

                          // Save heading/bearing if available
                          if (coords.heading !== null && coords.heading !== undefined && !isNaN(coords.heading)) {
                            setHeading(coords.heading)
                            console.log('📍 Heading:', coords.heading)
                          }

                          // Reset edited flag since this is a fresh GPS load
                          setUserHasEditedMap(false)

                          showMessage('success', 'Đã cập nhật vị trí GPS mới')
                        } catch (err) {
                          console.error('Get location error:', err)
                          showMessage('error', 'Không thể lấy vị trí GPS. Vui lòng cấp quyền định vị')
                        } finally {
                          setResolvingAddr(false)
                        }
                      }}
                      disabled={resolvingAddr}
                      className="text-xs flex items-center gap-1.5 h-8"
                      title="Lấy lại vị trí GPS hiện tại của bạn"
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${resolvingAddr ? 'animate-spin' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {resolvingAddr ? 'Đang lấy...' : 'Lấy vị trí hiện tại'}
                    </Button>
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
                    heading={heading}
                  />
                </div>
              </div>

          {/* Back and Submit buttons for step 2 */}
          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="w-1/3 text-sm sm:text-base"
            >
              ← Quay lại
            </Button>
            <Button
              type="submit"
              disabled={loading || gmapResolving}
              className="flex-1 text-sm sm:text-base"
            >
              {loading || gmapResolving ? 'Đang thêm…' : 'Lưu cửa hàng'}
            </Button>
          </div>
            </>
          )}
        </form>
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
    if (data?.finalUrl && data.finalUrl !== urlStr) return data.finalUrl
    return null
  } catch { return null }
}

// Inject implementation instead of monkey patching namespace
setExpandShortLink(expandShortLink)
