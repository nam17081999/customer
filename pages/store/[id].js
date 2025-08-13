import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import Image from 'next/image'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { toTitleCaseVI } from '@/lib/utils'
import { getFullImageUrl } from '@/helper/imageUtils'
import imageCompression from 'browser-image-compression'

export default function StoreDetail() {
  const router = useRouter()
  const { id } = router.query
  const { user, loading } = useAuth()

  const [store, setStore] = useState(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [gmapLink, setGmapLink] = useState('')
  const [gmapResolving, setGmapResolving] = useState(false)
  const lastParsedRef = useRef(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('stores')
      .select('id,name,address,phone,note,image_url,latitude,longitude')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setStore(data)
        if (data) {
          setName(toTitleCaseVI(data.name || ''))
          setAddress(data.address || '')
          setPhone(data.phone || '')
          setNote(data.note || '')
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
      const candParams = ['destination', 'q', 'query', 'll']
      for (const key of candParams) {
        const val = u.searchParams.get(key)
        if (val) {
          const got = parseLatLngFromText(val)
          if (got) return got
        }
      }
      const fromHref = parseLatLngFromText(u.href)
      if (fromHref) return fromHref
      const fromPath = parseLatLngFromText(u.pathname)
      if (fromPath) return fromPath
      return null
    } catch {
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
      const parts = u.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex((p) => p.toLowerCase() === 'place')
      if (idx !== -1 && parts[idx + 1]) {
        return decodeURIComponent(parts[idx + 1].replace(/\+/g, ' '))
      }
      return null
    } catch { return null }
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
    const direct = parseLatLngFromGoogleMapsUrl(input)
    if (direct) return direct
    try {
      let urlStr = input.trim()
      if (!/^https?:\/\//i.test(urlStr)) urlStr = `https://${urlStr}`
      const finalUrl = await expandShortLink(urlStr)
      if (finalUrl) {
        const parsed = parseLatLngFromGoogleMapsUrl(finalUrl)
        if (parsed) return parsed
      }
    } catch {}
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
        const direct = parseLatLngFromGoogleMapsUrl(gmapLink.trim())
        if (direct) {
          const last = lastParsedRef.current
          if (!last || Math.abs(last.lat - direct.lat) > 1e-5 || Math.abs(last.lng - direct.lng) > 1e-5) {
            lastParsedRef.current = direct
            await reverseGeocodeFromLatLng(direct.lat, direct.lng)
          }
          return
        }
        const finalUrl = await expandShortLink(gmapLink.trim())
        if (finalUrl) {
          const parsed = parseLatLngFromGoogleMapsUrl(finalUrl)
          if (parsed) {
            lastParsedRef.current = parsed
            await reverseGeocodeFromLatLng(parsed.lat, parsed.lng)
            return
          }
        }
        const text = extractSearchTextFromGoogleMapsUrl(gmapLink.trim())
        if (text) {
          const geo = await geocodeTextToLatLngAddress(text)
          if (geo) {
            lastParsedRef.current = { lat: geo.lat, lng: geo.lng }
            if (geo.address) setAddress(geo.address)
          }
        }
      } finally { setGmapResolving(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [gmapLink])

  async function onSave(e) {
    e.preventDefault()
    if (!user) { alert('Vui lòng đăng nhập để sửa cửa hàng'); return }
    setSaving(true)

    const normalizedName = toTitleCaseVI(name.trim())

    let latitude = store?.latitude ?? null
    let longitude = store?.longitude ?? null

    if (gmapLink && gmapLink.trim()) {
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
        alert('Không đọc được tọa độ từ liên kết Google Maps. Vui lòng nhập liên kết hợp lệ hoặc xóa trường này để dùng vị trí hiện tại.')
        setSaving(false)
        return
      }
    } else {
      try {
        const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject))
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
      } catch (geoErr) {
        console.error('Không lấy được tọa độ khi cập nhật:', geoErr)
        alert('Ứng dụng cần quyền truy cập vị trí để lưu thay đổi.')
        setSaving(false)
        return
      }
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

      const { error: updateErr } = await supabase
        .from('stores')
        .update({ name: normalizedName, name_search, address, phone, note, image_url, latitude, longitude })
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

      alert('Đã lưu')
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
      alert('Lưu thất bại')
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
        setAddress(cached)
        return
      }
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=vi`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Reverse geocoding failed')
      const data = await res.json()
      const text = data?.display_name || ''
      const cleaned = cleanNominatimDisplayName(text)
      if (cleaned) {
        setAddress(cleaned)
        try { sessionStorage.setItem(cacheKey, cleaned) } catch {}
      } else alert('Không lấy được địa chỉ từ Nominatim')
    } catch (err) {
      console.error('Auto fill address error:', err)
      alert('Không lấy được địa chỉ. Vui lòng cấp quyền định vị cho trang này và thử lại.')
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

  if (!store) {
    return (
      <div className="mx-auto max-w-2xl p-6">Đang tải...</div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chi tiết cửa hàng</h1>
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Quay lại</Button>
      </div>
      <Card className="mt-4">
        <CardContent className="space-y-4 p-6">
          {store?.image_url && (
            <Dialog>
              <DialogTrigger asChild>
                <Image src={getFullImageUrl(store.image_url)} alt={store.name} width={96} height={96} sizes="96px" quality={70} className="h-24 w-24 cursor-zoom-in rounded object-cover ring-1 ring-gray-200 dark:ring-gray-800" />
              </DialogTrigger>
              <DialogContent className="overflow-hidden p-0">
                <Image src={getFullImageUrl(store.image_url)} alt={store.name} width={800} height={800} className="max-h-[80vh] w-auto object-contain" />
              </DialogContent>
            </Dialog>
          )}
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Tên</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!user} />
            </div>
            <div className="grid gap-1.5">
              <Label>Địa chỉ</Label>
              <div className="flex items-center gap-2">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!user} className="flex-1" placeholder={gmapResolving ? 'Đang lấy địa chỉ từ liên kết…' : (resolvingAddr ? 'Đang tự động lấy địa chỉ…' : undefined)} />
                {user && (
                  <Button type="button" variant="outline" onClick={handleFillAddress} disabled={resolvingAddr}>
                    {resolvingAddr ? 'Đang lấy…' : 'Tự điền'}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Số điện thoại</Label>
              <Input
                type="tel"
                inputMode="numeric"
                pattern="[0-9+ ]*"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!user}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Ghi chú</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} disabled={!user} />
            </div>
            {user && (
              <div className="grid gap-1.5">
                <Label>Đổi ảnh (tùy chọn)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Link Google Maps (không bắt buộc)</Label>
              <Input
                value={gmapLink}
                onChange={(e) => setGmapLink(e.target.value)}
                placeholder="Dán liên kết chia sẻ vị trí từ Google Maps"
                disabled={!user}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">{gmapResolving ? (
                <span className="inline-flex items-center gap-2">
                  <span>Đang lấy địa chỉ từ liên kết…</span>
                  <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
                </span>
              ) : 'Nếu nhập, sẽ ưu tiên tọa độ và tự cập nhật địa chỉ từ liên kết.'}</p>
            </div>
            <div className="pt-2">
              <Button type="submit" disabled={!user || saving || gmapResolving} className="w-full">
                {!user ? 'Vui lòng đăng nhập' : (saving || gmapResolving) ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
