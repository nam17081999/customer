import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Msg } from '@/components/ui/msg'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import StoreSupplementForm from '@/components/store/store-supplement-form'
import { getCachedStores, updateStoreInCache } from '@/lib/storeCache'
import {
  DISTRICT_WARD_SUGGESTIONS,
  DISTRICT_SUGGESTIONS,
  STORE_TYPE_OPTIONS,
  DEFAULT_STORE_TYPE,
} from '@/lib/constants'
import { toTitleCaseVI } from '@/lib/utils'
import { findDuplicatePhoneStores, validateVietnamPhone } from '@/helper/validation'
import { getBestPosition, getGeoErrorMessage } from '@/helper/geolocation'
import { hasStoreCoordinates } from '@/helper/storeSupplement'

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
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const rawMode = Array.isArray(router.query.mode) ? router.query.mode[0] : router.query.mode
  const isSupplementMode = rawMode === 'supplement' || rawMode === 'location-only'

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
  const [phoneSecondary, setPhoneSecondary] = useState('')
  const [note, setNote] = useState('')
  const [active, setActive] = useState(false)
  const [pickedLat, setPickedLat] = useState(null)
  const [pickedLng, setPickedLng] = useState(null)
  const [initialGPSLat, setInitialGPSLat] = useState(null)
  const [initialGPSLng, setInitialGPSLng] = useState(null)
  const [userHasEditedMap, setUserHasEditedMap] = useState(false)
  const [mapEditable, setMapEditable] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)


  // Map link
  const [mapsLink, setMapsLink] = useState('')
  const [mapsLinkLoading, setMapsLinkLoading] = useState(false)
  const [mapsLinkError, setMapsLinkError] = useState('')

  // Submit state
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMode, setSuccessMode] = useState('')
  const [supplementLocationOpen, setSupplementLocationOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState({
    open: false,
    type: '',
    payload: null,
  })
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  const autoLocationRequestedRef = useRef(false)

  const pushSearchWithNotice = useCallback(async (text, type = 'success') => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('storevis:flash-message', JSON.stringify({
        type,
        text,
        createdAt: Date.now(),
      }))
      window.dispatchEvent(new CustomEvent('storevis:flash-message'))
    }
    await router.push('/')
  }, [router])

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
    if (!router.isReady || authLoading) return
    if (!isAuthenticated && !isSupplementMode) {
      router.replace(`/login?from=${encodeURIComponent(router.asPath || `/store/edit/${id || ''}`)}`)
    } else if (!isAdmin && !isSupplementMode) {
      router.replace('/account')
    } else {
      setPageReady(true)
    }
  }, [router.isReady, isAuthenticated, isAdmin, authLoading, id, router, isSupplementMode])

  // Fetch store
  useEffect(() => {
    if (!router.isReady || !id || !pageReady) return
    async function fetchStore() {
      const cached = await getCachedStores()
      const cachedStores = Array.isArray(cached?.data) ? cached.data : []
      const data = cachedStores.find((entry) => String(entry?.id) === String(id))

      if (!data) {
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
      setPhoneSecondary(data.phone_secondary || '')
      setNote(data.note || '')
      setActive(Boolean(data.active))
      setPickedLat(typeof data.latitude === 'number' ? data.latitude : null)
      setPickedLng(typeof data.longitude === 'number' ? data.longitude : null)
      setInitialGPSLat(null)
      setInitialGPSLng(null)
      setUserHasEditedMap(false)
      setCurrentStep(1)
      setShowSuccess(false)
      setSuccessMode('')
      setSupplementLocationOpen(false)
      autoLocationRequestedRef.current = false
    }
    fetchStore()
  }, [router.isReady, id, pageReady])

  const handleLocationChange = useCallback((lat, lng) => {
    setPickedLat(lat)
    setPickedLng(lng)
    if (mapEditable) {
      setUserHasEditedMap(true)
    }
  }, [mapEditable])

  const handleGetLocation = useCallback(async () => {
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
      setInitialGPSLat(coords.latitude)
      setInitialGPSLng(coords.longitude)
      setPickedLat(coords.latitude)
      setPickedLng(coords.longitude)
      setUserHasEditedMap(false)
      showMessage('success', 'Đã cập nhật vị trí GPS mới!')
    } catch (err) {
      console.error('Get location error:', err)
      showMessage('error', getGeoErrorMessage(err))
    } finally {
      setResolvingAddr(false)
    }
  }, [showMessage])

  useEffect(() => {
    if (!pageReady || !store || !isSupplementMode) return
    if (autoLocationRequestedRef.current) return
    if (currentStep !== 3) return
    if (!supplementLocationOpen) return
    if (hasStoreCoordinates(store)) return
    if (pickedLat != null && pickedLng != null) return

    autoLocationRequestedRef.current = true
    handleGetLocation()
  }, [pageReady, store, isSupplementMode, currentStep, supplementLocationOpen, pickedLat, pickedLng, handleGetLocation])

  // Ward suggestions for selected district
  const wardSuggestions = district ? (DISTRICT_WARD_SUGGESTIONS[district] || []) : []
  const originalHasCoordinates = hasStoreCoordinates(store)
  const supplementLocks = useMemo(() => ({
    name: Boolean(String(store?.name || '').trim()),
    storeType: Boolean(String(store?.store_type || '').trim()),
    addressDetail: Boolean(String(store?.address_detail || '').trim()),
    ward: Boolean(String(store?.ward || '').trim()),
    district: Boolean(String(store?.district || '').trim()),
    phone: Boolean(String(store?.phone || '').trim()),
    phoneSecondary: Boolean(String(store?.phone_secondary || '').trim()),
    note: Boolean(String(store?.note || '').trim()),
    location: originalHasCoordinates,
  }), [store, originalHasCoordinates])
  const supplementStepCount = originalHasCoordinates ? 2 : 3
  const supplementSteps = supplementStepCount === 2
    ? [
      { num: 1, label: 'Tên' },
      { num: 2, label: 'Thông tin' },
    ]
    : [
      { num: 1, label: 'Tên' },
      { num: 2, label: 'Thông tin' },
      { num: 3, label: 'Vị trí' },
    ]
  const hasEditableSupplementFields = useMemo(() => (
    Object.values(supplementLocks).some((value) => value === false)
  ), [supplementLocks])

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
      setInitialGPSLat(coords.lat)
      setInitialGPSLng(coords.lng)
      setPickedLat(coords.lat)
      setPickedLng(coords.lng)
      setUserHasEditedMap(true)
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
        setInitialGPSLat(coords.lat)
        setInitialGPSLng(coords.lng)
        setPickedLat(coords.lat)
        setPickedLng(coords.lng)
        setUserHasEditedMap(true)
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

  function getFinalCoordinates() {
    if (userHasEditedMap && pickedLat != null && pickedLng != null) {
      return { latitude: pickedLat, longitude: pickedLng }
    }
    if (initialGPSLat != null && initialGPSLng != null) {
      return { latitude: initialGPSLat, longitude: initialGPSLng }
    }
    if (pickedLat != null && pickedLng != null) {
      return { latitude: pickedLat, longitude: pickedLng }
    }
    return { latitude: null, longitude: null }
  }

  function buildDuplicatePhoneMessage(matches, label = 'Số điện thoại') {
    const labels = matches.slice(0, 3).map((entry) => entry.name || 'Cửa hàng')
    return `${label} đã tồn tại ở ${labels.join('; ')}`
  }

  async function validateCurrentPhones({ skipWhenLocked = false } = {}) {
    const fallbackPrimary = skipWhenLocked && supplementLocks.phone ? String(store?.phone || '').trim() : ''
    const fallbackSecondary = skipWhenLocked && supplementLocks.phoneSecondary ? String(store?.phone_secondary || '').trim() : ''

    const rawPrimary = skipWhenLocked && supplementLocks.phone ? fallbackPrimary : phone.trim()
    const rawSecondary = skipWhenLocked && supplementLocks.phoneSecondary ? fallbackSecondary : phoneSecondary.trim()

    let normalizedPrimary = ''
    let normalizedSecondary = ''

    if (rawPrimary) {
      const validation = validateVietnamPhone(rawPrimary)
      if (!validation.isValid) {
        return { normalizedPhone: '', normalizedPhoneSecondary: '', error: validation.message }
      }
      normalizedPrimary = validation.normalized
    }

    if (!normalizedPrimary && rawSecondary) {
      return { normalizedPhone: '', normalizedPhoneSecondary: '', error: 'Vui lòng nhập số điện thoại 1 trước' }
    }

    if (rawSecondary) {
      const validation = validateVietnamPhone(rawSecondary)
      if (!validation.isValid) {
        return { normalizedPhone: normalizedPrimary, normalizedPhoneSecondary: '', error: validation.message }
      }
      normalizedSecondary = validation.normalized
    }

    if (normalizedPrimary && normalizedSecondary && normalizedPrimary === normalizedSecondary) {
      return {
        normalizedPhone: normalizedPrimary,
        normalizedPhoneSecondary: '',
        error: 'Số điện thoại 2 không được trùng số điện thoại 1',
      }
    }

    if (!normalizedPrimary && !normalizedSecondary) {
      return { normalizedPhone: '', normalizedPhoneSecondary: '', error: '' }
    }

    const cached = await getCachedStores()
    const stores = Array.isArray(cached?.data) ? cached.data : []

    if (normalizedPrimary) {
      const duplicatePhoneStores = findDuplicatePhoneStores(stores, normalizedPrimary, { excludeStoreId: id })
      if (duplicatePhoneStores.length > 0) {
        return {
          normalizedPhone: '',
          normalizedPhoneSecondary: normalizedSecondary,
          error: buildDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 1'),
        }
      }
    }

    if (normalizedSecondary) {
      const duplicatePhoneStores = findDuplicatePhoneStores(stores, normalizedSecondary, { excludeStoreId: id })
      if (duplicatePhoneStores.length > 0) {
        return {
          normalizedPhone: normalizedPrimary,
          normalizedPhoneSecondary: '',
          error: buildDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 2'),
        }
      }
    }

    return { normalizedPhone: normalizedPrimary, normalizedPhoneSecondary: normalizedSecondary, error: '' }
  }




  async function executeSaveSupplement(validatedSupplementPhone, validatedSupplementPhoneSecondary) {
    setSaving(true)
    try {
      const nowIso = new Date().toISOString()
      const updates = {}

      if (!supplementLocks.name) {
        const normalizedName = toTitleCaseVI(name.trim())
        if (normalizedName) updates.name = normalizedName
      }
      if (!supplementLocks.storeType) {
        const normalizedStoreType = storeType || DEFAULT_STORE_TYPE
        if (normalizedStoreType) updates.store_type = normalizedStoreType
      }
      if (!supplementLocks.addressDetail) {
        const normalizedDetail = addressDetail.trim() ? toTitleCaseVI(addressDetail.trim()) : ''
        if (normalizedDetail) updates.address_detail = normalizedDetail
      }
      if (!supplementLocks.district) {
        const normalizedDistrict = district.trim() ? toTitleCaseVI(district.trim()) : ''
        if (normalizedDistrict) updates.district = normalizedDistrict
      }
      if (!supplementLocks.ward) {
        const normalizedWard = ward.trim() ? toTitleCaseVI(ward.trim()) : ''
        if (normalizedWard) updates.ward = normalizedWard
      }
      if (!supplementLocks.phone) {
        if (validatedSupplementPhone) updates.phone = validatedSupplementPhone
      }
      if (!supplementLocks.phoneSecondary) {
        if (validatedSupplementPhoneSecondary) updates.phone_secondary = validatedSupplementPhoneSecondary
      }
      if (!supplementLocks.note) {
        const normalizedNote = note.trim()
        if (normalizedNote) updates.note = normalizedNote
      }
      if (!supplementLocks.location) {
        const finalCoords = getFinalCoordinates()
        if (Number.isFinite(finalCoords.latitude) && Number.isFinite(finalCoords.longitude)) {
          updates.latitude = finalCoords.latitude
          updates.longitude = finalCoords.longitude
        }
      }

      if (Object.keys(updates).length === 0) {
        showMessage('error', 'Bạn chưa bổ sung thêm thông tin nào')
        setSaving(false)
        return
      }

      updates.updated_at = nowIso

      if (isAdmin) {
        const { error } = await supabase.from('stores').update(updates).eq('id', id)
        if (error) throw error
        const nextStore = { ...store, ...updates }
        await updateStoreInCache(id, updates)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('storevis:stores-changed', {
              detail: { type: 'update', id, store: nextStore },
            })
          )
        }
      } else {
        const { error } = await supabase.from('store_reports').insert([{
          store_id: id,
          report_type: 'edit',
          reason_codes: null,
          proposed_changes: updates,
          reporter_id: null,
        }])
        if (error) throw error
      }
      await pushSearchWithNotice(isAdmin ? 'Đã bổ sung thông tin cửa hàng!' : 'Đã gửi đề xuất bổ sung để admin duyệt!')
    } catch (err) {
      console.error(err)
      showMessage('error', err.message || 'Lưu thất bại, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSupplement() {
    if (!hasEditableSupplementFields) {
      showMessage('error', 'Cửa hàng này không còn dữ liệu nào để bổ sung')
      return
    }

    const {
      normalizedPhone: validatedSupplementPhone,
      normalizedPhoneSecondary: validatedSupplementPhoneSecondary,
      error: supplementPhoneError,
    } = await validateCurrentPhones({ skipWhenLocked: true })
    if (supplementPhoneError) {
      showMessage('error', supplementPhoneError)
      return
    }

    setConfirmAction({
      open: true,
      type: 'supplement',
      payload: { validatedSupplementPhone, validatedSupplementPhoneSecondary },
    })
  }

  async function executeEditSave(validatedPhone, validatedPhoneSecondary) {
    setSaving(true)
    try {
      const nowIso = new Date().toISOString()

      const finalCoords = getFinalCoordinates()
      const updates = {
        name: toTitleCaseVI(name.trim()),
        store_type: storeType || DEFAULT_STORE_TYPE,
        address_detail: addressDetail.trim() || null,
        ward: ward.trim() || null,
        district: district.trim() || null,
        phone: validatedPhone || null,
        phone_secondary: validatedPhoneSecondary || null,
        note: note.trim() || null,
        active,
        latitude: finalCoords.latitude,
        longitude: finalCoords.longitude,
        updated_at: nowIso,
      }

      const { error } = await supabase.from('stores').update(updates).eq('id', id)
      if (error) throw error
      const nextStore = { ...store, ...updates }
      await updateStoreInCache(id, updates)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('storevis:stores-changed', {
            detail: { type: 'update', id, store: nextStore },
          })
        )
      }
      await pushSearchWithNotice('Đã lưu thay đổi cửa hàng!')
    } catch (err) {
      console.error(err)
      showMessage('error', err.message || 'Lưu thất bại, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmAction() {
    const payload = confirmAction.payload || {}
    const type = confirmAction.type
    setConfirmAction({ open: false, type: '', payload: null })

    if (type === 'supplement') {
      await executeSaveSupplement(payload.validatedSupplementPhone, payload.validatedSupplementPhoneSecondary)
      return
    }
    if (type === 'edit') {
      await executeEditSave(payload.validatedPhone, payload.validatedPhoneSecondary)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (isSupplementMode) {
      await handleSaveSupplement()
      return
    }

    if (!name.trim()) { showMessage('error', 'Tên cửa hàng không được để trống'); return }
    if (!district.trim() || !ward.trim()) {
      showMessage('error', 'Vui lòng nhập đủ quận/huyện và xã/phường')
      return
    }

    const {
      normalizedPhone: validatedPhone,
      normalizedPhoneSecondary: validatedPhoneSecondary,
      error: phoneError,
    } = await validateCurrentPhones()
    if (phoneError) {
      showMessage('error', phoneError)
      return
    }

    setConfirmAction({
      open: true,
      type: 'edit',
      payload: { validatedPhone, validatedPhoneSecondary },
    })
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

  if (showSuccess) {
    const isSupplementReport = successMode === 'supplement-report'
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-6 py-10 space-y-5 max-w-sm mx-auto">
          <div className="text-6xl">✅</div>
          <h2 className="text-xl font-bold text-white">
            {isSupplementReport ? 'Đã gửi đề xuất bổ sung!' : 'Bổ sung dữ liệu thành công!'}
          </h2>
          <p className="text-sm text-gray-400">
            {isSupplementReport
              ? 'Admin sẽ xem xét và duyệt phần dữ liệu bạn vừa bổ sung.'
              : 'Thông tin còn thiếu đã được cập nhật vào hệ thống.'}
          </p>
          <div className="flex flex-col gap-3 pt-2">
            {isAdmin && (
              <Button className="w-full" onClick={() => router.push(`/store/edit/${id}`)}>
                Xem màn sửa đầy đủ
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
              Về trang chủ
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const confirmDialogNode = (
    <ConfirmDialog
      open={confirmAction.open}
      onOpenChange={(open) => {
        setConfirmAction((prev) => (open ? prev : { open: false, type: '', payload: null }))
      }}
      title={confirmAction.type === 'supplement' ? 'Xác nhận bổ sung cửa hàng' : 'Xác nhận chỉnh sửa cửa hàng'}
      description={
        confirmAction.type === 'supplement'
          ? 'Bạn có chắc muốn lưu phần dữ liệu bổ sung này không?'
          : 'Bạn có chắc muốn lưu các thay đổi của cửa hàng không?'
      }
      confirmLabel={confirmAction.type === 'supplement' ? 'Lưu bổ sung' : 'Lưu thay đổi'}
      loading={saving}
      onConfirm={handleConfirmAction}
    />
  )

  const loadingOverlayNode = (
    <FullPageLoading
      visible={saving}
      message={isSupplementMode ? 'Đang lưu bổ sung…' : 'Đang cập nhật cửa hàng…'}
    />
  )


  if (isSupplementMode) {
    return (
      <>
        <StoreSupplementForm
        router={router}
        user={isAdmin ? user : null}
        store={store}
        msgState={msgState}
        steps={supplementSteps}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        stepCount={supplementStepCount}
        saving={saving}
          storeType={storeType}
          setStoreType={setStoreType}
          name={name}
        setName={setName}
        district={district}
        setDistrict={setDistrict}
        ward={ward}
        setWard={setWard}
        wardSuggestions={wardSuggestions}
        addressDetail={addressDetail}
        setAddressDetail={setAddressDetail}
        phone={phone}
        setPhone={setPhone}
        phoneSecondary={phoneSecondary}
        setPhoneSecondary={setPhoneSecondary}
        note={note}
        setNote={setNote}
        supplementLocks={supplementLocks}
        pickedLat={pickedLat}
        pickedLng={pickedLng}
        locationSectionOpen={supplementLocationOpen}
        openLocationSection={() => setSupplementLocationOpen(true)}
        onLocationChange={handleLocationChange}
        mapEditable={mapEditable}
        setMapEditable={setMapEditable}
        resolvingAddr={resolvingAddr}
        handleGetLocation={handleGetLocation}
        mapsLink={mapsLink}
        mapsLinkLoading={mapsLinkLoading}
        mapsLinkError={mapsLinkError}
        setMapsLink={setMapsLink}
        handleMapsLink={handleMapsLink}
        handleSaveSupplement={handleSaveSupplement}
      />
      {loadingOverlayNode}
      {confirmDialogNode}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
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
        <>
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

        {(phone.trim() || phoneSecondary.trim()) && (
          <div>
            <Label htmlFor="edit-phone-secondary" className="text-sm font-medium text-gray-300 mb-1.5 block">
              Số điện thoại 2
            </Label>
            <Input
              id="edit-phone-secondary"
              type="tel"
              value={phoneSecondary}
              onChange={(e) => setPhoneSecondary(e.target.value)}
              placeholder="VD: 0988 123 456"
              className="h-11 rounded-xl text-sm"
            />
          </div>
        )}

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
        </>

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
              onChange={handleLocationChange}
              onGetLocation={handleGetLocation}
              resolvingAddr={resolvingAddr}
              dark={false}
            />
          </div>
        </div>

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

      {confirmDialogNode}
      {loadingOverlayNode}
    </div>
  )
}












