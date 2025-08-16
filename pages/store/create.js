import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
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
import {
  cleanNominatimDisplayName,
  parseLatLngFromText,
  parseLatLngFromGoogleMapsUrl,
  extractSearchTextFromGoogleMapsUrl,
  geocodeWithGoogle,
  geocodeTextToLatLngAddress,
  resolveLatLngFromAnyLink,
  reverseGeocodeFromLatLng,
  setExpandShortLink
} from '@/lib/createStoreUtils'

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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const lastParsedRef = useRef(null)
  const parseTimerRef = useRef(null)

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

  // Paste Google Maps link from clipboard
  async function handlePasteGmap() {
    try {
      if (!navigator.clipboard?.readText) {
        alert('Trình duyệt không hỗ trợ đọc clipboard')
        return
      }
      const text = (await navigator.clipboard.readText()).trim()
      if (!text) {
        alert('Clipboard trống')
        return
      }
      setGmapLink(text)
    } catch (e) {
      console.warn('Clipboard read error:', e)
      alert('Không đọc được clipboard. Hãy dán thủ công (Cmd+V).')
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

      // Chuẩn hoá địa chỉ: nếu toàn bộ ở dạng lowercase thì chuyển sang dạng viết hoa chữ cái đầu mỗi từ
      let finalAddress = address.trim()
      if (finalAddress && finalAddress === finalAddress.toLowerCase()) {
        finalAddress = toTitleCaseVI(finalAddress)
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
        alert('Lỗi khi lưu dữ liệu')
        setLoading(false)
        return
      }

      // Success
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2500)
      e.target.reset()
      setName('')
      setAddress('')
      setPhone('')
      setNote('')
      setImageFile(null)
      setGmapLink('')
      setGmapStatus('')
      setGmapMessage('')
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
      alert('Đã xảy ra lỗi')
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
      if (lastParsedRef.current === current) return
      lastParsedRef.current = current
      setGmapResolving(true)
      setGmapStatus('processing')
      setGmapMessage('Đang đọc link…')
      try {
        // Order: direct / expand / search text handled inside resolveLatLngFromAnyLink
        const coords = await resolveLatLngFromAnyLink(current)
        if (coords) {
          setGmapStatus('success')
          setGmapMessage(`Tọa độ: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
          // Reverse geocode (always overwrite per spec rule #6)
          try { await reverseGeocodeFromLatLng(coords.lat, coords.lng, setAddress) } catch {}
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
  }, [gmapLink])

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
      <Msg type="success" show={showSuccess}>Tạo cửa hàng thành công</Msg>
      <div className="px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-screen-md mx-auto">
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Thêm cửa hàng</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tên */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Tên cửa hàng (bắt buộc)</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cửa hàng Tạp Hóa Minh Anh" className="text-sm" />
          </div>
          {/* Địa chỉ */}
          <div className="space-y-1.5">
            <Label htmlFor="address" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Địa chỉ (bắt buộc)</Label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={gmapResolving || resolvingAddr ? 'Đang lấy địa chỉ…' : '123 Đường Lê Lợi, Phường 7, Quận 3, TP. Hồ Chí Minh'}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 resize-y min-h-[72px]"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleFillAddress}
              disabled={resolvingAddr}
              className="mt-1 w-full sm:w-auto text-sm"
            >
              {resolvingAddr ? 'Đang lấy…' : 'Tự động lấy địa chỉ'}
            </Button>
          </div>
          {/* Ảnh */}
          <div className="space-y-1.5">
            <Label htmlFor="image" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ảnh cửa hàng (bắt buộc)</Label>
            <Input id="image" type="file" accept="image/*;capture=camera" capture="environment" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="text-sm" />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Bắt buộc: tên, địa chỉ, ảnh.</p>
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
              <div className="space-y-1.5">
                <Label htmlFor="gmap" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Link google maps</Label>
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
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={loading || gmapResolving} className="w-full text-sm sm:text-base">
              {loading || gmapResolving ? 'Đang thêm…' : 'Lưu'}
            </Button>
          </div>
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
