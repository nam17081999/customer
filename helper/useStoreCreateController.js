import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { toTitleCaseVI } from '@/lib/utils'
import { DISTRICT_WARD_SUGGESTIONS, DEFAULT_STORE_TYPE } from '@/lib/constants'
import { appendStoreToCache, getOrRefreshStores } from '@/lib/storeCache'
import { createStore } from '@/api/stores/store-client'
import { getBestPosition, clearPositionCache, getGeoErrorMessage, requestCompassHeading } from '@/helper/geolocation'
import {
  findNearby50mStores,
  findNoLocationReversedNameMatches,
  mergeDuplicateCandidates,
} from '@/helper/duplicateCheck'
import {
  buildCreateInsertPayload,
  buildCreatePrefillFromRouteQuery,
  getCreateFinalCoordinates,
  resolveMapsLinkCoordinates,
  validateStoreCreateStep2,
} from '@/helper/storeCreateFlow'
import { resolveDistrictWardFromCoordinates } from '@/helper/storeAreaResolver'
import { scrollToFirstMatchingTarget } from '@/helper/formViewport'
import {
  getLocationBootstrapOptions,
  getLocationDuplicateCheckOptions,
  getLocationFallbackSubmitOptions,
  getLocationRefreshOptions,
} from '@/helper/locationPolicy'
import { buildStoreFormLocationPatch } from '@/helper/locationOrchestration'
import { getLocationMapsLinkSuccessMessage, getLocationRefreshSuccessMessage } from '@/helper/locationUi'

