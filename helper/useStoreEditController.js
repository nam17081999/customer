import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
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
import { useStepEntryEffect } from '@/helper/useStepEntryEffect'

function getCoordinateValue(value) {
  return Number.isFinite(value) ? value : null
}

export function useStoreEditController() {
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

  const refreshCompassHeading = useCallback(async ({ requestPermission = false } = {}) => {
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
  }, [])

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
  }, [refreshCompassHeading, showMessage])

  const resolvedWardSuggestions = district ? (DISTRICT_WARD_SUGGESTIONS[district] || []) : []

  const originalHasCoordinates = hasStoreCoordinates(store)
  const canSupplementLocation = !originalHasCoordinates && !isTelesale
  const supplementLocks = useMemo(() => buildSupplementLocks(store, canSupplementLocation), [store, canSupplementLocation])
  const supplementSteps = useMemo(() => buildSupplementSteps(canSupplementLocation), [canSupplementLocation])
  const editSteps = useMemo(() => buildEditSteps(), [])
  const hasEditableFields = useMemo(() => hasEditableSupplementFields(supplementLocks), [supplementLocks])

  const bootstrapSupplementLocationStep = useCallback(async () => {
    setGeoBlocked(false)
    setMapEditable(false)
    setUserHasEditedMap(false)
    setPickedLat(null)
    setPickedLng(null)
    setInitialGPSLat(null)
    setInitialGPSLng(null)
    setHeading(null)
    setStep2Key((value) => value + 1)
    await handleGetLocation()
  }, [handleGetLocation])

  useStepEntryEffect(
    isSupplementMode && canSupplementLocation && currentStep === 3,
    bootstrapSupplementLocationStep
  )

  const applyMapsLinkCoords = useCallback((lat, lng) => {
    setInitialGPSLat(lat)
    setInitialGPSLng(lng)
    setPickedLat(lat)
    setPickedLng(lng)
    setUserHasEditedMap(true)
    setGeoBlocked(false)
    setStep2Key((value) => value + 1)
    showMessage('success', `Đã lấy vị trí: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }, [showMessage])

  const handleMapsLink = useCallback(async (link) => {
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
  }, [applyMapsLinkCoords])

  const validateCurrentPhones = useCallback(async ({ skipWhenLocked = false } = {}) => {
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
  }, [phone, phoneSecondary, supplementLocks, store, id])

  const getResolvedCoordinates = useCallback(() => {
    return getFinalCoordinates({
      userHasEditedMap,
      pickedLat,
      pickedLng,
      initialGPSLat,
      initialGPSLng,
    })
  }, [userHasEditedMap, pickedLat, pickedLng, initialGPSLat, initialGPSLng])

  const executeSaveSupplement = useCallback(async (validatedSupplementPhone, validatedSupplementPhoneSecondary) => {
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
  }, [
    supplementLocks,
    name,
    storeType,
    addressDetail,
    district,
    ward,
    note,
    getResolvedCoordinates,
    isAdmin,
    id,
    store,
    user?.id,
    pushSearchWithNotice,
    showMessage,
  ])

  const handleSaveSupplement = useCallback(async () => {
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
  }, [hasEditableFields, showMessage, validateCurrentPhones])

  const executeEditSave = useCallback(async (validatedPhone, validatedPhoneSecondary) => {
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
  }, [
    name,
    storeType,
    addressDetail,
    ward,
    district,
    note,
    active,
    getResolvedCoordinates,
    id,
    store,
    user?.id,
    pushSearchWithNotice,
    showMessage,
  ])

  const handleConfirmAction = useCallback(async () => {
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
  }, [confirmAction.payload, confirmAction.type, executeSaveSupplement, executeEditSave])

  const dismissConfirmAction = useCallback(() => {
    setConfirmAction({ open: false, type: '', payload: null })
  }, [])

  const clearEditFieldErrors = useCallback((next = {}) => {
    setFieldErrors((prev) => ({
      ...prev,
      name: '',
      district: '',
      ward: '',
      phone: '',
      phone_secondary: '',
      ...next,
    }))
  }, [])

  const handleEditStepChange = useCallback(async ({ currentStep: step }) => {
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

      const { error: phoneError } = await validateCurrentPhones()
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
  }, [name, district, ward, clearEditFieldErrors, showMessage, validateCurrentPhones])

  const handleSaveEdit = useCallback(async () => {
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
  }, [name, district, ward, clearEditFieldErrors, showMessage, validateCurrentPhones])

  return {
    router,
    id,
    user,
    isAdmin,
    isTelesale,
    isAuthenticated,
    authLoading,
    isSupplementMode,
    pageReady,
    store,
    fetchError,
    name,
    setName,
    storeType,
    setStoreType,
    addressDetail,
    setAddressDetail,
    ward,
    setWard,
    district,
    setDistrict,
    phone,
    setPhone,
    phoneSecondary,
    setPhoneSecondary,
    note,
    setNote,
    active,
    setActive,
    fieldErrors,
    pickedLat,
    pickedLng,
    mapEditable,
    setMapEditable,
    heading,
    compassError,
    geoBlocked,
    resolvingAddr,
    step2Key,
    mapsLink,
    setMapsLink,
    mapsLinkLoading,
    mapsLinkError,
    saving,
    currentStep,
    setCurrentStep,
    msgState,
    confirmAction,
    resolvedWardSuggestions,
    canSupplementLocation,
    supplementLocks,
    supplementSteps,
    editSteps,
    hasEditableFields,
    handleLocationChange,
    handleGetLocation,
    handleMapsLink,
    handleSaveSupplement,
    handleConfirmAction,
    dismissConfirmAction,
    handleEditStepChange,
    handleSaveEdit,
  }
}
