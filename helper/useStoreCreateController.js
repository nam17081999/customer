import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { toTitleCaseVI } from '@/lib/utils'
import { DISTRICT_WARD_SUGGESTIONS, DEFAULT_STORE_TYPE } from '@/lib/constants'
import { appendStoreToCache, getOrRefreshStores } from '@/lib/storeCache'
import { getBestPosition, getGeoErrorMessage, requestCompassHeading } from '@/helper/geolocation'
import {
  findNearbySimilarStores,
  findGlobalExactNameMatches,
  mergeDuplicateCandidates,
} from '@/helper/duplicateCheck'
import {
  buildCreateInsertPayload,
  findNearestDistrictWard,
  getCreateFinalCoordinates,
  resolveMapsLinkCoordinates,
  validateStoreCreateStep2,
} from '@/helper/storeCreateFlow'
import { useStepEntryEffect } from '@/helper/useStepEntryEffect'
import { scrollToFirstMatchingTarget } from '@/helper/formViewport'

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
  const [currentStep, setCurrentStep] = useState(1)
  const [duplicateCandidates, setDuplicateCandidates] = useState([])
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false)
  const [duplicateCheckError, setDuplicateCheckError] = useState('')
  const [duplicateCheckDone, setDuplicateCheckDone] = useState(false)
  const [nameValid, setNameValid] = useState(false)
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [duplicateCheckLat, setDuplicateCheckLat] = useState(null)
  const [duplicateCheckLng, setDuplicateCheckLng] = useState(null)
  const duplicateCheckSeqRef = useRef(0)
  const duplicateGeoRequestedRef = useRef(false)
  const nearestLocationPrefilledRef = useRef(false)
  const nearestLocationPrefillRunningRef = useRef(false)

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
      || currentStep !== 1
    )
  }, [name, storeType, addressDetail, ward, district, phone, phoneSecondary, note, pickedLat, pickedLng, currentStep, loading])

  const applyMapsLinkCoords = useCallback((lat, lng) => {
    setPickedLat(lat)
    setPickedLng(lng)
    setInitialGPSLat(lat)
    setInitialGPSLng(lng)
    setUserHasEditedMap(true)
    setGeoBlocked(false)
    setStep2Key((value) => value + 1)
    setMapsLinkError('')
    showMessage('success', `Đã lấy vị trí: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }, [showMessage])

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
      } else {
        setMapsLinkError(error)
      }
    } finally {
      setMapsLinkLoading(false)
    }
  }, [applyMapsLinkCoords])

  const handleLocationChange = useCallback((lat, lng) => {
    setPickedLat(lat)
    setPickedLng(lng)
    if (mapEditable) {
      setUserHasEditedMap(true)
    }
  }, [mapEditable])

  const autoFillNearestDistrictWard = useCallback(async (originLat, originLng) => {
    if (telesaleNoStep3) return
    if (nearestLocationPrefilledRef.current || nearestLocationPrefillRunningRef.current) return
    if (district.trim() || ward.trim()) return
    if (originLat == null || originLng == null) return

    nearestLocationPrefillRunningRef.current = true
    try {
      const stores = await getOrRefreshStores()
      const nearestStore = findNearestDistrictWard(stores, originLat, originLng)
      if (!nearestStore) return
      if (districtRef.current.trim() || wardRef.current.trim()) return
      const nextDistrict = nearestStore.district
      const nextWard = nearestStore.ward

      if (nearestLocationPrefilledRef.current || district.trim() || ward.trim()) {
        return
      }

      setDistrict(nextDistrict)
      setWard(nextWard)
      setFieldErrors((prev) => ({
        ...prev,
        district: '',
        ward: '',
      }))
      nearestLocationPrefilledRef.current = true
      showMessage('success', 'Đã tự chọn quận/huyện và xã/phường gần nhất')
    } catch (err) {
      console.error('Auto fill nearest district/ward error:', err)
    } finally {
      nearestLocationPrefillRunningRef.current = false
    }
  }, [district, ward, telesaleNoStep3, showMessage])

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
      showMessage('success', 'Đã cập nhật vị trí GPS mới')
    } catch (err) {
      console.error('Get location error:', err)
      setGeoBlocked(true)
      showMessage('error', getGeoErrorMessage(err))
    } finally {
      setResolvingAddr(false)
    }
  }, [refreshCompassHeading, showMessage])

  useEffect(() => {
    const qName = typeof router.query.name === 'string' ? router.query.name.trim() : ''
    if (qName) setName(toTitleCaseVI(qName))
  }, [router.query.name])

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }) } catch { /* noop */ }
  }, [])

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }) } catch { /* noop */ }
  }, [currentStep])

  useEffect(() => {
    if (currentStep === 1 && nameInputRef.current) {
      try { nameInputRef.current.focus() } catch { /* noop */ }
    }
  }, [currentStep])

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
      const ok = window.confirm('Bạn có dữ liệu chưa lưu. Bạn có chắc muốn rời trang?')
      if (ok) return
      router.events.emit('routeChangeError')
      const err = new Error('Route change aborted by user')
      err.cancelled = true
      throw err
    }

    router.events.on('routeChangeStart', onRouteChangeStart)
    return () => router.events.off('routeChangeStart', onRouteChangeStart)
  }, [hasUnsavedChanges, router])

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
    setDuplicateCheckDone(false)
    setNameValid(false)
    setDuplicateCheckLat(null)
    setDuplicateCheckLng(null)
    duplicateGeoRequestedRef.current = false
    setCurrentStep(1)
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
    nearestLocationPrefilledRef.current = false
    nearestLocationPrefillRunningRef.current = false

    if (router.query?.name) {
      const { name: _discard, ...rest } = router.query
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

  const handleFillAddress = useCallback(async () => {
    try {
      setResolvingAddr(true)
      const { coords, error } = await getBestPosition({
        maxWaitTime: 2000,
        desiredAccuracy: 15,
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
    } catch (err) {
      console.error('Get location error:', err)
      showMessage('error', getGeoErrorMessage(err))
    } finally {
      setResolvingAddr(false)
    }
  }, [showMessage])

  const bootstrapCreateLocationStep = useCallback(async () => {
    setGeoBlocked(false)
    setMapEditable(false)
    setUserHasEditedMap(false)
    setPickedLat(null)
    setPickedLng(null)
    setInitialGPSLat(null)
    setInitialGPSLng(null)
    setHeading(null)
    setStep2Key((value) => value + 1)
    await handleFillAddress()
  }, [handleFillAddress])

  useStepEntryEffect(currentStep === 3, bootstrapCreateLocationStep)

  useEffect(() => {
    if (!name.trim()) {
      setDuplicateCandidates([])
      setDuplicateCheckError('')
      setDuplicateCheckLoading(false)
      setDuplicateCheckDone(false)
      setDuplicateCheckLat(null)
      setDuplicateCheckLng(null)
      duplicateGeoRequestedRef.current = false
      setNameValid(false)
      return
    }

    setDuplicateCandidates([])
    setDuplicateCheckError('')
    setDuplicateCheckDone(false)
    setNameValid(false)
  }, [name])

  useEffect(() => {
    setAllowDuplicate(false)
    setDuplicateCheckDone(false)
    setNameValid(false)
  }, [name])

  useEffect(() => {
    if (district && !DISTRICT_WARD_SUGGESTIONS[district]) {
      setWard('')
    }
  }, [district])

  const runDuplicateCheckByButton = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setFieldErrors((prev) => ({ ...prev, name: 'Vui lòng nhập tên cửa hàng' }))
      scrollToFirstMatchingTarget(['#name'])
      return
    }

    setFieldErrors((prev) => ({ ...prev, name: '' }))
    let checkLat = duplicateCheckLat
    let checkLng = duplicateCheckLng

    if (checkLat == null || checkLng == null) {
      duplicateGeoRequestedRef.current = true
      try {
        setDuplicateCheckLoading(true)
        const { coords, error } = await getBestPosition({
          maxWaitTime: 2000,
          desiredAccuracy: 50,
        })
        if (!coords) {
          setDuplicateCheckError(getGeoErrorMessage(error))
          setDuplicateCheckLoading(false)
          return
        }
        checkLat = coords.latitude
        checkLng = coords.longitude
        setDuplicateCheckLat(checkLat)
        setDuplicateCheckLng(checkLng)
      } catch (err) {
        console.error('Get location error:', err)
        setDuplicateCheckError(getGeoErrorMessage(err))
        setDuplicateCheckLoading(false)
        return
      }
    }

    void autoFillNearestDistrictWard(checkLat, checkLng)

    const seq = ++duplicateCheckSeqRef.current
    setDuplicateCheckLoading(true)
    setDuplicateCheckError('')
    try {
      const [nearMatches, globalMatches] = await Promise.all([
        findNearbySimilarStores(checkLat, checkLng, trimmed),
        findGlobalExactNameMatches(trimmed),
      ])
      const matches = mergeDuplicateCandidates(nearMatches, globalMatches, checkLat, checkLng)
      if (seq !== duplicateCheckSeqRef.current) return
      setDuplicateCandidates(matches)
      setAllowDuplicate(false)
      setDuplicateCheckDone(true)
      const ok = matches.length === 0
      setNameValid(ok)
      if (ok) setCurrentStep(2)
    } catch (err) {
      if (seq !== duplicateCheckSeqRef.current) return
      console.error('Duplicate check error:', err)
      setDuplicateCandidates([])
      setDuplicateCheckError('Không kiểm tra được trùng tên (gần đây/toàn hệ thống).')
      setDuplicateCheckDone(false)
      setNameValid(false)
    } finally {
      if (seq === duplicateCheckSeqRef.current) setDuplicateCheckLoading(false)
    }
  }, [name, duplicateCheckLat, duplicateCheckLng, autoFillNearestDistrictWard])

  const handleStep1Next = useCallback(() => {
    if (!duplicateCheckDone) {
      void runDuplicateCheckByButton()
      return
    }
    if (nameValid || allowDuplicate) setCurrentStep(2)
  }, [duplicateCheckDone, runDuplicateCheckByButton, nameValid, allowDuplicate])

  const handleKeepCreateDuplicate = useCallback(() => {
    setAllowDuplicate(true)
    setCurrentStep(2)
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
  const validateStep2AndGoNext = useCallback(async () => {
    const { fieldErrors: nextFieldErrors } = await validateStep2Fields({ requirePhone: telesaleNoStep3 })
    if (Object.keys(nextFieldErrors).length > 0) {
      showMessage(
        'error',
        nextFieldErrors.phone || nextFieldErrors.phone_secondary
          ? 'Vui lòng kiểm tra lại số điện thoại'
          : 'Vui lòng nhập đủ quận/huyện và xã/phường'
      )
      scrollCreateStep2Error(nextFieldErrors)
      return false
    }

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
      return true
    }

    compassOnceRef.current = false
    void refreshCompassHeading({ requestPermission: true })
    setCurrentStep(3)
    return true
  }, [validateStep2Fields, telesaleNoStep3, showMessage, refreshCompassHeading, scrollCreateStep2Error])

  const persistStore = useCallback(async ({ latitude = null, longitude = null, shouldCheckFinalDuplicates = true } = {}) => {
    const normalizedName = toTitleCaseVI(name.trim())
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

      if (shouldCheckFinalDuplicates) {
        let nearDupes = []
        let globalDupes = []
        try {
          ;[nearDupes, globalDupes] = await Promise.all([
            findNearbySimilarStores(latitude, longitude, normalizedName),
            findGlobalExactNameMatches(normalizedName),
          ])
        } catch (dupErr) {
          console.error('Duplicate check failed:', dupErr)
          showMessage('error', 'Không kiểm tra được trùng tên (gần đây/toàn hệ thống). Vui lòng thử lại.')
          setLoading(false)
          return false
        }

        const allDupes = mergeDuplicateCandidates(nearDupes, globalDupes, latitude, longitude)
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

      const { data: insertedRows, error: insertError } = await supabase
        .from('stores')
        .insert([insertPayload])
        .select('id,name,store_type,address_detail,ward,district,phone,phone_secondary,note,latitude,longitude,active,is_potential,created_at,updated_at,last_called_at,last_call_result,last_call_result_at,last_order_reported_at,sales_note')

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
    if (currentStep !== 3) {
      if (currentStep === 1) {
        await runDuplicateCheckByButton()
      } else if (currentStep === 2) {
        await validateStep2AndGoNext()
      }
      return
    }
    if (resolvingAddr) {
      showMessage('info', 'Đang lấy vị trí, vui lòng đợi')
      return
    }
    if (!name || !district || !ward) {
      showMessage('error', 'Tên, quận/huyện và xã/phường là bắt buộc')
      scrollToFirstMatchingTarget([
        !name ? '#name' : null,
        !district ? '#create-district-section' : null,
        !ward ? '#create-ward-section' : null,
      ])
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
      try {
        const { coords, error } = await getBestPosition({ maxWaitTime: 3000, desiredAccuracy: 15 })
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
    currentStep,
    runDuplicateCheckByButton,
    validateStep2AndGoNext,
    resolvingAddr,
    name,
    district,
    ward,
    userHasEditedMap,
    pickedLat,
    pickedLng,
    initialGPSLat,
    initialGPSLng,
    showMessage,
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
    currentStep,
    setCurrentStep,
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
    confirmCreate,
    dismissConfirmCreate,
    handleMapsLink,
    handleLocationChange,
    handleGetLocation,
    handleStep1Next,
    validateStep2AndGoNext,
    handleKeepCreateDuplicate,
    handleConfirmCreate,
    handleSubmit,
    resetCreateForm,
  }
}



