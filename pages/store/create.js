import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toTitleCaseVI, formatAddressParts } from '@/lib/utils'
import {
  DISTRICT_WARD_SUGGESTIONS,
  DISTRICT_SUGGESTIONS,
  STORE_TYPE_OPTIONS,
  DEFAULT_STORE_TYPE,
} from '@/lib/constants'
// browser-image-compression is dynamically imported at usage point to reduce bundle size
import { Msg } from '@/components/ui/msg'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { findDuplicatePhoneStores, formatDistance, validateVietnamPhone } from '@/helper/validation'
import SearchStoreCard from '@/components/search-store-card'
import StoreFormStepIndicator from '@/components/store/store-form-step-indicator'
import StoreMapsLinkFields from '@/components/store/store-maps-link-fields'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { invalidateStoreCache, appendStoreToCache, getOrRefreshStores } from '@/lib/storeCache'
import { getBestPosition, getGeoErrorMessage, requestCompassHeading } from '@/helper/geolocation'
import { haversineKm } from '@/helper/distance'
import {
  findNearbySimilarStores,
  findGlobalExactNameMatches,
  mergeDuplicateCandidates,
} from '@/helper/duplicateCheck'

const StoreLocationPicker = dynamic(() => import('@/components/map/store-location-picker'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center bg-gray-900 rounded-md" style={{ height: '65vh' }}><span className="text-sm text-gray-400 animate-pulse">Đang tải bản đồ…</span></div>,
})

