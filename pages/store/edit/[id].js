import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import { Msg } from '@/components/ui/msg'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { getFullImageUrl, STORE_PLACEHOLDER_IMAGE } from '@/helper/imageUtils'
import { invalidateStoreCache } from '@/lib/storeCache'
import { DISTRICT_WARD_SUGGESTIONS, DISTRICT_SUGGESTIONS, STORE_TYPE_OPTIONS, DEFAULT_STORE_TYPE } from '@/lib/constants'
import { toTitleCaseVI } from '@/lib/utils'
import { getBestPosition, getGeoErrorMessage } from '@/helper/geolocation'

const StoreLocationPicker = dynamic(
  () => import('@/components/map/store-location-picker'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center bg-gray-900 rounded-md" style={{ height: '40vh' }}>
        <span className="text-sm text-gray-400 animate-pulse">Đang tải bản đồ…</span>
      </div>
    ),
  }
)

export default function EditStore() {
  const router = useRouter()
  const { id } = router.query
  const { user, loading: authLoading } = useAuth() || {}

  const [pageReady, setPageReady] = useState(false)
  const [store, setStore] = useState(null)
  const [fetchError, setFetchError] = useState('')

  // Form fields
  const [name, setName] = useState('')
  const [storeType, setStoreType] = useState(DEFAULT_STORE_TYPE)
  const [addressDetail, setAddressDetail] = useState('')
  const [ward, setWard] = useState('')
  const [district, setDistrict] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [active, setActive] = useState(false)
  const [pickedLat, setPickedLat] = useState(null)
  const [pickedLng, setPickedLng] = useState(null)
  const [mapEditable, setMapEditable] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)

  // Image
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState(false)
  const fileInputRef = useRef(null)

  // Map link
  const [mapsLink, setMapsLink] = useState('')
  const [mapsLinkLoading, setMapsLinkLoading] = useState(false)
  const [mapsLinkError, setMapsLinkError] = useState('')

  // Submit state
  const [saving, setSaving] = useState(false)
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)

  function showMessage(type, text, duration = 3000) {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(
      () => setMsgState((s) => ({ ...s, show: false })),
      duration
    )
  }

  // Auth guard
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace(`/login?from=/store/edit/${id || ''}`)
    } else {
      setPageReady(true)
    }
  }, [user, authLoading, id, router])

  // Fetch store
  useEffect(() => {
    if (!id || !pageReady) return
    async function fetchStore() {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !data) {
        setFetchError('Không tìm thấy cửa hàng.')
        return
      }
      setStore(data)
      setName(data.name || '')
      setStoreType(data.store_type || DEFAULT_STORE_TYPE)
      setAddressDetail(data.address_detail || '')
      setWard(data.ward || '')
      setDistrict(data.district || '')
      setPhone(data.phone || '')
      setNote(data.note || '')
      setActive(Boolean(data.active))
      setPickedLat(typeof data.latitude === 'number' ? data.latitude : null)
      setPickedLng(typeof data.longitude === 'number' ? data.longitude : null)
    }
    fetchStore()
  }, [id, pageReady])

  // Ward suggestions for selected district
  const wardSuggestions = district ? (DISTRICT_WARD_SUGGESTIONS[district] || []) : []

  // Image file handler
  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImageError(false)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
  }

  // Extract coords from Google Maps URL
  function extractCoordsFromUrl(url) {
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /\/place\/[^/]*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])
        if (isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
          return { lat, lng }
      }
    }
    return null
  }

  async function handleMapsLink(link) {
    const trimmed = (link || '').trim()
    setMapsLink(trimmed)
    setMapsLinkError('')
    if (!trimmed) return

    let coords = extractCoordsFromUrl(trimmed)
    if (coords) {
      setPickedLat(coords.lat)
      setPickedLng(coords.lng)
      showMessage('success', `Đã lấy vị trí: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
      return
    }

    const isShortLink = /goo\.gl|maps\.app\.goo\.gl/i.test(trimmed)
    if (!isShortLink) {
      setMapsLinkError('Không tìm thấy tọa độ trong link')
      return
    }

    try {
      setMapsLinkLoading(true)
      const res = await fetch('/api/expand-maps-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!data.success || !data.finalUrl) { setMapsLinkError('Không mở được link'); return }
      coords = extractCoordsFromUrl(data.finalUrl)
      if (coords) {
        setPickedLat(coords.lat)
        setPickedLng(coords.lng)
        showMessage('success', `Đã lấy vị trí: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
      } else {
        setMapsLinkError('Không tìm thấy tọa độ từ link')
      }
    } catch {
      setMapsLinkError('Lỗi khi xử lý link')
    } finally {
      setMapsLinkLoading(false)
    }
  }

  async function handleGetLocation() {
    try {
      setResolvingAddr(true)
      const { coords, error } = await getBestPosition({
        maxWaitTime: 2000,
        desiredAccuracy: 15,
        skipCache: true,
      })
      if (!coords) {
        showMessage('error', getGeoErrorMessage(error))
        return
      }
      setPickedLat(coords.latitude)
      setPickedLng(coords.longitude)
      showMessage('success', 'Đã cập nhật vị trí GPS mới')
    } catch (err) {
      console.error('Get location error:', err)
      showMessage('error', getGeoErrorMessage(err))
    } finally {
      setResolvingAddr(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) { showMessage('error', 'Tên cửa hàng không được để trống'); return }
    if (!district.trim() || !ward.trim()) {
      showMessage('error', 'Vui lòng nhập đủ quận/huyện và xã/phường')
      return
    }

    setSaving(true)
    try {
      let newImageUrl = store?.image_url || null

      // Upload new image if selected
      if (imageFile) {
        const authRes = await fetch('/api/imagekit-auth')
        const authData = await authRes.json()
        if (!authData.token) throw new Error('imagekit-auth thất bại')

        const { IMAGEKIT_URL_ENDPOINT, IMAGEKIT_PUBLIC_KEY } = await import('@/lib/constants')
        const formData = new FormData()
        formData.append('file', imageFile)
        formData.append('fileName', `store-${id}-${Date.now()}`)
        formData.append('publicKey', IMAGEKIT_PUBLIC_KEY)
        formData.append('signature', authData.signature)
        formData.append('expire', authData.expire)
        formData.append('token', authData.token)

        const ikRes = await fetch(`${IMAGEKIT_URL_ENDPOINT}/api/v1/files/upload`, {
          method: 'POST',
          body: formData,
        })
        const ikData = await ikRes.json()
        if (ikData.name) newImageUrl = ikData.name
      }

      const updates = {
        name: toTitleCaseVI(name.trim()),
        store_type: storeType || DEFAULT_STORE_TYPE,
        address_detail: addressDetail.trim() || null,
        ward: ward.trim() || null,
        district: district.trim() || null,
        phone: phone.trim() || null,
        note: note.trim() || null,
        active,
        latitude: pickedLat,
        longitude: pickedLng,
        image_url: newImageUrl,
      }

      const { error } = await supabase.from('stores').update(updates).eq('id', id)
      if (error) throw error

      invalidateStoreCache()
      showMessage('success', 'Đã lưu thay đổi!', 1500)
      setTimeout(() => router.push('/'), 1600)
    } catch (err) {
      console.error(err)
      showMessage('error', err.message || 'Lưu thất bại, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !pageReady) return <FullPageLoading />

  if (fetchError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{fetchError}</p>
          <Button onClick={() => router.back()}>Quay lại</Button>
        </div>
      </div>
    )
  }

  if (!store) {
    return <FullPageLoading />
  }

  const currentImage = imagePreview || (imageError ? STORE_PLACEHOLDER_IMAGE : getFullImageUrl(store.image_url))

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => router.back()}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          }
        />
        <div>
          <h1 className="text-base font-semibold text-white leading-tight">Sửa cửa hàng</h1>
          <OverflowMarquee
            text={store.name}
            className="max-w-[200px]"
            textClassName="text-xs text-gray-400"
          />
        </div>
      </div>

      <form onSubmit={handleSave} className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="store_type" className="text-sm font-medium text-gray-300">Loại cửa hàng</Label>
          <select
            id="store_type"
            value={storeType}
            onChange={(e) => setStoreType(e.target.value || DEFAULT_STORE_TYPE)}
            className="w-full h-11 rounded-xl border border-gray-700 bg-gray-900 text-base px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STORE_TYPE_OPTIONS.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        {/* Image */}
        <div>
          <Label className="text-sm font-medium text-gray-300 mb-2 block">Ảnh cửa hàng</Label>
          <div
            className="relative w-full h-48 rounded-2xl overflow-hidden bg-gray-900 cursor-pointer group border border-gray-800"
            onClick={() => fileInputRef.current?.click()}
          >
            {currentImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImage}
                alt={store.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-white text-sm font-medium">Đổi ảnh</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          {imageFile && (
            <p className="text-xs text-gray-500 mt-1">Ảnh mới: {imageFile.name}</p>
          )}
        </div>

        {/* Name */}
        <div>
          <Label htmlFor="edit-name" className="text-sm font-medium text-gray-300 mb-1.5 block">
            Tên cửa hàng <span className="text-red-500">*</span>
          </Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Thịt bò Minh Khai"
            className="h-11 rounded-xl text-sm"
          />
        </div>

        {/* District */}
        <div>
          <Label className="text-sm font-medium text-gray-300 mb-1.5 block">Huyện / Quận</Label>
          <select
            value={district}
            onChange={(e) => { setDistrict(e.target.value); setWard('') }}
            className="w-full h-11 rounded-xl border border-gray-700 bg-gray-900 text-sm px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Chọn huyện / quận</option>
            {DISTRICT_SUGGESTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Ward */}
        <div>
          <Label className="text-sm font-medium text-gray-300 mb-1.5 block">Xã / Phường / Thị trấn</Label>
          {wardSuggestions.length > 0 ? (
            <select
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-700 bg-gray-900 text-sm px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Chọn xã / phường</option>
              {wardSuggestions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          ) : (
            <Input
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              placeholder="VD: Minh Khai"
              className="h-11 rounded-xl text-sm"
            />
          )}
        </div>

        {/* Address detail */}
        <div>
          <Label htmlFor="edit-addr" className="text-sm font-medium text-gray-300 mb-1.5 block">Địa chỉ chi tiết</Label>
          <Input
            id="edit-addr"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            placeholder="VD: Số 12, Ngõ 5, Đường Lê Lợi"
            className="h-11 rounded-xl text-sm"
          />
        </div>

        {/* Phone */}
        <div>
          <Label htmlFor="edit-phone" className="text-sm font-medium text-gray-300 mb-1.5 block">Số điện thoại</Label>
          <Input
            id="edit-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="VD: 0912 345 678"
            className="h-11 rounded-xl text-sm"
          />
        </div>

        {/* Note */}
        <div>
          <Label htmlFor="edit-note" className="text-sm font-medium text-gray-300 mb-1.5 block">Ghi chú</Label>
          <textarea
            id="edit-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Mở cửa từ 6h–11h, chỉ bán thứ 2–7"
            rows={3}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 text-sm px-3 py-2.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? 'bg-green-500' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <div>
            <span className="text-sm font-medium text-gray-300">Đã xác minh</span>
            <p className="text-xs text-gray-400">Cửa hàng đã được kiểm tra thực tế</p>
          </div>
        </div>

        {/* Location */}
        <div>
          <Label className="text-sm font-medium text-gray-300 mb-2 block">Vị trí trên bản đồ</Label>

          {/* Maps link input */}
          <div className="mb-3">
            <div className="flex gap-2">
              <Input
                value={mapsLink}
                onChange={(e) => setMapsLink(e.target.value)}
                placeholder="Dán link Google Maps để lấy tọa độ"
                className="h-10 rounded-xl text-sm flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={mapsLinkLoading || !mapsLink.trim()}
                leftIcon={mapsLinkLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                ) : undefined}
                onClick={() => handleMapsLink(mapsLink)}
              >
                {mapsLinkLoading ? 'Đang lấy...' : 'Lấy tọa độ'}
              </Button>
            </div>
            {mapsLinkError && <p className="text-xs text-red-500 mt-1">{mapsLinkError}</p>}
          </div>

          {pickedLat != null && pickedLng != null && (
            <p className="text-xs text-gray-400 mb-2">
              Tọa độ: {pickedLat.toFixed(6)}, {pickedLng.toFixed(6)}
            </p>
          )}

          <div className="rounded-2xl overflow-hidden border border-gray-800" style={{ height: '40vh' }}>
            <StoreLocationPicker
              initialLat={pickedLat}
              initialLng={pickedLng}
              editable={mapEditable}
              onToggleEditable={() => setMapEditable((v) => !v)}
              onChange={(lat, lng) => { setPickedLat(lat); setPickedLng(lng) }}
              onGetLocation={handleGetLocation}
              resolvingAddr={resolvingAddr}
              dark={false}
            />
          </div>
        </div>

        {/* Toast message */}
        {msgState.show && (
          <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${msgState.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
            {msgState.text}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 pb-8">
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="w-full"
            leftIcon={saving ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : undefined}
          >
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </div>
  )
}
