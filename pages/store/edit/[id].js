import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import StoreSupplementForm from '@/components/store/store-supplement-form'
import { getOrRefreshStores, updateStoreInCache } from '@/lib/storeCache'
import { buildStoreDiff, logStoreEditHistory } from '@/lib/storeEditHistory'
import { DEFAULT_STORE_TYPE, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import { getBestPosition, getGeoErrorMessage, requestCompassHeading } from '@/helper/geolocation'
import { extractCoordsFromMapsUrl } from '@/helper/storeFormShared'
import { hasStoreCoordinates } from '@/helper/storeSupplement'
import {
  buildEditSteps,
  buildEditUpdates,
  buildSupplementLocks,
  buildSupplementSteps,
  buildSupplementUpdates,
  getFinalCoordinates,
  hasEditableSupplementFields,
  validateStoreEditPhones,
} from '@/helper/storeEditFlow'

function getCoordinateValue(value) {
  return Number.isFinite(value) ? value : null
}

export default function EditStore() {
  const router = useRouter()
  const { id } = router.query
  const { user, isAdmin, isTelesale, isAuthenticated, loading: authLoading } = useAuth() || {}
  const rawMode = Array.isArray(router.query.mode) ? router.query.mode[0] : router.query.mode
  const isSupplementMode = rawMode === 'supplement' || rawMode === 'location-only'

  const [pageReady, setPageReady] = useState(false)
  const [store, setStore] = useState(null)
  const [fetchError, setFetchError] = useState('')

  const [name, setName] = useState('')
  const [storeType, setStoreType] = useState(DEFAULT_STORE_TYPE)
  const [addressDetail, setAddressDetail] = useState('')
  const [ward, setWard] = useState('')
  const [district, setDistrict] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneSecondary, setPhoneSecondary] = useState('')
  const [note, setNote] = useState('')
  const [active, setActive] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const [pickedLat, setPickedLat] = useState(null)
  const [pickedLng, setPickedLng] = useState(null)
  const [initialGPSLat, setInitialGPSLat] = useState(null)
  const [initialGPSLng, setInitialGPSLng] = useState(null)
  const [userHasEditedMap, setUserHasEditedMap] = useState(false)
  const [mapEditable, setMapEditable] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [heading, setHeading] = useState(null)
  const [compassError, setCompassError] = useState('')
  const [geoBlocked, setGeoBlocked] = useState(false)
  const [step2Key, setStep2Key] = useState(0)

  const [mapsLink, setMapsLink] = useState('')
  const [mapsLinkLoading, setMapsLinkLoading] = useState(false)
  const [mapsLinkError, setMapsLinkError] = useState('')

  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [confirmAction, setConfirmAction] = useState({
    open: false,
    type: '',
    payload: null,
  })
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  const compassOnceRef = useRef(false)

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

  const showMessage = useCallback((type, text, duration = 3000) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(
      () => setMsgState((state) => ({ ...state, show: false })),
      duration
    )
  }, [])

  useEffect(() => {
    if (!router.isReady || authLoading) return
    if (!isAuthenticated && !isSupplementMode) {
      router.replace(`/login?from=${encodeURIComponent(router.asPath || `/store/edit/${id || ''}`)}`)
      return
    }
    if (!isAdmin && !isSupplementMode) {
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [router.isReady, isAuthenticated, isAdmin, authLoading, id, router, isSupplementMode])

  useEffect(() => {
    if (!router.isReady || !id || !pageReady) return

    async function fetchStore() {
      const stores = await getOrRefreshStores()
      const data = (Array.isArray(stores) ? stores : []).find((entry) => String(entry?.id) === String(id))

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
      setPickedLat(getCoordinateValue(data.latitude))
      setPickedLng(getCoordinateValue(data.longitude))
      setInitialGPSLat(null)
      setInitialGPSLng(null)
      setUserHasEditedMap(false)
      setMapEditable(false)
      setCurrentStep(1)
      setHeading(null)
      setCompassError('')
      setGeoBlocked(false)
      setFieldErrors({})
      compassOnceRef.current = false
    }

    void fetchStore()
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
      compassOnceRef.current = false
      void refreshCompassHeading({ requestPermission: true })
      setResolvingAddr(true)
      const { coords, error } = await getBestPosition({
        maxWaitTime: 2000,
        desiredAccuracy: 15,
        skipCache: true,
      })
      if (!coords) {
        setGeoBlocked(true)
        showMessage('error', getGeoErrorMessage(error))
        return
      }
      setGeoBlocked(false)
      setInitialGPSLat(coords.latitude)
      setInitialGPSLng(coords.longitude)
      setPickedLat(coords.latitude)
      setPickedLng(coords.longitude)
      setUserHasEditedMap(false)
      showMessage('success', 'Đã cập nhật vị trí GPS mới!')
    } catch (err) {
      console.error('Get location error:', err)
      setGeoBlocked(true)
      showMessage('error', getGeoErrorMessage(err))
    } finally {
      setResolvingAddr(false)
    }
  }, [showMessage])

  async function refreshCompassHeading({ requestPermission = false } = {}) {
    if (compassOnceRef.current) return
    compassOnceRef.current = true
    setCompassError('')
    try {
      const { heading: nextHeading, error } = await requestCompassHeading({ requestPermission })
      if (error) setCompassError(error)
      if (nextHeading != null) {
        setHeading((prev) => (prev === nextHeading ? nextHeading + 0.000001 : nextHeading))
      }
    } catch {
      // keep map usable even when heading permission is denied
    }
  }

  const resolvedWardSuggestions = district ? (DISTRICT_WARD_SUGGESTIONS[district] || []) : []

  const originalHasCoordinates = hasStoreCoordinates(store)
  const canSupplementLocation = !originalHasCoordinates && !isTelesale
  const supplementLocks = useMemo(() => buildSupplementLocks(store, canSupplementLocation), [store, canSupplementLocation])
  const supplementSteps = useMemo(() => buildSupplementSteps(canSupplementLocation), [canSupplementLocation])
  const editSteps = useMemo(() => buildEditSteps(), [])
  const hasEditableFields = useMemo(() => hasEditableSupplementFields(supplementLocks), [supplementLocks])

  useEffect(() => {
    if (!isSupplementMode || !canSupplementLocation) return
    if (currentStep !== 3) return
    setGeoBlocked(false)
    setMapEditable(false)
    setUserHasEditedMap(false)
    setPickedLat(null)
    setPickedLng(null)
    setInitialGPSLat(null)
    setInitialGPSLng(null)
    setHeading(null)
    setStep2Key((value) => value + 1)
    if (!resolvingAddr) {
      void handleGetLocation()
    }
  }, [isSupplementMode, canSupplementLocation, currentStep, resolvingAddr, handleGetLocation])

  function applyMapsLinkCoords(lat, lng) {
    setInitialGPSLat(lat)
    setInitialGPSLng(lng)
    setPickedLat(lat)
    setPickedLng(lng)
    setUserHasEditedMap(true)
    setGeoBlocked(false)
    setStep2Key((value) => value + 1)
    showMessage('success', `Đã lấy vị trí: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }

  async function handleMapsLink(link) {
    const trimmed = String(link || '').trim()
    setMapsLink(trimmed)
    setMapsLinkError('')
    if (!trimmed) return

    let coords = extractCoordsFromMapsUrl(trimmed)
    if (coords) {
      applyMapsLinkCoords(coords.lat, coords.lng)
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
      if (!data.success || !data.finalUrl) {
        setMapsLinkError('Không mở được link')
        return
      }
      coords = extractCoordsFromMapsUrl(data.finalUrl)
      if (coords) {
        applyMapsLinkCoords(coords.lat, coords.lng)
      } else {
        setMapsLinkError('Không tìm thấy tọa độ từ link')
      }
    } catch {
      setMapsLinkError('Lỗi khi xử lý link')
    } finally {
      setMapsLinkLoading(false)
    }
  }

  async function validateCurrentPhones({ skipWhenLocked = false } = {}) {
    const shouldReadStores = Boolean(
      phone.trim()
      || phoneSecondary.trim()
      || (skipWhenLocked && (supplementLocks?.phone || supplementLocks?.phoneSecondary))
    )
    const stores = shouldReadStores ? await getOrRefreshStores() : []
    return validateStoreEditPhones({
      phone,
      phoneSecondary,
      store,
      storeId: id,
      stores,
      supplementLocks,
      skipWhenLocked,
    })
  }

  function getResolvedCoordinates() {
    return getFinalCoordinates({
      userHasEditedMap,
      pickedLat,
      pickedLng,
      initialGPSLat,
      initialGPSLng,
    })
  }

  async function executeSaveSupplement(validatedSupplementPhone, validatedSupplementPhoneSecondary) {
    setSaving(true)
    try {
      const nowIso = new Date().toISOString()
      const updates = buildSupplementUpdates({
        supplementLocks,
        values: {
          name,
          storeType,
          addressDetail,
          district,
          ward,
          note,
        },
        validatedPhone: validatedSupplementPhone,
        validatedPhoneSecondary: validatedSupplementPhoneSecondary,
        coordinates: getResolvedCoordinates(),
        nowIso,
      })

      if (Object.keys(updates).length === 0) {
        showMessage('error', 'Bạn chưa bổ sung thêm thông tin nào')
        return
      }

      if (isAdmin) {
        const { error } = await supabase.from('stores').update(updates).eq('id', id)
        if (error) throw error
        const nextStore = { ...store, ...updates }
        await updateStoreInCache(id, updates)
        try {
          const changes = buildStoreDiff(store, updates)
          await logStoreEditHistory({
            storeId: id,
            actionType: 'supplement',
            actorUserId: user?.id,
            changes,
          })
        } catch (err) {
          console.error('store_edit_history supplement failed:', err)
        }
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
          reporter_id: user?.id || null,
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
    if (!hasEditableFields) {
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
      const updates = buildEditUpdates({
        values: {
          name,
          storeType,
          addressDetail,
          ward,
          district,
          note,
        },
        validatedPhone,
        validatedPhoneSecondary,
        active,
        coordinates: getResolvedCoordinates(),
        nowIso,
      })

      const { error } = await supabase.from('stores').update(updates).eq('id', id)
      if (error) throw error
      const nextStore = { ...store, ...updates }
      await updateStoreInCache(id, updates)
      try {
        const changes = buildStoreDiff(store, updates)
        await logStoreEditHistory({
          storeId: id,
          actionType: 'edit',
          actorUserId: user?.id,
          changes,
        })
      } catch (err) {
        console.error('store_edit_history edit failed:', err)
      }
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

  function clearEditFieldErrors(next = {}) {
    setFieldErrors((prev) => ({
      ...prev,
      name: '',
      district: '',
      ward: '',
      phone: '',
      phone_secondary: '',
      ...next,
    }))
  }

  async function handleEditStepChange({ currentStep: step }) {
    if (step === 1) {
      if (!name.trim()) {
        clearEditFieldErrors({ name: 'Vui lòng nhập tên cửa hàng' })
        showMessage('error', 'Tên cửa hàng không được để trống')
        return false
      }
      clearEditFieldErrors()
      return true
    }

    if (step === 2) {
      const nextErrors = {}
      if (!district.trim()) nextErrors.district = 'Vui lòng nhập quận/huyện'
      if (!ward.trim()) nextErrors.ward = 'Vui lòng nhập xã/phường'

      if (Object.keys(nextErrors).length > 0) {
        clearEditFieldErrors(nextErrors)
        showMessage('error', 'Vui lòng nhập đủ quận/huyện và xã/phường')
        return false
      }

      const {
        error: phoneError,
      } = await validateCurrentPhones()
      if (phoneError) {
        const fieldKey = phoneError.includes('2') ? 'phone_secondary' : 'phone'
        clearEditFieldErrors({ [fieldKey]: phoneError })
        showMessage('error', phoneError)
        return false
      }

      clearEditFieldErrors()
      return true
    }

    return true
  }

  async function handleSaveEdit() {
    if (!name.trim()) {
      clearEditFieldErrors({ name: 'Vui lòng nhập tên cửa hàng' })
      showMessage('error', 'Tên cửa hàng không được để trống')
      return
    }
    if (!district.trim() || !ward.trim()) {
      clearEditFieldErrors({
        district: district.trim() ? '' : 'Vui lòng nhập quận/huyện',
        ward: ward.trim() ? '' : 'Vui lòng nhập xã/phường',
      })
      showMessage('error', 'Vui lòng nhập đủ quận/huyện và xã/phường')
      return
    }

    const {
      normalizedPhone: validatedPhone,
      normalizedPhoneSecondary: validatedPhoneSecondary,
      error: phoneError,
    } = await validateCurrentPhones()
    if (phoneError) {
      const fieldKey = phoneError.includes('2') ? 'phone_secondary' : 'phone'
      clearEditFieldErrors({ [fieldKey]: phoneError })
      showMessage('error', phoneError)
      return
    }

    clearEditFieldErrors()
    setConfirmAction({
      open: true,
      type: 'edit',
      payload: { validatedPhone, validatedPhoneSecondary },
    })
  }

  if (authLoading || !pageReady) return <FullPageLoading />

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6">
        <div className="text-center">
          <p className="mb-4 text-red-400">{fetchError}</p>
          <Button onClick={() => router.back()}>Quay lại</Button>
        </div>
      </div>
    )
  }

  if (!store) {
    return <FullPageLoading />
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

  const supplementHeaderContent = (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">Bổ sung cửa hàng</p>
        <OverflowMarquee text={store.name} className="mt-1" textClassName="text-sm text-gray-200" />
      </div>

      {!isAuthenticated ? (
        <div className="rounded-xl border border-amber-900/70 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-200">
          Bạn chưa đăng nhập. Dữ liệu bổ sung sẽ được gửi vào danh sách duyệt thay vì cập nhật trực tiếp.
        </div>
      ) : null}
    </div>
  )

  const editTopContent = (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-800 bg-black/95 px-4 py-3 backdrop-blur">
      <Button
        size="icon"
        variant="ghost"
        onClick={() => router.back()}
        icon={(
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        )}
      />
      <div>
        <h1 className="text-base font-semibold leading-tight text-white">Sửa cửa hàng</h1>
        <OverflowMarquee text={store.name} className="max-w-[200px]" textClassName="text-xs text-gray-400" />
      </div>
    </div>
  )

  if (isSupplementMode) {
    return (
      <>
        <StoreSupplementForm
          router={router}
          msgState={msgState}
          loadingMessage="Đang lưu bổ sung…"
          headerContent={supplementHeaderContent}
          steps={supplementSteps}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          stepCount={supplementSteps.length}
          saving={saving}
          mode="supplement"
          storeType={storeType}
          setStoreType={setStoreType}
          name={name}
          setName={setName}
          district={district}
          setDistrict={setDistrict}
          ward={ward}
          setWard={setWard}
          wardSuggestions={resolvedWardSuggestions}
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
          onLocationChange={handleLocationChange}
          mapEditable={mapEditable}
          setMapEditable={setMapEditable}
          mapKey={step2Key}
          heading={heading}
          compassError={compassError}
          geoBlocked={geoBlocked}
          resolvingAddr={resolvingAddr}
          handleGetLocation={handleGetLocation}
          onReload={() => window.location.reload()}
          mapsLink={mapsLink}
          mapsLinkLoading={mapsLinkLoading}
          mapsLinkError={mapsLinkError}
          setMapsLink={setMapsLink}
          handleMapsLink={handleMapsLink}
          onFinalSubmit={handleSaveSupplement}
          step1SecondaryLabel="Thoát"
          onStep1SecondaryAction={() => router.back()}
          submitLabel={isAuthenticated ? 'Hoàn thành bổ sung' : 'Gửi bổ sung'}
        />
        {confirmDialogNode}
      </>
    )
  }

  return (
    <>
      <StoreSupplementForm
        router={router}
        msgState={msgState}
        loadingMessage="Đang cập nhật cửa hàng…"
        topContent={editTopContent}
        steps={editSteps}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        stepCount={editSteps.length}
        saving={saving}
        mode="edit"
        storeType={storeType}
        setStoreType={setStoreType}
        name={name}
        setName={setName}
        district={district}
        setDistrict={setDistrict}
        ward={ward}
        setWard={setWard}
        wardSuggestions={resolvedWardSuggestions}
        addressDetail={addressDetail}
        setAddressDetail={setAddressDetail}
        phone={phone}
        setPhone={setPhone}
        phoneSecondary={phoneSecondary}
        setPhoneSecondary={setPhoneSecondary}
        note={note}
        setNote={setNote}
        fieldErrors={fieldErrors}
        active={active}
        setActive={setActive}
        showActiveToggle
        pickedLat={pickedLat}
        pickedLng={pickedLng}
        onLocationChange={handleLocationChange}
        mapEditable={mapEditable}
        setMapEditable={setMapEditable}
        mapKey={step2Key}
        heading={heading}
        compassError={compassError}
        geoBlocked={geoBlocked}
        resolvingAddr={resolvingAddr}
        handleGetLocation={handleGetLocation}
        onReload={() => window.location.reload()}
        mapsLink={mapsLink}
        mapsLinkLoading={mapsLinkLoading}
        mapsLinkError={mapsLinkError}
        setMapsLink={setMapsLink}
        handleMapsLink={handleMapsLink}
        onBeforeStepChange={handleEditStepChange}
        onFinalSubmit={handleSaveEdit}
        submitLabel="Lưu thay đổi"
      />
      {confirmDialogNode}
    </>
  )
}