export function useStoreCreateController() {
  const router = useRouter()
  const { isAdmin, isTelesale } = useAuth() || {}

  const [name, setName] = useState('')
  const [storeType, setStoreType] = useState(DEFAULT_STORE_TYPE)
  const nameInputRef = useRef(null)
  const [addressDetail, setAddressDetail] = useState('')
  const [ward, setWard] = useState('')
  const [district, setDistrict] = useState('')
  const wardRef = useRef('')
  const districtRef = useRef('')
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  const [phone, setPhone] = useState('')
  const [phoneSecondary, setPhoneSecondary] = useState('')
  const telesaleNoStep3 = Boolean(isTelesale && !isAdmin)
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [duplicateCandidates, setDuplicateCandidates] = useState([])
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false)
  const [duplicateCheckError, setDuplicateCheckError] = useState('')
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const bootstrapDoneRef = useRef(false)
  const userChangedDistrictWardRef = useRef(false)
  const areaPrefillRunningRef = useRef(false)
  const autoFillTimerRef = useRef(null)
  const lastAutoFillCoordsRef = useRef(null)
  const [areaAutoFillStatus, setAreaAutoFillStatus] = useState('idle')
  const [areaAutoFillMessage, setAreaAutoFillMessage] = useState('')

  const [pickedLat, setPickedLat] = useState(null)
  const [pickedLng, setPickedLng] = useState(null)
  const [mapEditable, setMapEditable] = useState(false)
  const [userHasEditedMap, setUserHasEditedMap] = useState(false)
  const [initialGPSLat, setInitialGPSLat] = useState(null)
  const [initialGPSLng, setInitialGPSLng] = useState(null)
  const [heading, setHeading] = useState(null)
  const [compassError, setCompassError] = useState('')
  const compassOnceRef = useRef(false)
  const [geoBlocked, setGeoBlocked] = useState(false)
  const [step2Key, setStep2Key] = useState(0)
  const [mapsLink, setMapsLink] = useState('')
  const [mapsLinkLoading, setMapsLinkLoading] = useState(false)
  const [mapsLinkError, setMapsLinkError] = useState('')
  const [confirmCreate, setConfirmCreate] = useState({
    open: false,
    type: '',
    payload: null,
  })

  const showMessage = useCallback((type, text, duration = 2500) => {
    if (msgTimerRef.current) {
      clearTimeout(msgTimerRef.current)
      msgTimerRef.current = null
    }
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(() => {
      setMsgState((state) => ({ ...state, show: false }))
      msgTimerRef.current = null
    }, duration)
  }, [])

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

  useEffect(() => {
    wardRef.current = ward
  }, [ward])

  useEffect(() => {
    districtRef.current = district
  }, [district])

  const hasUnsavedChanges = useMemo(() => {
    if (loading) return false
    return Boolean(
      name.trim()
      || storeType !== DEFAULT_STORE_TYPE
      || addressDetail.trim()
      || ward.trim()
      || district.trim()
      || phone.trim()
      || phoneSecondary.trim()
      || note.trim()
      || pickedLat != null
      || pickedLng != null
    )
  }, [name, storeType, addressDetail, ward, district, phone, phoneSecondary, note, pickedLat, pickedLng, loading])

  const applyMapsLinkCoords = useCallback((lat, lng) => {
    const patch = buildStoreFormLocationPatch({ lat, lng, userHasEditedMap: true })
    setPickedLat(patch.pickedLat)
    setPickedLng(patch.pickedLng)
    setInitialGPSLat(patch.initialGPSLat)
    setInitialGPSLng(patch.initialGPSLng)
    setUserHasEditedMap(patch.userHasEditedMap)
    setGeoBlocked(patch.geoBlocked)
    setStep2Key((value) => value + 1)
    setMapsLinkError('')
    showMessage('success', getLocationMapsLinkSuccessMessage(lat, lng))
  }, [showMessage])


  const autoFillDistrictWardFromCoordinates = useCallback(async (originLat, originLng) => {
    if (telesaleNoStep3) return
    if (originLat == null || originLng == null) return
    if (areaPrefillRunningRef.current) return
    if (userChangedDistrictWardRef.current) return

    const last = lastAutoFillCoordsRef.current
    if (last && Math.abs(last.lat - originLat) < 0.0001 && Math.abs(last.lng - originLng) < 0.0001) return

    areaPrefillRunningRef.current = true
    lastAutoFillCoordsRef.current = { lat: originLat, lng: originLng }
    try {
      const resolved = await resolveDistrictWardFromCoordinates(originLat, originLng)
      if (userChangedDistrictWardRef.current) return

      const nextDistrict = String(resolved?.district || '').trim()
      const nextWard = String(resolved?.ward || '').trim()
      if (!nextDistrict && !nextWard) {
        setAreaAutoFillStatus('unresolved')
        setAreaAutoFillMessage('Chưa tự xác định được quận/huyện và xã/phường từ vị trí này. Vui lòng chọn tay.')
        return
      }

      if (nextDistrict) setDistrict(nextDistrict)
      if (nextWard) setWard(nextWard)
      setFieldErrors((prev) => ({
        ...prev,
        district: nextDistrict ? '' : prev.district,
        ward: nextWard ? '' : prev.ward,
      }))
    } catch (err) {
      setAreaAutoFillStatus('error')
      setAreaAutoFillMessage('Không tự xác định được khu vực từ vị trí. Bạn vẫn có thể chọn tay.')
      console.error('Auto fill district/ward from coordinates error:', err)
    } finally {
      areaPrefillRunningRef.current = false
    }
  }, [telesaleNoStep3])

  const handleLocationChange = useCallback((lat, lng) => {
    setPickedLat(lat)
    setPickedLng(lng)
    if (mapEditable) {
      setUserHasEditedMap(true)
    }
    if (!userChangedDistrictWardRef.current) {
      if (autoFillTimerRef.current) clearTimeout(autoFillTimerRef.current)
      autoFillTimerRef.current = setTimeout(() => {
        void autoFillDistrictWardFromCoordinates(lat, lng)
      }, 600)
    }
  }, [mapEditable, autoFillDistrictWardFromCoordinates])

  const handleMapsLink = useCallback(async (link) => {
    const trimmed = String(link || '').trim()
    setMapsLink(trimmed)
    setMapsLinkError('')
    if (!trimmed) return

    try {
      setMapsLinkLoading(true)
      const { coords, error } = await resolveMapsLinkCoordinates(trimmed)
      if (coords) {
        applyMapsLinkCoords(coords.lat, coords.lng)
        void autoFillDistrictWardFromCoordinates(coords.lat, coords.lng)
      } else {
        setMapsLinkError(error)
      }
    } finally {
      setMapsLinkLoading(false)
    }
  }, [applyMapsLinkCoords, autoFillDistrictWardFromCoordinates])

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
      // keep map usable when permission is denied
    }
  }, [])

  const handleGetLocation = useCallback(async () => {
    try {
      compassOnceRef.current = false
      void refreshCompassHeading({ requestPermission: true })
      clearPositionCache()
      setResolvingAddr(true)
      const { coords, error } = await getBestPosition({ ...getLocationRefreshOptions(), anchorCoords: pickedLat != null && pickedLng != null ? { latitude: pickedLat, longitude: pickedLng } : null })
      if (!coords) {
        setGeoBlocked(true)
        showMessage('error', getGeoErrorMessage(error))
        return
      }
      const patch = buildStoreFormLocationPatch({ lat: coords.latitude, lng: coords.longitude, userHasEditedMap: false })
      setGeoBlocked(patch.geoBlocked)
      setInitialGPSLat(patch.initialGPSLat)
      setInitialGPSLng(patch.initialGPSLng)
      setPickedLat(patch.pickedLat)
      setPickedLng(patch.pickedLng)
      setUserHasEditedMap(patch.userHasEditedMap)
      setStep2Key((value) => value + 1)
      setAreaAutoFillStatus('idle')
      setAreaAutoFillMessage('')
      void autoFillDistrictWardFromCoordinates(coords.latitude, coords.longitude)
      showMessage('success', getLocationRefreshSuccessMessage())
    } catch (err) {
      console.error('Get location error:', err)
      setGeoBlocked(true)
      showMessage('error', getGeoErrorMessage(err))
    } finally {
      setResolvingAddr(false)
    }
  }, [autoFillDistrictWardFromCoordinates, pickedLat, pickedLng, refreshCompassHeading, showMessage])

  useEffect(() => {
    if (!router.isReady) return
    const { name: qName } = buildCreatePrefillFromRouteQuery(router.query)
    if (qName) {
      setName(toTitleCaseVI(qName))
      setFieldErrors((prev) => ({ ...prev, name: '' }))
    }
  }, [router.isReady, router.query])

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }) } catch { /* noop */ }
  }, [])

  useEffect(() => {
    if (bootstrapDoneRef.current) return
    if (pickedLat != null && pickedLng != null) return
    bootstrapDoneRef.current = true

    void (async () => {
      try {
        setResolvingAddr(true)
        const { coords, error } = await getBestPosition(getLocationBootstrapOptions())
        if (!coords) {
          setGeoBlocked(true)
          return
        }
        const patch = buildStoreFormLocationPatch({ lat: coords.latitude, lng: coords.longitude, userHasEditedMap: false })
        setGeoBlocked(patch.geoBlocked)
        setInitialGPSLat(patch.initialGPSLat)
        setInitialGPSLng(patch.initialGPSLng)
        setPickedLat(patch.pickedLat)
        setPickedLng(patch.pickedLng)
        setUserHasEditedMap(patch.userHasEditedMap)
        setStep2Key((value) => value + 1)
        void autoFillDistrictWardFromCoordinates(coords.latitude, coords.longitude)
      } catch (err) {
        console.error('Bootstrap location error:', err)
        setGeoBlocked(true)
      } finally {
        setResolvingAddr(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    const onRouteChangeStart = (nextUrl) => {
      if (!hasUnsavedChanges) return
      if (nextUrl === router.asPath) return
      const ok = window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn rời trang?')
      if (ok) return
      router.events.emit('routeChangeError')
      throw 'storevis-route-change-aborted'
    }

    router.events.on('routeChangeStart', onRouteChangeStart)
    return () => router.events.off('routeChangeStart', onRouteChangeStart)
  }, [hasUnsavedChanges, router])

  useEffect(() => {
    if (!name.trim()) {
      setDuplicateCandidates([])
      setDuplicateCheckError('')
      setDuplicateCheckLoading(false)
      setAllowDuplicate(false)
      return
    }

    setDuplicateCandidates([])
    setDuplicateCheckError('')
    setAllowDuplicate(false)
  }, [name])

  useEffect(() => {
    setAllowDuplicate(false)
  }, [name])

  useEffect(() => {
    if (district && !DISTRICT_WARD_SUGGESTIONS[district]) {
      setWard('')
    }
  }, [district])

  useEffect(() => {
    setAllowDuplicate(false)
    if (!name.trim() || pickedLat == null || pickedLng == null) {
      setDuplicateCandidates([])
      setDuplicateCheckError('')
      setDuplicateCheckLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      setDuplicateCheckLoading(true)
      setDuplicateCheckError('')
      try {
        const [nearby, noLocation] = await Promise.all([
          findNearby50mStores(pickedLat, pickedLng, name),
          findNoLocationReversedNameMatches(name),
        ])
        const matches = mergeDuplicateCandidates(nearby, noLocation, pickedLat, pickedLng)
        setDuplicateCandidates(matches)
      } catch (err) {
        console.error('Duplicate check error:', err)
        setDuplicateCandidates([])
        setDuplicateCheckError('Không kiểm tra được trùng tên.')
      } finally {
        setDuplicateCheckLoading(false)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [name, pickedLat, pickedLng])

  const resetCreateForm = useCallback(() => {
    setName('')
    setStoreType(DEFAULT_STORE_TYPE)
    setAddressDetail('')
    setWard('')
    setDistrict('')
    setPhone('')
    setPhoneSecondary('')
    setNote('')
    setAllowDuplicate(false)
    setDuplicateCandidates([])
    setDuplicateCheckError('')
    setDuplicateCheckLoading(false)
    setPickedLat(null)
    setPickedLng(null)
    setMapEditable(false)
    setUserHasEditedMap(false)
    setInitialGPSLat(null)
    setInitialGPSLng(null)
    setCompassError('')
    compassOnceRef.current = false
    setGeoBlocked(false)
    setStep2Key((value) => value + 1)
    setMapsLink('')
    setMapsLinkError('')
    setFieldErrors({})
    setAreaAutoFillStatus('idle')
    setAreaAutoFillMessage('')
    userChangedDistrictWardRef.current = false
    areaPrefillRunningRef.current = false
    lastAutoFillCoordsRef.current = null

    if (router.query?.name || router.query?.step) {
      const { name: _discardName, step: _discardStep, ...rest } = router.query
      void router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true }).catch((err) => {
        if (err?.cancelled) return
        console.error('Failed to clean create query params:', err)
        void router.replace(router.pathname).catch((fallbackErr) => {
          if (!fallbackErr?.cancelled) {
            console.error('Fallback route cleanup failed:', fallbackErr)
          }
        })
      })
    }
  }, [router])

  const markUserChangedDistrictWard = useCallback(() => {
    userChangedDistrictWardRef.current = true
  }, [])

  const handleKeepCreateDuplicate = useCallback(() => {
    setAllowDuplicate(true)
  }, [])

  const validateStep2Fields = useCallback(async ({ requirePhone = false } = {}) => {
    const stores = (phone.trim() || phoneSecondary.trim()) ? await getOrRefreshStores() : []
    const result = validateStoreCreateStep2({
      district,
      ward,
      phone,
      phoneSecondary,
      stores,
      requirePhone,
    })

    setFieldErrors((prev) => ({
      ...prev,
      district: result.fieldErrors.district || '',
      ward: result.fieldErrors.ward || '',
      phone: result.fieldErrors.phone || '',
      phone_secondary: result.fieldErrors.phone_secondary || '',
    }))

    return result
  }, [district, ward, phone, phoneSecondary])

  const scrollCreateStep2Error = useCallback((fieldErrors = {}) => {
    const selectors = []

    if (fieldErrors.phone) selectors.push('#phone')
    if (fieldErrors.phone_secondary) selectors.push('#phone-secondary')
    if (fieldErrors.district) selectors.push('#create-district-section')
    if (fieldErrors.ward) selectors.push('#create-ward-section')

    scrollToFirstMatchingTarget(selectors)
  }, [])

  const persistStore = useCallback(async ({ latitude = null, longitude = null, shouldCheckFinalDuplicates = true } = {}) => {
    const normalizedName = toTitleCaseVI(name.trim())
    const hasConfirmedNameDuplicate = allowDuplicate
    let storesForPhoneDupes = null

    const getStoresForPhoneDupes = async () => {
      if (!storesForPhoneDupes) {
        storesForPhoneDupes = await getOrRefreshStores()
      }
      return storesForPhoneDupes
    }

    try {
      setLoading(true)

      const stores = (phone.trim() || phoneSecondary.trim()) ? await getStoresForPhoneDupes() : []
      const validationResult = validateStoreCreateStep2({
        district,
        ward,
        phone,
        phoneSecondary,
        stores,
        requirePhone: false,
      })

      setFieldErrors((prev) => ({
        ...prev,
        district: validationResult.fieldErrors.district || '',
        ward: validationResult.fieldErrors.ward || '',
        phone: validationResult.fieldErrors.phone || '',
        phone_secondary: validationResult.fieldErrors.phone_secondary || '',
      }))

      if (Object.keys(validationResult.fieldErrors).length > 0) {
        const firstError = validationResult.fieldErrors.phone
          || validationResult.fieldErrors.phone_secondary
          || validationResult.fieldErrors.district
          || validationResult.fieldErrors.ward
          || 'Vui lòng kiểm tra lại thông tin'
        showMessage('error', firstError)
        scrollCreateStep2Error(validationResult.fieldErrors)
        setLoading(false)
        return false
      }

      if (shouldCheckFinalDuplicates && !hasConfirmedNameDuplicate) {
        let nearDupes = []
        let noLocationDupes = []
        try {
          ;[nearDupes, noLocationDupes] = await Promise.all([
            findNearby50mStores(latitude, longitude, normalizedName),
            findNoLocationReversedNameMatches(normalizedName),
          ])
        } catch (dupErr) {
          console.error('Duplicate check failed:', dupErr)
          showMessage('error', 'Không kiểm tra được trùng tên. Vui lòng thử lại.')
          setLoading(false)
          return false
        }

        const allDupes = mergeDuplicateCandidates(nearDupes, noLocationDupes, latitude, longitude)
        if (allDupes.length > 0 && !allowDuplicate) {
          setDuplicateCandidates(allDupes)
          showMessage('error', 'Phát hiện cửa hàng trùng/tương tự theo tên (gần đây hoặc toàn hệ thống). Vui lòng xác nhận nếu vẫn muốn tạo.')
          setLoading(false)
          return false
        }
      }

      const insertPayload = buildCreateInsertPayload({
        values: {
          name: normalizedName,
          storeType: storeType || DEFAULT_STORE_TYPE,
          addressDetail,
          ward,
          district,
          note,
        },
        validatedPhone: validationResult.normalizedPhone,
        validatedPhoneSecondary: validationResult.normalizedPhoneSecondary,
        latitude,
        longitude,
        isAdmin,
        isTelesale,
      })

      const { data: insertedRows, error: insertError } = await createStore(insertPayload)

      if (insertError) {
        console.error(insertError)
        showMessage('error', 'Lỗi khi lưu dữ liệu')
        setLoading(false)
        return false
      }

      const newStore = insertedRows?.[0]
      if (!newStore?.id) {
        console.error('Insert succeeded without returned row. Possible RLS select restriction or stale session.', {
          insertPayload,
          insertedRows,
        })
        showMessage('error', 'Tạo cửa hàng chưa hoàn tất. Không nhận được dữ liệu trả về từ máy chủ.')
        setLoading(false)
        return false
      }

      await appendStoreToCache(newStore)
      await pushSearchWithNotice('Tạo cửa hàng thành công!')
      return true
    } catch (err) {
      console.error(err)
      showMessage('error', 'Đã xảy ra lỗi khi tạo cửa hàng')
      return false
    } finally {
      setLoading(false)
    }
  }, [
    name,
    phone,
    phoneSecondary,
    district,
    ward,
    addressDetail,
    note,
    allowDuplicate,
    storeType,
    isAdmin,
    isTelesale,
    pushSearchWithNotice,
    showMessage,
    scrollCreateStep2Error,
  ])

  const handleConfirmCreate = useCallback(async () => {
    const payload = confirmCreate.payload
    if (!payload) return
    setConfirmCreate({ open: false, type: '', payload: null })
    await persistStore(payload)
  }, [confirmCreate.payload, persistStore])

  const dismissConfirmCreate = useCallback(() => {
    setConfirmCreate({ open: false, type: '', payload: null })
  }, [])

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault()

    if (!name.trim()) {
      setFieldErrors((prev) => ({ ...prev, name: 'Vui lòng nhập tên cửa hàng' }))
      scrollToFirstMatchingTarget(['#name'])
      return
    }

    if (!district || !ward) {
      showMessage('error', 'Vui lòng chọn quận/huyện và xã/phường')
      scrollToFirstMatchingTarget([
        !district ? '#create-district-section' : null,
        !ward ? '#create-ward-section' : null,
      ])
      return
    }

    const { fieldErrors: nextFieldErrors } = await validateStep2Fields({ requirePhone: telesaleNoStep3 })
    if (Object.keys(nextFieldErrors).length > 0) {
      showMessage(
        'error',
        nextFieldErrors.phone || nextFieldErrors.phone_secondary
          ? 'Vui lòng kiểm tra lại số điện thoại'
          : 'Vui lòng nhập đủ quận/huyện và xã/phường'
      )
      scrollCreateStep2Error(nextFieldErrors)
      return
    }

    if (!allowDuplicate && duplicateCandidates.length > 0) {
      showMessage('error', 'Phát hiện cửa hàng trùng/tương tự. Vui lòng xác nhận nếu vẫn muốn tạo.')
      return
    }

    let { latitude, longitude } = getCreateFinalCoordinates({
      userHasEditedMap,
      pickedLat,
      pickedLng,
      initialGPSLat,
      initialGPSLng,
    })

    if (latitude == null || longitude == null) {
      if (telesaleNoStep3) {
        setConfirmCreate({
          open: true,
          type: 'quick-save',
          payload: {
            latitude: null,
            longitude: null,
            shouldCheckFinalDuplicates: false,
          },
        })
        return
      }

      try {
        const { coords, error } = await getBestPosition(getLocationFallbackSubmitOptions())
        if (!coords) {
          setGeoBlocked(true)
          showMessage('error', getGeoErrorMessage(error))
          scrollToFirstMatchingTarget(['#create-location-section'])
          return
        }
        setGeoBlocked(false)
        latitude = coords.latitude
        longitude = coords.longitude
      } catch (geoErr) {
        console.error('Không lấy được tọa độ:', geoErr)
        showMessage('error', getGeoErrorMessage(geoErr))
        return
      }
    }

    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      showMessage('error', 'Thiếu thông tin vị trí. Vui lòng bật "Địa chỉ tự động" hoặc dán link Google Maps hoặc mở khóa bản đồ và chọn vị trí')
      return
    }

    setConfirmCreate({
      open: true,
      type: 'create',
      payload: {
        latitude,
        longitude,
        shouldCheckFinalDuplicates: true,
      },
    })
  }, [
    allowDuplicate,
    duplicateCandidates,
    userHasEditedMap,
    pickedLat,
    pickedLng,
    initialGPSLat,
    initialGPSLng,
    showMessage,
    scrollCreateStep2Error,
    validateStep2Fields,
    name,
    district,
    ward,
    telesaleNoStep3,
  ])

  return {
    router,
    isAdmin,
    isTelesale,
    telesaleNoStep3,
    name,
    setName,
    storeType,
    setStoreType,
    nameInputRef,
    addressDetail,
    setAddressDetail,
    ward,
    setWard,
    district,
    setDistrict,
    msgState,
    phone,
    setPhone,
    phoneSecondary,
    setPhoneSecondary,
    note,
    setNote,
    fieldErrors,
    setFieldErrors,
    loading,
    resolvingAddr,
    duplicateCandidates,
    duplicateCheckLoading,
    duplicateCheckError,
    allowDuplicate,
    pickedLat,
    pickedLng,
    mapEditable,
    setMapEditable,
    initialGPSLat,
    initialGPSLng,
    heading,
    compassError,
    geoBlocked,
    step2Key,
    mapsLink,
    setMapsLink,
    mapsLinkLoading,
    mapsLinkError,
    areaAutoFillStatus,
    areaAutoFillMessage,
    confirmCreate,
    dismissConfirmCreate,
    handleMapsLink,
    handleLocationChange,
    handleGetLocation,
    handleKeepCreateDuplicate,
    markUserChangedDistrictWard,
    handleConfirmCreate,
    handleSubmit,
    resetCreateForm,
  }
}