export default function AddStore() {
  const router = useRouter()
  const { isAdmin } = useAuth() || {}
  const [name, setName] = useState('')
  const [storeType, setStoreType] = useState(DEFAULT_STORE_TYPE)
  const nameInputRef = useRef(null)
  const [addressDetail, setAddressDetail] = useState('')
  const [ward, setWard] = useState('')
  const [district, setDistrict] = useState('')
  const wardRef = useRef('')
  const districtRef = useRef('')
  // unified message state
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  function showMessage(type, text, duration = 2500) {
    if (msgTimerRef.current) { clearTimeout(msgTimerRef.current); msgTimerRef.current = null }
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(() => { setMsgState((s) => ({ ...s, show: false })); msgTimerRef.current = null }, duration)
  }
  const [phone, setPhone] = useState('')
  const normalizedPhoneForQuickSave = String(phone || '').replace(/\s+/g, '')
  const canShowQuickSave = Boolean(
    normalizedPhoneForQuickSave && validateVietnamPhone(normalizedPhoneForQuickSave).isValid,
  )
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [imageFile, setImageFile] = useState(null)
  const [showMoreMobileStep2, setShowMoreMobileStep2] = useState(false)
  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])
  const [loading, setLoading] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // 1 = Name, 2 = Info, 3 = Location
  useEffect(() => {
    if (currentStep !== 2) setShowMoreMobileStep2(false)
  }, [currentStep])
  const [showSuccess, setShowSuccess] = useState(false)
  const [duplicateCandidates, setDuplicateCandidates] = useState([])
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false)
  const [duplicateCheckError, setDuplicateCheckError] = useState('')
  const [duplicateCheckDone, setDuplicateCheckDone] = useState(false)
  const [nameValid, setNameValid] = useState(false)
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [duplicateCheckLat, setDuplicateCheckLat] = useState(null)
  const [duplicateCheckLng, setDuplicateCheckLng] = useState(null)
  const duplicateCheckTimerRef = useRef(null)
  const duplicateCheckSeqRef = useRef(0)
  const duplicateGeoRequestedRef = useRef(false)
  const nearestLocationPrefilledRef = useRef(false)
  const nearestLocationPrefillRunningRef = useRef(false)

  // Map states
  const [pickedLat, setPickedLat] = useState(null)
  const [pickedLng, setPickedLng] = useState(null)
  const [mapEditable, setMapEditable] = useState(false)
  const [userHasEditedMap, setUserHasEditedMap] = useState(false) // Track if user manually edited map
  const [initialGPSLat, setInitialGPSLat] = useState(null) // Store initial GPS position
  const [initialGPSLng, setInitialGPSLng] = useState(null)
  const [heading, setHeading] = useState(null) // Store compass heading for map rotation
  const [compassError, setCompassError] = useState('')
  const compassOnceRef = useRef(false)
  const mapWrapperRef = useRef(null)
  const [geoBlocked, setGeoBlocked] = useState(false)
  const [step2Key, setStep2Key] = useState(0)
  const [mapsLink, setMapsLink] = useState('')
  const [mapsLinkLoading, setMapsLinkLoading] = useState(false)
  const [mapsLinkError, setMapsLinkError] = useState('')
  useEffect(() => {
    wardRef.current = ward
  }, [ward])
  useEffect(() => {
    districtRef.current = district
  }, [district])
  const hasUnsavedChanges = useMemo(() => {
    if (loading || showSuccess) return false
    return Boolean(
      name.trim() ||
      storeType !== DEFAULT_STORE_TYPE ||
      addressDetail.trim() ||
      ward.trim() ||
      district.trim() ||
      phone.trim() ||
      note.trim() ||
      imageFile ||
      pickedLat != null ||
      pickedLng != null ||
      currentStep !== 1
    )
  }, [name, storeType, addressDetail, ward, district, phone, note, imageFile, pickedLat, pickedLng, currentStep, loading, showSuccess])


  // Extract lat/lng from a Google Maps URL
  function extractCoordsFromUrl(url) {
    // Pattern: @lat,lng or !3dlat!4dlng or q=lat,lng or ll=lat,lng or center=lat,lng
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/,
      /\/place\/[^/]*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])
        if (isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng }
        }
      }
    }
    return null
  }

  async function handleMapsLink(link) {
    const trimmed = (link || '').trim()
    setMapsLink(trimmed)
    setMapsLinkError('')
    if (!trimmed) return

    // Try extract directly first
    let coords = extractCoordsFromUrl(trimmed)
    if (coords) {
      applyMapsLinkCoords(coords.lat, coords.lng)
      return
    }

    // If short link, expand it via API
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
      coords = extractCoordsFromUrl(data.finalUrl)
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

  function applyMapsLinkCoords(lat, lng) {
    setPickedLat(lat)
    setPickedLng(lng)
    setInitialGPSLat(lat)
    setInitialGPSLng(lng)
    setUserHasEditedMap(true)
    setGeoBlocked(false)
    setStep2Key((k) => k + 1)
    setMapsLinkError('')
    showMessage('success', `Đã lấy vị trí: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }

  // Stable handler for LocationPicker - track manual edits
  const handleLocationChange = useCallback((lat, lng) => {
    setPickedLat(lat)
    setPickedLng(lng)
    // If map is editable and user is dragging, mark as manually edited
    if (mapEditable) {
      setUserHasEditedMap(true)
    }
  }, [mapEditable])

  function parseCoordinate(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
    if (typeof value !== 'string') return NaN
    const parsed = Number.parseFloat(value.trim().replace(/,/g, '.'))
    return Number.isFinite(parsed) ? parsed : NaN
  }

  async function autoFillNearestDistrictWard(originLat, originLng) {
    if (nearestLocationPrefilledRef.current || nearestLocationPrefillRunningRef.current) return
    if (district.trim() || ward.trim()) return
    if (originLat == null || originLng == null) return

    nearestLocationPrefillRunningRef.current = true
    try {
      const stores = await getOrRefreshStores()
      const nearestStore = stores.reduce((nearest, store) => {
        const storeLat = parseCoordinate(store?.latitude)
        const storeLng = parseCoordinate(store?.longitude)
        const storeDistrict = String(store?.district || '').trim()
        const storeWard = String(store?.ward || '').trim()

        if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng) || !storeDistrict || !storeWard) {
          return nearest
        }

        const distance = haversineKm(originLat, originLng, storeLat, storeLng)

        if (!nearest || distance < nearest.distance) {
          return {
            store,
            distance,
          }
        }

        return nearest
      }, null)
      if (!nearestStore) return
      if (districtRef.current.trim() || wardRef.current.trim()) return
      const nextDistrict = toTitleCaseVI(String(nearestStore.store.district || '').trim())
      const nextWard = toTitleCaseVI(String(nearestStore.store.ward || '').trim())

      // Re-check before applying prefill to avoid overwriting user input typed during async fetch
      if (nearestLocationPrefilledRef.current || district.trim() || ward.trim()) {
        return
      }
      if (districtRef.current.trim() || wardRef.current.trim()) return
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
  }

  // Handler for getting fresh GPS location
  const handleGetLocation = useCallback(async () => {
    try {
      // Yêu cầu quyền la bàn ngay lập tức trước khi await để không bị mất context User Gesture trên iOS
      compassOnceRef.current = false
      refreshCompassHeading()

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

      // Update initial GPS reference (for submit if not edited)
      setInitialGPSLat(coords.latitude)
      setInitialGPSLng(coords.longitude)

      // Update map display
      setPickedLat(coords.latitude)
      setPickedLng(coords.longitude)

      // Reset edited flag since this is a fresh GPS load
      setUserHasEditedMap(false)

      showMessage('success', 'Đã cập nhật vị trí GPS mới')
    } catch (err) {
      console.error('Get location error:', err)
      setGeoBlocked(true)
      showMessage('error', getGeoErrorMessage(err))
    } finally {
      setResolvingAddr(false)
    }
  }, [])

  // Compass heading helper — delegates to extracted module
  async function refreshCompassHeading() {
    if (compassOnceRef.current) return
    compassOnceRef.current = true
    setCompassError('')
    try {
      const { heading: h, error: e } = await requestCompassHeading()
      if (e) setCompassError(e)
      if (h != null) {
        // Cộng thêm 1 số rất nhỏ để ép React kích hoạt re-render nếu hướng trùng khớp hoàn toàn với trước đó
        setHeading((prev) => prev === h ? h + 0.000001 : h)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const qName = typeof router.query.name === 'string' ? router.query.name.trim() : ''
    if (qName) setName(toTitleCaseVI(qName))
  }, [router.query.name])

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }) } catch { }
  }, [])

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }) } catch { }
  }, [currentStep])

  useEffect(() => {
    if (currentStep === 1 && nameInputRef.current) {
      try { nameInputRef.current.focus() } catch { }
    }
  }, [currentStep])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!hasUnsavedChanges) return
      e.preventDefault()
      e.returnValue = ''
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
      throw 'Route change aborted by user'
    }
    router.events.on('routeChangeStart', onRouteChangeStart)
    return () => router.events.off('routeChangeStart', onRouteChangeStart)
  }, [hasUnsavedChanges, router])

  function resetCreateForm() {
    setName('')
    setStoreType(DEFAULT_STORE_TYPE)
    setAddressDetail('')
    setWard('')
    setDistrict('')
    setPhone('')
    setNote('')
    setImageFile(null)
    setAllowDuplicate(false)
    setDuplicateCandidates([])
    setDuplicateCheckError('')
    setDuplicateCheckLoading(false)
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
    // Keep last heading until a new compass sample is obtained
    setCompassError('')
    compassOnceRef.current = false
    setGeoBlocked(false)
    setStep2Key((k) => k + 1)
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
          if (!fallbackErr?.cancelled) console.error('Fallback route cleanup failed:', fallbackErr)
        })
      })
    }
  }

  // Auto-fetch location when entering step 3
  useEffect(() => {
    if (currentStep !== 3) return
    // Reset map-related state to ensure a fresh GPS fetch each time
    setGeoBlocked(false)
    setMapEditable(false)
    setUserHasEditedMap(false)
    setPickedLat(null)
    setPickedLng(null)
    setInitialGPSLat(null)
    setInitialGPSLng(null)
    setHeading(null)
    setStep2Key((k) => k + 1) // force remount map
    if (!resolvingAddr) handleFillAddress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isAdmin])

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

  async function runDuplicateCheckByButton() {
    const trimmed = name.trim()
    if (!trimmed) {
      setFieldErrors((prev) => ({ ...prev, name: 'Vui lòng nhập tên cửa hàng' }))
      return
    }
    setFieldErrors((prev) => ({ ...prev, name: '' }))
    let checkLat = duplicateCheckLat
    let checkLng = duplicateCheckLng
    if (checkLat == null || checkLng == null) {
      if (!duplicateGeoRequestedRef.current) {
        duplicateGeoRequestedRef.current = true
      }
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
  }

  function handleStep1Next() {
    if (!duplicateCheckDone) {
      runDuplicateCheckByButton()
      return
    }
    if (nameValid || allowDuplicate) setCurrentStep(2)
  }

  function buildDuplicatePhoneMessage(matches) {
    const labels = matches.slice(0, 3).map((store) => store.name || 'Cửa hàng')
    return `Số điện thoại đã tồn tại ở ${labels.join('; ')}`
  }

  function getBaseStep2Errors({ requirePhone = false } = {}) {
    const errs = {}
    if (!district.trim()) errs.district = 'Vui lòng nhập quận/huyện'
    if (!ward.trim()) errs.ward = 'Vui lòng nhập xã/phường'
    const normalizedPhone = phone.trim()
    if (requirePhone && !normalizedPhone) {
      errs.phone = 'Vui lòng nhập số điện thoại để lưu luôn'
    }

    return { errs, normalizedPhone }
  }

  async function validateStep2Fields({ requirePhone = false } = {}) {
    const { errs, normalizedPhone } = getBaseStep2Errors({ requirePhone })

    if (!errs.phone && normalizedPhone) {
      const phoneValidation = validateVietnamPhone(normalizedPhone)
      if (!phoneValidation.isValid) {
        errs.phone = phoneValidation.message
      } else {
        const stores = await getOrRefreshStores()
        const duplicatePhoneStores = findDuplicatePhoneStores(stores, phoneValidation.normalized)
        if (duplicatePhoneStores.length > 0) {
          errs.phone = buildDuplicatePhoneMessage(duplicatePhoneStores)
        }
      }
    }

    setFieldErrors((prev) => ({
      ...prev,
      district: errs.district || '',
      ward: errs.ward || '',
      phone: errs.phone || '',
    }))

    return { errs, normalizedPhone }
  }

  async function validateStep2AndGoNext() {
    const { errs } = await validateStep2Fields()
    if (Object.keys(errs).length > 0) {
      showMessage('error', errs.phone ? 'Vui lòng kiểm tra lại số điện thoại' : 'Vui lòng nhập đủ quận/huyện và xã/phường')
      return false
    }
    
    // Yêu cầu lấy hướng bàn ngay lập tức tại đây vì requestPermission trên iOS yêu cầu đồng bộ với thao tác click người dùng
    compassOnceRef.current = false
    refreshCompassHeading()
    
    setCurrentStep(3)
    return true
  }

  function renderDuplicatePanel() {
    if (allowDuplicate) return null
    if (duplicateCheckError) {
      return (
        <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-orange-300">
          {duplicateCheckError}
        </div>
      )
    }
    if (duplicateCandidates.length === 0) return null

    return (
      <>
        <div className="font-semibold text-sm text-gray-100 my-2">
          Phát hiện cửa hàng có thể đã được tạo
        </div>
        <div className="space-y-2">
          {duplicateCandidates.map((s) => (
            <SearchStoreCard
              key={s.id}
              store={s}
              distance={s.distance}
              compact
            />
          ))}
        </div>
        <div className="mt-3 rounded-md border border-red-800 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          Vui lòng xác nhận “Vẫn tạo cửa hàng” để tiếp tục.
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => resetCreateForm()}
          >
            Quay lại
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              setAllowDuplicate(true)
              setCurrentStep(2)
            }}
          >
            Vẫn tạo cửa hàng
          </Button>
        </div>
      </>
    )
  }

  async function persistStore({ latitude = null, longitude = null, shouldCheckFinalDuplicates = true } = {}) {
    const normalizedName = toTitleCaseVI(name.trim())
    const normalizedStoreType = storeType || DEFAULT_STORE_TYPE
    const rawPhone = phone.trim()
    let validatedPhone = ''

    try {
      setLoading(true)

      if (rawPhone) {
        const phoneValidation = validateVietnamPhone(rawPhone)
        if (!phoneValidation.isValid) {
          setFieldErrors((prev) => ({ ...prev, phone: phoneValidation.message }))
          showMessage('error', phoneValidation.message)
          setLoading(false)
          return false
        }
        validatedPhone = phoneValidation.normalized

        const stores = await getOrRefreshStores()
        const duplicatePhoneStores = findDuplicatePhoneStores(stores, validatedPhone)
        if (duplicatePhoneStores.length > 0) {
          const duplicateMessage = buildDuplicatePhoneMessage(duplicatePhoneStores)
          setFieldErrors((prev) => ({ ...prev, phone: duplicateMessage }))
          showMessage('error', duplicateMessage)
          setLoading(false)
          return false
        }
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

      let uploadResult = null
      let imageFilename = null
      if (imageFile) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          initialQuality: 0.8,
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

        uploadResult = await uploadResponse.json()
        imageFilename = uploadResult.name
      }

      const normalizedDetail = toTitleCaseVI(addressDetail.trim())
      const normalizedWard = toTitleCaseVI(ward.trim())
      const normalizedDistrict = toTitleCaseVI(district.trim())

      const insertPayload = {
        name: normalizedName,
        store_type: normalizedStoreType,
        address_detail: normalizedDetail,
        ward: normalizedWard,
        district: normalizedDistrict,
        active: isAdmin,
        note,
        phone: validatedPhone || null,
        image_url: imageFilename,
        latitude,
        longitude,
      }

      let insertedRows = null
      let insertError = null

      ;({ data: insertedRows, error: insertError } = await supabase.from('stores').insert([insertPayload]).select())

      if (insertError) {
        console.error(insertError)
        if (uploadResult?.fileId) {
          try {
            await fetch('/api/upload-image', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: uploadResult.fileId }),
            })
          } catch (deleteErr) {
            console.warn('Could not delete uploaded image:', deleteErr)
          }
        }
        showMessage('error', 'Lỗi khi lưu dữ liệu')
        setLoading(false)
        return false
      }

      const newStore = insertedRows?.[0]
      if (newStore) {
        await appendStoreToCache(newStore)
      } else {
        await invalidateStoreCache()
      }

      setShowSuccess(true)
      return true
    } catch (err) {
      console.error(err)
      showMessage('error', 'Đã xảy ra lỗi khi tạo cửa hàng')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveWithoutLocation() {
    const { errs } = await validateStep2Fields({ requirePhone: true })
    if (Object.keys(errs).length > 0) {
      showMessage('error', errs.phone ? 'Muốn lưu luôn ở bước 2 thì cần số điện thoại hợp lệ.' : 'Vui lòng nhập đủ quận/huyện và xã/phường')
      return
    }

    const confirmed = window.confirm('Bạn có muốn lưu cửa hàng này mà không có vị trí không?')
    if (!confirmed) return

    await persistStore({
      latitude: null,
      longitude: null,
      shouldCheckFinalDuplicates: false,
    })
  }


  async function handleFillAddress() {
    try {
      setResolvingAddr(true)

      // Get GPS coordinates with improved logic
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

      // Save as initial GPS position (reference for submit)
      setInitialGPSLat(coords.latitude)
      setInitialGPSLng(coords.longitude)

      // Update map display
      setPickedLat(coords.latitude)
      setPickedLng(coords.longitude)

      // Do not auto-fill address parts here
    } catch (err) {
      console.error('Get location error:', err)
      showMessage('error', getGeoErrorMessage(err))
    } finally {
      setResolvingAddr(false)
    }
  }

  // Paste Google Maps link from clipboard
  async function handleSubmit(e) {
    e.preventDefault()
    if (currentStep !== 3) {
      if (currentStep === 1) {
        runDuplicateCheckByButton()
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
      return
    }

    // Determine coordinates based on user actions
    // Priority:
    // 1. If user unlocked map and edited → use edited position (pickedLat/Lng)
    // 2. Otherwise → use initial GPS position (initialGPSLat/Lng)
    let latitude = null
    let longitude = null

    if (userHasEditedMap && pickedLat != null && pickedLng != null) {
      // User unlocked and edited map → use edited position
      latitude = pickedLat
      longitude = pickedLng
    } else if (initialGPSLat != null && initialGPSLng != null) {
      // User did NOT edit map → use initial GPS
      latitude = initialGPSLat
      longitude = initialGPSLng
    } else if (pickedLat != null && pickedLng != null) {
      // Fallback: use whatever is on map
      latitude = pickedLat
      longitude = pickedLng
    } else {
      // Last resort: get current GPS
      try {
        const { coords, error } = await getBestPosition({ maxWaitTime: 3000, desiredAccuracy: 15 })
        if (!coords) {
          setGeoBlocked(true)
          showMessage('error', getGeoErrorMessage(error))
          return
        }
        setGeoBlocked(false)
        latitude = coords.latitude
        longitude = coords.longitude
      } catch (geoErr) {
        console.error('Không lấy được tọa độ:', geoErr)
        setLoading(false)
        showMessage('error', getGeoErrorMessage(geoErr))
        return
      }
    }

    // Final validation: Ensure we have valid coordinates
    if (latitude == null || longitude == null || !isFinite(latitude) || !isFinite(longitude)) {
      setLoading(false)
      showMessage('error', 'Thiếu thông tin vị trí. Vui lòng bật "Địa chỉ tự động" hoặc dán link Google Maps hoặc mở khóa bản đồ và chọn vị trí')
      return
    }

    await persistStore({
      latitude,
      longitude,
      shouldCheckFinalDuplicates: true,
    })
  }



  // Success screen
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-6 py-10 space-y-5 max-w-sm mx-auto">
          <div className="text-6xl">✅</div>
          <h2 className="text-xl font-bold text-white">Tạo cửa hàng thành công!</h2>
          <p className="text-sm text-gray-400">Cửa hàng đã được lưu vào hệ thống.</p>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="w-full"
              onClick={() => {
                setShowSuccess(false)
                resetCreateForm()
              }}
            >
              Tạo cửa hàng khác
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/map')}
            >
              Xem bản đồ
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push('/')}
            >
              Về trang chủ
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Step indicator labels
  const steps = [
    { num: 1, label: 'Tên' },
    { num: 2, label: 'Thông tin' },
    { num: 3, label: 'Vị trí' },
  ]
  const showMobileActionBar = (
    (currentStep === 1 && (allowDuplicate || duplicateCandidates.length === 0)) ||
    currentStep === 2 ||
    currentStep === 3
  )

  return (
    <div className="min-h-screen bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
      <FullPageLoading visible={loading} message="Đang tạo cửa hàng…" />
      <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-3 max-w-screen-md mx-auto">
        {/* Step indicator */}
        <StoreFormStepIndicator steps={steps} currentStep={currentStep} />

        <form onSubmit={handleSubmit} className="space-y-3 pb-32 sm:pb-0">
          {/* Step 1: Name */}
          {currentStep === 1 && (
            <>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="store_type" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Loại cửa hàng</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {STORE_TYPE_OPTIONS.map((type) => {
                      const selected = storeType === type.value
                      return (
                        <button
                          key={`top-type-${type.value}`}
                          type="button"
                          onClick={() => setStoreType(type.value || DEFAULT_STORE_TYPE)}
                          aria-pressed={selected}
                          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition ${
                            selected
                              ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                              : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                          }`}
                        >
                          {type.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <select hidden
                    id="store_type"
                    value={storeType}
                    onChange={(e) => setStoreType(e.target.value || DEFAULT_STORE_TYPE)}
                    aria-label="Loại cửa hàng"
                    className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                  >
                    {STORE_TYPE_OPTIONS.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <Label htmlFor="name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Tên cửa hàng</Label>
                  <Input
                    ref={nameInputRef}
                    id="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }))
                    }}
                    placeholder="VD: Minh Anh"
                    className="h-11 w-full text-base sm:text-base"
                  />
                </div>
                <div hidden className="grid grid-cols-2 gap-2">
                  {STORE_TYPE_OPTIONS.map((type) => {
                    const selected = storeType === type.value
                    return (
                      <button
                        key={`quick-type-${type.value}`}
                        type="button"
                        onClick={() => setStoreType(type.value || DEFAULT_STORE_TYPE)}
                        aria-pressed={selected}
                        className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition ${
                          selected
                            ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                            : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                        }`}
                      >
                        {type.label}
                      </button>
                    )
                  })}
                </div>
                {fieldErrors.name && (
                  <div className="text-xs text-red-600">{fieldErrors.name}</div>
                )}
                {duplicateCheckLoading && (
                  <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-200">
                    Đang kiểm tra trùng tên gần đây và toàn hệ thống…
                  </div>
                )}
                {renderDuplicatePanel()}
              </div>

              {(allowDuplicate || duplicateCandidates.length === 0) ? (
                <div className="pt-2 hidden sm:block">
                  <Button
                    type="button"
                    onClick={handleStep1Next}
                    className="w-full"
                  >
                    Tiếp theo
                  </Button>
                </div>
              ) : null}
            </>
          )}

          {/* Step 2: Address + Image + Optional info */}
          {currentStep === 2 && (
            <>
              {/* Quận/Huyện */}
              <div className="space-y-1.5">
                <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Quận / Huyện</Label>
                <div className="flex flex-wrap gap-2">
                  {DISTRICT_SUGGESTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${removeVietnameseTones(district || '').toLowerCase() === removeVietnameseTones(d).toLowerCase()
                          ? 'bg-blue-600 text-white border border-blue-600'
                          : 'border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                        }`}
                      onClick={() => {
                        setDistrict(d)
                        setWard('')
                        if (fieldErrors.district) setFieldErrors((prev) => ({ ...prev, district: '' }))
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {fieldErrors.district && (
                  <div className="text-xs text-red-600">{fieldErrors.district}</div>
                )}
              </div>

              {/* Xã/Phường — only show when district is selected */}
              {district && (DISTRICT_WARD_SUGGESTIONS[district] || []).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Xã / Phường</Label>
                  <div className="flex flex-wrap gap-2">
                    {(DISTRICT_WARD_SUGGESTIONS[district] || []).map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${removeVietnameseTones(ward || '').toLowerCase() === removeVietnameseTones(w).toLowerCase()
                            ? 'bg-blue-600 text-white border border-blue-600'
                            : 'border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                          }`}
                        onClick={() => {
                          setWard(w)
                          if (fieldErrors.ward) setFieldErrors((prev) => ({ ...prev, ward: '' }))
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.ward && (
                    <div className="text-xs text-red-600">{fieldErrors.ward}</div>
                  )}
                </div>
              )}

              {/* Địa chỉ chi tiết */}
              <div className="space-y-1.5">
                <Label htmlFor="address_detail" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Địa chỉ cụ thể <span className="font-normal text-gray-400">(không bắt buộc)</span></Label>
                <Input
                  id="address_detail"
                  value={addressDetail}
                  onChange={(e) => {
                    setAddressDetail(e.target.value)
                    if (fieldErrors.address_detail) setFieldErrors((prev) => ({ ...prev, address_detail: '' }))
                  }}
                  onBlur={() => { if (addressDetail) setAddressDetail(toTitleCaseVI(addressDetail.trim())) }}
                  placeholder="Số nhà, đường, thôn/xóm/đội..."
                  className="text-base sm:text-base"
                />
              </div>

              {/* Phone & Note — always visible */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Số điện thoại <span className="font-normal text-gray-400">(bắt buộc nếu lưu luôn ở bước 2)</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9+ ]*"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }))
                  }}
                  placeholder="0901 234 567"
                  className="text-base sm:text-base"
                />
                {fieldErrors.phone && (
                  <div className="text-xs text-red-600">{fieldErrors.phone}</div>
                )}
              </div>
              
              <div className="sm:hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-left transition text-gray-400 hover:text-gray-200"
                  onClick={() => setShowMoreMobileStep2((v) => !v)}
                  aria-expanded={showMoreMobileStep2}
                >
                  <span className="text-sm">
                    {showMoreMobileStep2 ? 'Thu gọn phần thêm' : 'Hiển thị thêm ảnh và ghi chú'}
                  </span>
                  <span
                    className={`ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition-transform ${
                      showMoreMobileStep2 ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                      <path d="M5 7.5 10 12.5 15 7.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              </div>

              <div className={`${showMoreMobileStep2 ? 'block' : 'hidden'} sm:block space-y-4`}>
              {/* Ảnh */}
              <div className="space-y-1.5">
                <Label htmlFor="image" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ảnh cửa hàng <span className="font-normal text-gray-400">(không bắt buộc)</span></Label>
                <div className="relative w-full">
                  {imageFile ? (
                    <div className="relative group w-full">
                      <img
                        src={previewUrl}
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
                    <label htmlFor="image" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer bg-gray-900 hover:bg-gray-800 transition">
                      <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                      <span className="text-sm text-gray-500 dark:text-gray-400">📸 Chụp hoặc chọn ảnh</span>
                      <input
                        id="image"
                        type="file"
                        accept="image/*;capture=camera"
                        capture="environment"
                        onChange={(e) => {
                          setImageFile(e.target.files?.[0] || null)
                          if (fieldErrors.image) setFieldErrors((prev) => ({ ...prev, image: '' }))
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ghi chú <span className="font-normal text-gray-400">(không bắt buộc)</span></Label>
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Bán từ 6:00 - 22:00" className="text-base sm:text-base" />
              </div>
              </div>

              <div className="pt-2 hidden sm:flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  icon={<span>←</span>}
                  onClick={() => setCurrentStep(1)}
                />
                {canShowQuickSave && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    icon={
                          <svg className="h-5 w-5" viewBox="0 0 1200 1200" fill="none" stroke="currentColor" aria-hidden="true">
                            <rect x="105.5" y="120" width="889" height="960" rx="281" ry="281" strokeWidth="70" />
                            <path d="M943.83 240h101.9a48.76 48.76 0 0 1 48.77 48.77v82.46A48.76 48.76 0 0 1 1045.73 420H967.18M967.18 510h78.55a48.76 48.76 0 0 1 48.77 48.77v82.46A48.76 48.76 0 0 1 1045.73 690H967.18M967.18 780h78.55a48.76 48.76 0 0 1 48.77 48.77v82.46A48.76 48.76 0 0 1 1045.73 960H943.83" strokeWidth="70" />
                            <circle cx="550" cy="445" r="155" strokeWidth="70" />
                            <path d="M788.53 798.05a580.5 580.5 0 0 0-44.72-87.44c-92.46-147.48-307.35-147.48-399.8 0a581.54 581.54 0 0 0-44.73 87.44c-26.34 64.05 15.42 137.31 78 137.31H710.57c62.54 0 104.3-73.26 77.96-137.31Z" strokeWidth="70" />
                          </svg>
                    }
                    onClick={handleSaveWithoutLocation}
                    aria-label="Lưu luôn"
                    title="Lưu luôn"
                  />
                )}
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => validateStep2AndGoNext()}
                >
                  Tiếp theo →
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <>
              {/* Guidance text */}
              {resolvingAddr && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2.5">
                  <svg className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  <span className="text-sm text-blue-700 dark:text-blue-300">Đang xác định vị trí của bạn...</span>
                </div>
              )}
              {!resolvingAddr && pickedLat != null && !geoBlocked && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2.5">
                  <p className="text-sm text-green-700 dark:text-green-300">📍 Đã xác định vị trí. Nếu chưa đúng, bấm <strong>Mở khóa</strong> trên bản đồ để điều chỉnh.</p>
                </div>
              )}
              {geoBlocked && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
                  <p className="text-sm text-red-700 dark:text-red-300">❌ Không lấy được vị trí GPS. Hãy bấm <strong>Lấy lại vị trí</strong> hoặc dán link Google Maps bên dưới.</p>
                </div>
              )}

              {/* Map Picker */}
              <div ref={mapWrapperRef}>
                <StoreLocationPicker
                  mapKey={`step2-${step2Key}`}
                  initialLat={pickedLat}
                  initialLng={pickedLng}
                  onChange={handleLocationChange}
                  editable={mapEditable}
                  onToggleEditable={() => setMapEditable(v => !v)}
                  onGetLocation={handleGetLocation}
                  heading={heading}
                  height="65vh"
                  compassError={compassError}
                  geoBlocked={geoBlocked}
                  onReload={() => window.location.reload()}
                  resolvingAddr={resolvingAddr}
                  dark={false}
                />
              </div>

              {isAdmin && (
                <div className="pt-2 md:hidden space-y-2">
                  <StoreMapsLinkFields
                    value={mapsLink}
                    loading={mapsLinkLoading}
                    error={mapsLinkError}
                    mobile
                    onChange={setMapsLink}
                    onSubmit={() => handleMapsLink(mapsLink)}
                  />
                </div>
              )}

              {/* Maps link input - desktop only, always visible */}
              <div className="hidden md:block pt-2 space-y-1.5">
                <StoreMapsLinkFields
                  value={mapsLink}
                  loading={mapsLinkLoading}
                  error={mapsLinkError}
                  onChange={setMapsLink}
                  onSubmit={() => handleMapsLink(mapsLink)}
                />
              </div>

              {/* Back and Submit buttons for step 3 */}
              <div className="pt-2 hidden sm:flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  icon={<span>←</span>}
                  onClick={() => setCurrentStep(2)}
                />
                <Button
                  type="submit"
                  disabled={loading || resolvingAddr || geoBlocked}
                  className="flex-1"
                  leftIcon={(resolvingAddr || loading) ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : undefined}
                >
                  {resolvingAddr ? 'Đang lấy vị trí...' : loading ? 'Đang lưu...' : '✓ Lưu cửa hàng'}
                </Button>
              </div>
            </>
          )}

          {/* Mobile fixed action bar */}
          {showMobileActionBar && (
            <div
              className="sm:hidden fixed inset-x-0 z-[55] border-t border-gray-800 bg-gray-950/95 backdrop-blur-md"
              style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
            >
              <div className="mx-auto max-w-screen-md px-3 py-2">
                {currentStep === 1 && (allowDuplicate || duplicateCandidates.length === 0) ? (
                  <Button
                    type="button"
                    onClick={handleStep1Next}
                    className="w-full"
                  >
                    Tiếp theo
                  </Button>
                ) : null}

                {currentStep === 2 && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      icon={<span>←</span>}
                      onClick={() => setCurrentStep(1)}
                    />
                    {canShowQuickSave && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        icon={
                          <svg className="h-5 w-5" viewBox="0 0 1200 1200" fill="none" stroke="currentColor" aria-hidden="true">
                            <rect x="105.5" y="120" width="889" height="960" rx="281" ry="281" strokeWidth="70" />
                            <path d="M943.83 240h101.9a48.76 48.76 0 0 1 48.77 48.77v82.46A48.76 48.76 0 0 1 1045.73 420H967.18M967.18 510h78.55a48.76 48.76 0 0 1 48.77 48.77v82.46A48.76 48.76 0 0 1 1045.73 690H967.18M967.18 780h78.55a48.76 48.76 0 0 1 48.77 48.77v82.46A48.76 48.76 0 0 1 1045.73 960H943.83" strokeWidth="70" />
                            <circle cx="550" cy="445" r="155" strokeWidth="70" />
                            <path d="M788.53 798.05a580.5 580.5 0 0 0-44.72-87.44c-92.46-147.48-307.35-147.48-399.8 0a581.54 581.54 0 0 0-44.73 87.44c-26.34 64.05 15.42 137.31 78 137.31H710.57c62.54 0 104.3-73.26 77.96-137.31Z" strokeWidth="70" />
                          </svg>
                        }
                        onClick={handleSaveWithoutLocation}
                        aria-label="Lưu luôn"
                        title="Lưu luôn"
                      />
                    )}
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => validateStep2AndGoNext()}
                    >
                      Tiếp theo →
                    </Button>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      icon={<span>←</span>}
                      onClick={() => setCurrentStep(2)}
                    />
                    <Button
                      type="submit"
                      disabled={loading || resolvingAddr || geoBlocked}
                      className="flex-1"
                      leftIcon={(resolvingAddr || loading) ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : undefined}
                    >
                      {resolvingAddr ? 'Đang lấy vị trí...' : loading ? 'Đang lưu...' : '✓ Lưu cửa hàng'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
