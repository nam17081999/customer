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
import { Msg } from '@/components/ui/msg'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { findDuplicatePhoneStores, formatDistance, validateVietnamPhone } from '@/helper/validation'
import SearchStoreCard from '@/components/search-store-card'
import StoreMapsLinkFields from '@/components/store/store-maps-link-fields'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { appendStoreToCache, getOrRefreshStores } from '@/lib/storeCache'
import { getBestPosition, getGeoErrorMessage, requestCompassHeading } from '@/helper/geolocation'
import { haversineKm } from '@/helper/distance'
import { parseCoordinate } from '@/helper/coordinate'
import {
  findStoreDuplicateCandidates,
} from '@/helper/duplicateCheck'

const StoreLocationPicker = dynamic(() => import('@/components/map/store-location-picker'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center bg-gray-900 rounded-md" style={{ height: '65vh' }}><span className="text-sm text-gray-400 animate-pulse">Đang tải bản đồ…</span></div>,
})

export default function AddStore() {
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
  // unified message state
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  function showMessage(type, text, duration = 2500) {
    if (msgTimerRef.current) { clearTimeout(msgTimerRef.current); msgTimerRef.current = null }
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(() => { setMsgState((s) => ({ ...s, show: false })); msgTimerRef.current = null }, duration)
  }
  const [phone, setPhone] = useState('')
  const [phoneSecondary, setPhoneSecondary] = useState('')
  const telesaleNoStep3 = Boolean(isTelesale && !isAdmin)
  const canQuickSaveWithoutLocation = Boolean(isAdmin || telesaleNoStep3)
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // 1 = Name, 2 = Info, 3 = Duplicate check, 4 = Location
  const [allowStep2Duplicate, setAllowStep2Duplicate] = useState(false)
  const [step2DuplicateCandidates, setStep2DuplicateCandidates] = useState([])
  const [step2DuplicateLoading, setStep2DuplicateLoading] = useState(false)
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
  const [confirmCreate, setConfirmCreate] = useState({
    open: false,
    type: '',
    payload: null,
  })

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
      name.trim() ||
      storeType !== DEFAULT_STORE_TYPE ||
      addressDetail.trim() ||
      ward.trim() ||
      district.trim() ||
      phone.trim() ||
      phoneSecondary.trim() ||
      note.trim() ||
      pickedLat != null ||
      pickedLng != null ||
      currentStep !== 1
    )
  }, [name, storeType, addressDetail, ward, district, phone, phoneSecondary, note, pickedLat, pickedLng, currentStep, loading])


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

  async function autoFillNearestDistrictWard(originLat, originLng) {
    if (telesaleNoStep3) return
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
      // Xin quyền la bàn ngay lập tức trước khi await để không bị mất context User Gesture trên iOS/Safari
      compassOnceRef.current = false
      refreshCompassHeading({ requestPermission: true })

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
  async function refreshCompassHeading({ requestPermission = false } = {}) {
    if (compassOnceRef.current) return
    compassOnceRef.current = true
    setCompassError('')
    try {
      const { heading: h, error: e } = await requestCompassHeading({ requestPermission })
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
      const err = new Error('Route change aborted by user')
      err.cancelled = true
      throw err
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
    setPhoneSecondary('')
    setNote('')
    setAllowStep2Duplicate(false)
    setStep2DuplicateCandidates([])
    setStep2DuplicateLoading(false)
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

  // Auto-fetch location when entering step 4
  useEffect(() => {
    if (currentStep !== 4) return
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
    setAllowStep2Duplicate(false)
    setStep2DuplicateCandidates([])
  }, [name, district, ward, addressDetail, phone, phoneSecondary])

  useEffect(() => {
    if (district && !DISTRICT_WARD_SUGGESTIONS[district]) {
      setWard('')
    }
  }, [district])

  function handleStep1Next() {
    if (!name.trim()) {
      setFieldErrors((prev) => ({ ...prev, name: 'Vui lòng nhập tên cửa hàng' }))
      return
    }
    setFieldErrors((prev) => ({ ...prev, name: '' }))
    setCurrentStep(2)
  }

  function buildDuplicatePhoneMessage(matches, label = 'Số điện thoại') {
    const labels = matches.slice(0, 3).map((store) => store.name || 'Cửa hàng')
    return `${label} đã tồn tại ở ${labels.join('; ')}`
  }

  function getBaseStep2Errors({ requirePhone = false } = {}) {
    const errs = {}
    if (!district.trim()) errs.district = 'Vui lòng nhập quận/huyện'
    if (!ward.trim()) errs.ward = 'Vui lòng nhập xã/phường'
    const normalizedPhone = phone.trim()
    const normalizedPhoneSecondary = phoneSecondary.trim()
    if (requirePhone && !normalizedPhone) {
      errs.phone = 'Vui lòng nhập số điện thoại để lưu luôn'
    }

    if (!normalizedPhone && normalizedPhoneSecondary) {
      errs.phone = 'Vui lòng nhập số điện thoại 1 trước'
    }

    return { errs, normalizedPhone, normalizedPhoneSecondary }
  }

  async function validateStep2Fields({ requirePhone = false } = {}) {
    const { errs, normalizedPhone, normalizedPhoneSecondary } = getBaseStep2Errors({ requirePhone })
    let validatedPhone = ''
    let validatedPhoneSecondary = ''

    if (!errs.phone && normalizedPhone) {
      const phoneValidation = validateVietnamPhone(normalizedPhone)
      if (!phoneValidation.isValid) {
        errs.phone = phoneValidation.message
      } else {
        validatedPhone = phoneValidation.normalized
      }
    }

    if (!errs.phone && !errs.phone_secondary && normalizedPhoneSecondary) {
      const phoneSecondaryValidation = validateVietnamPhone(normalizedPhoneSecondary)
      if (!phoneSecondaryValidation.isValid) {
        errs.phone_secondary = phoneSecondaryValidation.message
      } else {
        validatedPhoneSecondary = phoneSecondaryValidation.normalized
      }
    }

    if (!errs.phone && !errs.phone_secondary && validatedPhone && validatedPhoneSecondary && validatedPhone === validatedPhoneSecondary) {
      errs.phone_secondary = 'Số điện thoại 2 không được trùng số điện thoại 1'
    }

    if (!errs.phone && !errs.phone_secondary && (validatedPhone || validatedPhoneSecondary)) {
      const stores = await getOrRefreshStores()

      if (validatedPhone) {
        const duplicatePhoneStores = findDuplicatePhoneStores(stores, validatedPhone)
        if (duplicatePhoneStores.length > 0) {
          errs.phone = buildDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 1')
        }
      }

      if (!errs.phone_secondary && validatedPhoneSecondary) {
        const duplicatePhoneStores = findDuplicatePhoneStores(stores, validatedPhoneSecondary)
        if (duplicatePhoneStores.length > 0) {
          errs.phone_secondary = buildDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 2')
        }
      }
    }

    setFieldErrors((prev) => ({
      ...prev,
      district: errs.district || '',
      ward: errs.ward || '',
      phone: errs.phone || '',
      phone_secondary: errs.phone_secondary || '',
    }))

    return {
      errs,
      normalizedPhone,
      normalizedPhoneSecondary,
      validatedPhone,
      validatedPhoneSecondary,
    }
  }

  async function findStep2DuplicateCandidates({ validatedPhone = '', validatedPhoneSecondary = '' } = {}) {
    return findStoreDuplicateCandidates({
      name: toTitleCaseVI(name.trim()),
      district: toTitleCaseVI(district.trim()),
      ward: toTitleCaseVI(ward.trim()),
      addressDetail: toTitleCaseVI(addressDetail.trim()),
      phone: validatedPhone,
      phoneSecondary: validatedPhoneSecondary,
    })
  }

  async function validateStep2AndGoNext() {
    const { errs, validatedPhone, validatedPhoneSecondary } = await validateStep2Fields({ requirePhone: telesaleNoStep3 })
    if (Object.keys(errs).length > 0) {
      showMessage('error', errs.phone ? 'Vui lòng kiểm tra lại số điện thoại' : 'Vui lòng nhập đủ quận/huyện và xã/phường')
      return false
    }

    setStep2DuplicateLoading(true)
    let step2Candidates = []
    try {
      step2Candidates = await findStep2DuplicateCandidates({
        validatedPhone,
        validatedPhoneSecondary,
      })
    } catch (err) {
      console.error('Step 2 duplicate check failed:', err)
      setStep2DuplicateLoading(false)
      showMessage('error', 'Khong kiem tra duoc trung nang cao o buoc 2. Vui long thu lai.')
      return false
    }
    setStep2DuplicateLoading(false)
    setStep2DuplicateCandidates(step2Candidates)

    if (step2Candidates.length > 0 && !allowStep2Duplicate) {
      setCurrentStep(3)
      return true
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
    refreshCompassHeading({ requestPermission: true })
    setCurrentStep(4)
    return true
  }

  function handleStep3Next() {
    if (step2DuplicateCandidates.length > 0) {
      setAllowStep2Duplicate(true)
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
      return
    }
    // Yêu cầu lấy hướng/la bàn ngay trong user gesture
    compassOnceRef.current = false
    refreshCompassHeading({ requestPermission: true })
    setCurrentStep(4)
  }

  function renderStep3DuplicatePanel() {
    return (
      <>
        <div className="font-semibold text-sm text-gray-100 my-2">
          Phát hiện trùng
        </div>
        <div className="space-y-2">
          {step2DuplicateCandidates.map((store) => (
            <SearchStoreCard
              key={store.id}
              store={store}
              distance={store.distance}
              compact
            />
          ))}
        </div>
        <div className="mt-3 rounded-md border border-red-800 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          Phát hiện cửa hàng có thể đã được tạo. Nhấn tiếp theo nếu bạn vẫn muốn tạo mới.
        </div>
      </>
    )
  }
  async function persistStore({ latitude = null, longitude = null, shouldCheckFinalDuplicates = true } = {}) {
    const normalizedName = toTitleCaseVI(name.trim())
    const normalizedStoreType = storeType || DEFAULT_STORE_TYPE
    const rawPhone = phone.trim()
    const rawPhoneSecondary = phoneSecondary.trim()
    let validatedPhone = ''
    let validatedPhoneSecondary = ''
    let storesForPhoneDupes = null

    const getStoresForPhoneDupes = async () => {
      if (!storesForPhoneDupes) {
        storesForPhoneDupes = await getOrRefreshStores()
      }
      return storesForPhoneDupes
    }

    try {
      setLoading(true)

      if (!rawPhone && rawPhoneSecondary) {
        setFieldErrors((prev) => ({ ...prev, phone: 'Vui lòng nhập số điện thoại 1 trước' }))
        showMessage('error', 'Vui lòng nhập số điện thoại 1 trước')
        setLoading(false)
        return false
      }

      if (rawPhone) {
        const phoneValidation = validateVietnamPhone(rawPhone)
        if (!phoneValidation.isValid) {
          setFieldErrors((prev) => ({ ...prev, phone: phoneValidation.message }))
          showMessage('error', phoneValidation.message)
          setLoading(false)
          return false
        }
        validatedPhone = phoneValidation.normalized

        const stores = await getStoresForPhoneDupes()
        const duplicatePhoneStores = findDuplicatePhoneStores(stores, validatedPhone)
        if (duplicatePhoneStores.length > 0) {
          const duplicateMessage = buildDuplicatePhoneMessage(duplicatePhoneStores)
          setFieldErrors((prev) => ({ ...prev, phone: duplicateMessage }))
          showMessage('error', duplicateMessage)
          setLoading(false)
          return false
        }
      }

      if (rawPhoneSecondary) {
        const phoneSecondaryValidation = validateVietnamPhone(rawPhoneSecondary)
        if (!phoneSecondaryValidation.isValid) {
          setFieldErrors((prev) => ({ ...prev, phone_secondary: phoneSecondaryValidation.message }))
          showMessage('error', phoneSecondaryValidation.message)
          setLoading(false)
          return false
        }
        validatedPhoneSecondary = phoneSecondaryValidation.normalized

        if (validatedPhone && validatedPhoneSecondary && validatedPhone === validatedPhoneSecondary) {
          setFieldErrors((prev) => ({ ...prev, phone_secondary: 'Số điện thoại 2 không được trùng số điện thoại 1' }))
          showMessage('error', 'Số điện thoại 2 không được trùng số điện thoại 1')
          setLoading(false)
          return false
        }

        const stores = await getStoresForPhoneDupes()
        const duplicatePhoneStores = findDuplicatePhoneStores(stores, validatedPhoneSecondary)
        if (duplicatePhoneStores.length > 0) {
          const duplicateMessage = buildDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 2')
          setFieldErrors((prev) => ({ ...prev, phone_secondary: duplicateMessage }))
          showMessage('error', duplicateMessage)
          setLoading(false)
          return false
        }
      }

      if (shouldCheckFinalDuplicates) {
        let finalDuplicateCandidates = []
        try {
          finalDuplicateCandidates = await findStoreDuplicateCandidates({
            name: normalizedName,
            district: district.trim(),
            ward: ward.trim(),
            addressDetail: addressDetail.trim(),
            phone: validatedPhone,
            phoneSecondary: validatedPhoneSecondary,
          })
        } catch (dupErr) {
          console.error('Duplicate check failed:', dupErr)
          showMessage('error', 'Không kiểm tra được trùng tên (gần đây/toàn hệ thống). Vui lòng thử lại.')
          setLoading(false)
          return false
        }

        if (finalDuplicateCandidates.length > 0 && !allowStep2Duplicate) {
          setStep2DuplicateCandidates(finalDuplicateCandidates)
          setCurrentStep(3)
          showMessage('error', 'Phát hiện cửa hàng trùng/tương tự theo tên (gần đây hoặc toàn hệ thống). Vui lòng xác nhận nếu vẫn muốn tạo.')
          setLoading(false)
          return false
        }
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
        is_potential: Boolean(isTelesale),
        note: note.trim() || null,
        phone: validatedPhone || null,
        phone_secondary: validatedPhoneSecondary || null,
        latitude,
        longitude,
      }

      let insertedRows = null
      let insertError = null

        ; ({ data: insertedRows, error: insertError } = await supabase
          .from('stores')
          .insert([insertPayload])
          .select('id,name,store_type,address_detail,ward,district,phone,phone_secondary,note,latitude,longitude,active,is_potential,created_at,updated_at,last_called_at,last_call_result,last_call_result_at,last_order_reported_at,sales_note'))

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
  }

  async function handleConfirmCreate() {
    const payload = confirmCreate.payload
    setConfirmCreate({ open: false, type: '', payload: null })
    if (!payload) return
    await persistStore(payload)
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
    if (currentStep !== 4) {
      if (currentStep === 1) {
        handleStep1Next()
      } else if (currentStep === 2) {
        await validateStep2AndGoNext()
      } else if (currentStep === 3) {
        handleStep3Next()
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

    setConfirmCreate({
      open: true,
      type: 'create',
      payload: {
        latitude,
        longitude,
        shouldCheckFinalDuplicates: true,
      },
    })
  }

  const showMobileActionBar = (
    currentStep === 1 ||
    currentStep === 2 ||
    currentStep === 3 ||
    currentStep === 4
  )

  return (
    <div className="min-h-screen bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
      <FullPageLoading
        visible={loading || step2DuplicateLoading}
        message={step2DuplicateLoading ? 'Đang kiểm tra tên trùng...' : 'Đang tạo cửa hàng…'}
      />
      <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-3 max-w-screen-md mx-auto">
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
                      const typeMeta = getStoreTypeMeta(type.value)
                      return (
                        <button
                          key={`top-type-${type.value}`}
                          type="button"
                          onClick={() => setStoreType(type.value || DEFAULT_STORE_TYPE)}
                          aria-pressed={selected}
                          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition ${selected
                              ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                              : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                            }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center">
                              {typeMeta.icon}
                            </span>
                            <span>{type.label}</span>
                          </span>
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
                    const typeMeta = getStoreTypeMeta(type.value)
                    return (
                      <button
                        key={`quick-type-${type.value}`}
                        type="button"
                        onClick={() => setStoreType(type.value || DEFAULT_STORE_TYPE)}
                        aria-pressed={selected}
                        className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition ${selected
                            ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                            : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                          }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center">
                            {typeMeta.icon}
                          </span>
                          <span>{type.label}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {fieldErrors.name && (
                  <div className="text-xs text-red-600">{fieldErrors.name}</div>
                )}
                
              </div>

                            <div className="pt-2 hidden sm:block">
                <Button
                  type="button"
                  onClick={handleStep1Next}
                  className="w-full"
                >
                  Tiếp theo
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Address + Optional info */}
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
                <Label htmlFor="phone" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                  Số điện thoại
                  <span className="font-normal text-gray-400">
                    {telesaleNoStep3 ? ' (bắt buộc để lưu ở bước 2)' : ' (không bắt buộc)'}
                  </span>
                </Label>
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

              {(phone.trim() || phoneSecondary.trim()) && (
                <div className="space-y-1.5">
                  <Label htmlFor="phone-secondary" className="block text-sm font-medium text-gray-300">
                    Số điện thoại 2 <span className="font-normal text-gray-400">(không bắt buộc)</span>
                  </Label>
                  <Input
                    id="phone-secondary"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9+ ]*"
                    value={phoneSecondary}
                    onChange={(e) => {
                      setPhoneSecondary(e.target.value)
                      if (fieldErrors.phone_secondary) setFieldErrors((prev) => ({ ...prev, phone_secondary: '' }))
                    }}
                    placeholder="0912 345 678"
                    className="text-base sm:text-base"
                  />
                  {fieldErrors.phone_secondary && (
                    <div className="text-xs text-red-600">{fieldErrors.phone_secondary}</div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ghi chú <span className="font-normal text-gray-400">(không bắt buộc)</span></Label>
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Bán từ 6:00 - 22:00" className="text-base sm:text-base" />
              </div>
              <div className="pt-2 hidden sm:flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  icon={<span>←</span>}
                  onClick={() => setCurrentStep(1)}
                />
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => validateStep2AndGoNext()}
                  disabled={step2DuplicateLoading}
                >
                  Tiếp theo →
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Duplicate check */}
          {currentStep === 3 && step2DuplicateCandidates.length > 0 && (
            <>
              {renderStep3DuplicatePanel()}

              <div className="pt-2 hidden sm:flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  icon={<span>←</span>}
                  onClick={() => setCurrentStep(2)}
                />
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleStep3Next}
                >
                  {telesaleNoStep3 ? 'Lưu cửa hàng' : 'Tiếp theo →'}
                </Button>
              </div>
            </>
          )}

          {/* Step 4: Location */}
          {currentStep === 4 && (
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
                  onClick={() => setCurrentStep(step2DuplicateCandidates.length > 0 ? 3 : 2)}
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
                {currentStep === 1 ? (
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
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => validateStep2AndGoNext()}
                      disabled={step2DuplicateLoading}
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
                      type="button"
                      className="flex-1"
                      onClick={handleStep3Next}
                    >
                      {telesaleNoStep3 ? 'Lưu cửa hàng' : 'Tiếp theo →'}
                    </Button>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      icon={<span>←</span>}
                      onClick={() => setCurrentStep(step2DuplicateCandidates.length > 0 ? 3 : 2)}
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

            <ConfirmDialog
        open={confirmCreate.open}
        onOpenChange={(open) => {
          setConfirmCreate((prev) => (open ? prev : { open: false, type: '', payload: null }))
        }}
        title={confirmCreate.type === 'quick-save' ? 'Xác nhận lưu không vị trí' : 'Xác nhận tạo cửa hàng'}
        description={
          confirmCreate.type === 'quick-save'
            ? 'Cửa hàng sẽ được tạo ngay nhưng chưa có vị trí bản đồ. Bạn có muốn tiếp tục?'
            : 'Bạn có chắc muốn tạo cửa hàng với thông tin hiện tại không?'
        }
        confirmLabel={confirmCreate.type === 'quick-save' ? 'Lưu luôn' : 'Tạo cửa hàng'}
        loading={loading}
        onConfirm={handleConfirmCreate}
      />
    </div>
  )
}
