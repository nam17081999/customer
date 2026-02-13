import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabaseClient'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { toTitleCaseVI, formatAddressParts } from '@/lib/utils'
import {
  DISTRICT_WARD_SUGGESTIONS,
  DISTRICT_SUGGESTIONS,
} from '@/lib/constants'
import imageCompression from 'browser-image-compression'
import { Msg } from '@/components/ui/msg'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { haversineKm } from '@/helper/distance'
import { formatDistance } from '@/helper/validation'
import { DetailStoreModalContent } from '@/components/detail-store-card'
import removeVietnameseTones from '@/helper/removeVietnameseTones'

const StoreLocationPicker = dynamic(() => import('@/components/map/store-location-picker'), { ssr: false })

export default function AddStore() {
  const IGNORED_NAME_TERMS = [
    'cửa hàng',
    'tạp hoá',
    'quán nước',
    'giải khát',
    'nhà nghỉ',
    'nhà hàng',
    'cyber cà phê',
    'cafe',
    'lẩu',
    'siêu thị',
    'quán',
    'gym',
    'đại lý',
    'cơm',
    'phở',
    'bún',
    'shop',
    'kok',
    'karaoke',
    'bi-a',
    'bia',
    'net',
    'game',
    'internet',
    'beer',
    'coffee',
    'mart',
    'store',
    'minimart'
  ]
  const router = useRouter()
  const [name, setName] = useState('')
  const nameInputRef = useRef(null)
  const [addressDetail, setAddressDetail] = useState('')
  const [ward, setWard] = useState('')
  const [district, setDistrict] = useState('')
  // unified message state
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  function showMessage(type, text, duration = 2500) {
    if (msgTimerRef.current) { clearTimeout(msgTimerRef.current); msgTimerRef.current = null }
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(() => { setMsgState((s) => ({ ...s, show: false })); msgTimerRef.current = null }, duration)
  }
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const NAME_SUGGESTIONS = [
    'Cửa hàng',
    'Tạp hoá',
    'Quán nước',
    'Karaoke',
    'Nhà hàng',
    'Quán',
    'Cafe',
    'Siêu thị'
  ]
  const [imageFile, setImageFile] = useState(null)
  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])
  const [loading, setLoading] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // 1 = Name, 2 = Info, 3 = Location
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
  const DUPLICATE_RADIUS_KM = 0.1

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
  const hasUnsavedChanges = useMemo(() => {
    if (loading) return false
    return Boolean(
      name.trim() ||
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
  }, [name, addressDetail, ward, district, phone, note, imageFile, pickedLat, pickedLng, currentStep, loading])


  // Stable handler for LocationPicker - track manual edits
  const handleLocationChange = useCallback((lat, lng) => {
    setPickedLat(lat)
    setPickedLng(lng)
    // If map is editable and user is dragging, mark as manually edited
    if (mapEditable) {
      setUserHasEditedMap(true)
    }
  }, [mapEditable])

  // Handler for getting fresh GPS location
  const handleGetLocation = useCallback(async () => {
    try {
      setResolvingAddr(true)

      const { coords, error } = await getBestPosition({
        attempts: 3,
        timeout: 4000,
        maxWaitTime: 8000,
        desiredAccuracy: 25,
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

      // Also try compass once on refresh (user gesture)
      compassOnceRef.current = false
      requestCompassHeadingOnce()

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

  // Improved GPS location with progressive timeout and maxWaitTime
  async function getBestPosition({
    attempts = 4,
    timeout = 5000,        // Giảm từ 10s → 5s
    maxWaitTime = 10000,   // Tổng thời gian tối đa 10s
    desiredAccuracy = 25,  // Mục tiêu 25m
    skipCache = false,
  } = {}) {
    if (!navigator.geolocation) {
      return { coords: null, error: new Error('Geolocation not supported') }
    }

    const samples = []
    const startTime = Date.now()
    let lastError = null

    if (!skipCache) {
      // Try to get cached position first (< 30 seconds old)
      try {
        const cached = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true, // Changed to true to get heading
              timeout: 1000,
              maximumAge: 30000 // Accept 30s old
            }
          )
        })
        if (cached?.coords?.accuracy && cached.coords.accuracy <= desiredAccuracy * 1.5) {
          console.log('✅ Dùng vị trí cache:', cached.coords.accuracy + 'm')
          return { coords: cached.coords, error: null }
        }
      } catch (err) {
        // No cache, continue to get fresh location
        lastError = err
      }
    }

    for (let i = 0; i < attempts; i++) {
      // Check total elapsed time
      const elapsed = Date.now() - startTime
      if (elapsed > maxWaitTime) {
        console.log('⏱️ Đã hết thời gian chờ tối đa:', elapsed + 'ms')
        break
      }

      try {
        // Progressive timeout: 5s → 4s → 3s → 2s
        const dynamicTimeout = Math.max(2000, timeout - (i * 1000))
        const remainingTime = maxWaitTime - elapsed
        const actualTimeout = Math.min(dynamicTimeout, remainingTime)

        if (actualTimeout < 1000) break // Too little time left

        const pos = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Timeout')), actualTimeout)
          navigator.geolocation.getCurrentPosition(
            (result) => {
              clearTimeout(timeoutId)
              resolve(result)
            },
            (err) => {
              clearTimeout(timeoutId)
              reject(err)
            },
            {
              enableHighAccuracy: true,
              timeout: actualTimeout,
              maximumAge: 0
            }
          )
        })

        if (pos?.coords) {
          samples.push(pos.coords)
          console.log(`📍 Sample ${i+1}: ${pos.coords.accuracy?.toFixed(1) || '?'}m, heading: ${pos.coords.heading || 'N/A'} (${Date.now() - startTime}ms)`)

          // Early exit if good enough
          if (pos.coords.accuracy && pos.coords.accuracy <= desiredAccuracy) {
            console.log('✅ Đạt độ chính xác mong muốn')
            return { coords: pos.coords, error: null }
          }
        }
      } catch (err) {
        console.warn(`⚠️ Attempt ${i+1} failed:`, err.message)
        lastError = err
      }
    }

    if (samples.length === 0) {
      const e = new Error('Không lấy được vị trí sau nhiều lần thử')
      e.cause = lastError || undefined
      return { coords: null, error: e }
    }

    // Return best sample
    samples.sort((a, b) => (a.accuracy || Infinity) - (b.accuracy || Infinity))
    console.log(`📊 Chọn sample tốt nhất: ${samples[0].accuracy?.toFixed(1) || '?'}m`)
    return { coords: samples[0], error: null }
  }

  function getGeoErrorMessage(err) {
    const base = 'Không lấy được vị trí. Vui lòng bật định vị và mở cài đặt quyền vị trí của trình duyệt để cho phép.'
    const code = err?.code ?? err?.cause?.code
    if (code === 1) {
      return 'Bạn đã từ chối quyền định vị. Vui lòng mở cài đặt quyền vị trí của trình duyệt để cho phép và thử lại.'
    }
    if (code === 2) {
      return 'Không xác định được vị trí. Hãy bật GPS, kiểm tra tín hiệu hoặc thử lại.'
    }
    if (code === 3) {
      return 'Lấy vị trí quá lâu. Vui lòng kiểm tra GPS/mạng và thử lại.'
    }
    const msg = (err?.message || err?.cause?.message || '').toLowerCase()
    if (msg.includes('not supported')) {
      return 'Thiết bị hoặc trình duyệt không hỗ trợ định vị. Vui lòng dùng thiết bị khác.'
    }
    if (msg.includes('timeout')) {
      return 'Lấy vị trí quá lâu. Vui lòng kiểm tra GPS/mạng và thử lại.'
    }
    return base
  }

  useEffect(() => {
    const qName = typeof router.query.name === 'string' ? router.query.name.trim() : ''
    if (qName) setName(toTitleCaseVI(qName))
  }, [router.query.name])

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }) } catch {}
  }, [])

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'auto' }) } catch {}
  }, [currentStep])

  useEffect(() => {
    if (currentStep === 1 && nameInputRef.current) {
      try { nameInputRef.current.focus() } catch {}
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
      // eslint-disable-next-line no-throw-literal
      throw 'Route change aborted by user'
    }
    router.events.on('routeChangeStart', onRouteChangeStart)
    return () => router.events.off('routeChangeStart', onRouteChangeStart)
  }, [hasUnsavedChanges, router])

  function resetCreateForm() {
    setName('')
    setAddressDetail('')
    setWard('')
    setDistrict('')
    setPhone('')
    setNote('')
    setImageFile(null)
    setShowAdvanced(false)
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
    setFieldErrors({})
    if (router.query?.name) {
      try {
        const { name: _discard, ...rest } = router.query
        router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
      } catch {
        router.replace(router.pathname)
      }
    }
  }

  function normalizeNameForMatch(raw) {
    const base = removeVietnameseTones(String(raw || ''))
    return base
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function stripIgnoredPhrases(normalized) {
    const ignoredList = IGNORED_NAME_TERMS
      .map((t) => normalizeNameForMatch(t))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
    let out = ` ${normalized} `
    for (const phrase of ignoredList) {
      if (!phrase) continue
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\b${escaped}\\b`, 'g')
      out = out.replace(re, ' ')
    }
    return out.replace(/\s+/g, ' ').trim()
  }

  function extractWords(normalized) {
    const cleaned = stripIgnoredPhrases(normalized)
    return cleaned
      .split(' ')
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
  }

  function isSimilarNameByWords(inputWords, storeName, storeNameSearch) {
    const storeNorm = normalizeNameForMatch(storeNameSearch || storeName || '')
    if (!storeNorm || inputWords.length === 0) return false
    const storeWords = extractWords(storeNorm)
    if (storeWords.length === 0) return false
    const storeSet = new Set(storeWords)
    for (const w of inputWords) {
      if (storeSet.has(w)) return true
    }
    return false
  }

  function containsAllInputWords(inputWords, storeName, storeNameSearch) {
    if (!Array.isArray(inputWords) || inputWords.length === 0) return false
    const storeNorm = normalizeNameForMatch(storeNameSearch || storeName || '')
    if (!storeNorm) return false
    const storeWords = extractWords(storeNorm)
    if (storeWords.length === 0) return false
    const storeSet = new Set(storeWords)
    for (const w of inputWords) {
      if (!storeSet.has(w)) return false
    }
    return true
  }

  async function findNearbySimilarStores(lat, lng, inputName) {
    const inputNorm = normalizeNameForMatch(inputName)
    if (!inputNorm || lat == null || lng == null) return []
    const inputWords = extractWords(inputNorm)
    if (inputWords.length === 0) return []

    const latRad = (lat * Math.PI) / 180
    const deltaLat = DUPLICATE_RADIUS_KM / 111.32
    const deltaLon = DUPLICATE_RADIUS_KM / (111.32 * Math.cos(latRad) || 1)

    const orTerms = inputWords
      .map((w) => w.replace(/[%_]/g, ''))
      .filter(Boolean)
      .map((w) => `name_search.ilike.%${w}%`)
      .join(',')
    if (!orTerms) return []

    const { data, error } = await supabase
      .from('stores')
      .select('id, name, name_search, latitude, longitude, address_detail, ward, district, image_url, phone, note, active')
      .or(orTerms)
      .gte('latitude', lat - deltaLat)
      .lte('latitude', lat + deltaLat)
      .gte('longitude', lng - deltaLon)
      .lte('longitude', lng + deltaLon)
      .limit(50)

    if (error) throw error
    if (!Array.isArray(data)) return []

    const matches = data
      .filter((s) => isFinite(s?.latitude) && isFinite(s?.longitude))
      .map((s) => ({
        ...s,
        distance: haversineKm(lat, lng, s.latitude, s.longitude)
      }))
      .filter((s) => s.distance <= DUPLICATE_RADIUS_KM && isSimilarNameByWords(inputWords, s.name, s.name_search))
      .sort((a, b) => a.distance - b.distance)

    return matches
  }

  async function findGlobalExactNameMatches(inputName) {
    const inputNorm = normalizeNameForMatch(inputName)
    if (!inputNorm) return []

    const inputWords = extractWords(inputNorm)
    if (inputWords.length === 0) return []
    const orTerms = inputWords
      .map((w) => w.replace(/[%_]/g, ''))
      .filter(Boolean)
      .map((w) => `name_search.ilike.%${w}%`)
      .join(',')
    if (!orTerms) return []

    const { data, error } = await supabase
      .from('stores')
      .select('id, name, name_search, latitude, longitude, address_detail, ward, district, image_url, phone, note, active')
      .or(orTerms)
      .limit(200)

    if (error) throw error
    if (!Array.isArray(data)) return []

    return data
      .filter((s) => containsAllInputWords(inputWords, s.name, s.name_search))
      .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'vi'))
  }

  function mergeDuplicateCandidates(nearbyMatches = [], globalMatches = []) {
    const byId = new Map()
    globalMatches.forEach((s) => {
      byId.set(s.id, { ...s, matchScope: 'global' })
    })
    nearbyMatches.forEach((s) => {
      const existing = byId.get(s.id)
      byId.set(s.id, {
        ...(existing || {}),
        ...s,
        matchScope: existing ? 'nearby+global' : 'nearby'
      })
    })

    return Array.from(byId.values()).sort((a, b) => {
      const aHasDistance = typeof a.distance === 'number'
      const bHasDistance = typeof b.distance === 'number'
      if (aHasDistance && bHasDistance) return a.distance - b.distance
      if (aHasDistance) return -1
      if (bHasDistance) return 1
      return (a.name || '').localeCompare((b.name || ''), 'vi')
    })
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
    compassOnceRef.current = false
    requestCompassHeadingOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])



  async function requestCompassHeadingOnce() {
    if (compassOnceRef.current) return
    compassOnceRef.current = true
    setCompassError('')
    try {
      if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const res = await DeviceOrientationEvent.requestPermission()
          if (res !== 'granted') {
            setCompassError('Cần cho phép la bàn để xoay bản đồ theo hướng')
            return
          }
        } catch {
          setCompassError('Không thể xin quyền la bàn')
          return
        }
      }

      await new Promise((resolve) => {
        const samples = []
        let done = false

        const pushSample = (deg) => {
          const v = ((deg % 360) + 360) % 360
          samples.push(v)
          if (samples.length >= 5) {
            done = true
            window.removeEventListener('deviceorientation', handler, true)
            // circular mean
            const rad = samples.map((d) => (d * Math.PI) / 180)
            const sinSum = rad.reduce((a, r) => a + Math.sin(r), 0)
            const cosSum = rad.reduce((a, r) => a + Math.cos(r), 0)
            const mean = Math.atan2(sinSum / rad.length, cosSum / rad.length)
            const meanDeg = ((mean * 180) / Math.PI + 360) % 360
            setHeading(meanDeg)
            resolve()
          }
        }

        const handler = (event) => {
          if (done) return
          if (typeof event.webkitCompassHeading === 'number') {
            pushSample(event.webkitCompassHeading)
            return
          }
          if (typeof event.alpha === 'number') {
            const h = (360 - event.alpha) % 360
            pushSample(h)
          }
        }
        window.addEventListener('deviceorientation', handler, true)
        setTimeout(() => {
          if (!done) {
            window.removeEventListener('deviceorientation', handler, true)
            if (samples.length > 0) {
              const rad = samples.map((d) => (d * Math.PI) / 180)
              const sinSum = rad.reduce((a, r) => a + Math.sin(r), 0)
              const cosSum = rad.reduce((a, r) => a + Math.cos(r), 0)
              const mean = Math.atan2(sinSum / rad.length, cosSum / rad.length)
              const meanDeg = ((mean * 180) / Math.PI + 360) % 360
              setHeading(meanDeg)
            }
            resolve()
          }
        }, 1200)
      })
    } catch {}
  }

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
          attempts: 2,
          timeout: 3000,
          maxWaitTime: 6000,
          desiredAccuracy: 50
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

    const seq = ++duplicateCheckSeqRef.current
    setDuplicateCheckLoading(true)
    setDuplicateCheckError('')
    try {
      const [nearMatches, globalMatches] = await Promise.all([
        findNearbySimilarStores(checkLat, checkLng, trimmed),
        findGlobalExactNameMatches(trimmed),
      ])
      const matches = mergeDuplicateCandidates(nearMatches, globalMatches)
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

  function validateStep2AndGoNext() {
    const errs = {}
    if (!district.trim()) errs.district = 'Vui lòng nhập quận/huyện'
    if (!ward.trim()) errs.ward = 'Vui lòng nhập xã/phường'
    setFieldErrors((prev) => ({ ...prev, ...errs }))
    if (Object.keys(errs).length > 0) {
      showMessage('error', 'Vui lòng nhập đủ quận/huyện và xã/phường')
      return false
    }
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
        <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3 space-y-3 text-gray-100">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm">
              Phát hiện cửa hàng có thể đã được tạo
            </div>
          </div>
          <div className="space-y-2">
            {duplicateCandidates.map((s) => (
              <Dialog key={s.id}>
                <DialogTrigger asChild>
                  <Card className="border border-gray-800 bg-black/60 cursor-pointer hover:bg-gray-900/80 transition-colors">
                    <CardContent className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-100">
                          {s.name || 'Cửa hàng chưa đặt tên'}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400 line-clamp-2 flex items-start gap-1.5">
                          <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.893 2-1.995A2 2 0 0012 7a2 2 0 00-2 2.005C10 10.107 10.895 11 12 11z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z" />
                          </svg>
                          <span className="line-clamp-2 break-words">{formatAddressParts(s) || 'Không có địa chỉ'}</span>
                        </div>
                        {s.phone && (
                          <div className="mt-1 text-[11px] text-gray-300 truncate flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>{s.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {typeof s.distance === 'number' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-800 text-gray-200">
                            {formatDistance(s.distance)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-900/60 text-amber-200">
                            Trùng tên toàn hệ thống
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
                  <DetailStoreModalContent store={s} context="search" showEdit={false} />
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          Vui lòng xác nhận “Vẫn tạo cửa hàng” để tiếp tục.
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-10 text-sm sm:text-base border-gray-700 text-gray-200 hover:bg-gray-800"
            onClick={() => resetCreateForm()}
          >
            Quay lại
          </Button>
          <Button
            type="button"
            className="flex-1 h-10 text-sm sm:text-base"
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


  async function handleFillAddress() {
    try {
      setResolvingAddr(true)

      // Get GPS coordinates with improved logic
    const { coords, error } = await getBestPosition({
      attempts: 3,           // Giảm từ 4 → 3
      timeout: 4000,         // 4s thay vì 10s
      maxWaitTime: 8000,     // Tổng tối đa 8s
      desiredAccuracy: 25
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
        validateStep2AndGoNext()
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

    // Normalize name to Title Case before saving
    const normalizedName = toTitleCaseVI(name.trim())

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
      console.log('✅ Using edited map position:', { latitude, longitude })
    } else if (initialGPSLat != null && initialGPSLng != null) {
      // User did NOT edit map → use initial GPS
      latitude = initialGPSLat
      longitude = initialGPSLng
      console.log('✅ Using initial GPS position:', { latitude, longitude })
    } else if (pickedLat != null && pickedLng != null) {
      // Fallback: use whatever is on map
      latitude = pickedLat
      longitude = pickedLng
    } else {
      // Last resort: get current GPS
      try {
        const { coords, error } = await getBestPosition({ attempts: 4, timeout: 10000, desiredAccuracy: 25 })
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

    try {
      setLoading(true)

      // Final duplicate check right before submit (use final coordinates)
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
        return
      }

      const allDupes = mergeDuplicateCandidates(nearDupes, globalDupes)
      if (allDupes.length > 0 && !allowDuplicate) {
        setDuplicateCandidates(allDupes)
        showMessage('error', 'Phát hiện cửa hàng trùng/tương tự theo tên (gần đây hoặc toàn hệ thống). Vui lòng xác nhận nếu vẫn muốn tạo.')
        setLoading(false)
        return
      }

      let uploadResult = null
      let imageFilename = null
      if (imageFile) {
        // Nén ảnh với cài đặt vừa phải hơn để giữ chất lượng
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          initialQuality: 0.8,
          fileType: 'image/jpeg',
        }
        let fileToUpload = imageFile
        try {
          const compressed = await imageCompression(imageFile, options)
          fileToUpload = compressed
        } catch (cmpErr) {
          console.warn('Nén ảnh thất bại, dùng ảnh gốc:', cmpErr)
        }

        // Upload lên ImageKit nếu có ảnh
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

      const nameSearch = removeVietnameseTones(normalizedName)

      const normalizedDetail = toTitleCaseVI(addressDetail.trim())
      const normalizedWard = toTitleCaseVI(ward.trim())
      const normalizedDistrict = toTitleCaseVI(district.trim())

      const { error: insertError } = await supabase.from('stores').insert([
        {
          name: normalizedName,
          name_search: nameSearch,
          address_detail: normalizedDetail,
          ward: normalizedWard,
          district: normalizedDistrict,
          note,
          phone,
          image_url: imageFilename, // nullable when store has no image
          latitude,
          longitude,
        },
      ])

      if (insertError) {
        console.error(insertError)
        // Try to delete uploaded image on error
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
        return
      }

      // Success
      showMessage('success', 'Lưu thành công', 2500)
      e.target.reset()
      setName('')
      setAddressDetail('')
      setWard('')
      setDistrict('')
      setPhone('')
      setNote('')
      setImageFile(null)
      // Reset map states
      setPickedLat(null)
      setPickedLng(null)
      setMapEditable(false)
      setUserHasEditedMap(false)
      setInitialGPSLat(null)
      setInitialGPSLng(null)
      // Reset to step 1
      setCurrentStep(1)
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
      showMessage('error', 'Đã xảy ra lỗi khi tạo cửa hàng')
    } finally {
      setLoading(false)
    }
  }

  

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
      <FullPageLoading visible={loading} message="Đang tạo cửa hàng…" />
      <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-3 max-w-screen-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Step 1: Name */}
          {currentStep === 1 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Tên cửa hàng (bắt buộc)</Label>
                <Input
                  ref={nameInputRef}
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }))
                  }}
                  placeholder="Cửa hàng Tạp Hóa Minh Anh"
                  className="text-base sm:text-base"
                />
                {fieldErrors.name && (
                  <div className="text-xs text-red-600">{fieldErrors.name}</div>
                )}
                <div className="flex flex-wrap gap-2 py-1">
                  {NAME_SUGGESTIONS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900 px-3 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => {
                        setName((prev) => {
                          const base = (prev || '').trim()
                          if (!base) return `${label} `
                          const norm = removeVietnameseTones(base).toLowerCase()
                          const normLabel = removeVietnameseTones(label).toLowerCase()
                          if (norm.includes(normLabel)) return prev
                          return `${base} ${label} `
                        })
                        try { nameInputRef.current?.focus() } catch {}
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {duplicateCheckLoading && (
                  <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-200">
                    Đang kiểm tra trùng tên gần đây và toàn hệ thống…
                  </div>
                )}
                {renderDuplicatePanel()}
              </div>

              {(allowDuplicate || duplicateCandidates.length === 0) ? (
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!duplicateCheckDone) {
                        runDuplicateCheckByButton()
                        return
                      }
                      if (nameValid || allowDuplicate) setCurrentStep(2)
                    }}
                    className="w-full text-sm sm:text-base"
                  >
                    {duplicateCheckDone ? 'Tiếp theo →' : 'Kiểm tra tên'}
                  </Button>
                </div>
              ) : null}
            </>
          )}

          {/* Step 2: Address + Image */}
          {currentStep === 2 && (
            <>
              {/* Địa chỉ */}
              <div className="space-y-1.5">
                <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Địa chỉ (bắt buộc)</Label>
                <div className="grid gap-2">
                  <Input
                    id="district"
                    value={district}
                    onChange={(e) => {
                      setDistrict(e.target.value)
                      if (fieldErrors.district) setFieldErrors((prev) => ({ ...prev, district: '' }))
                    }}
                    onBlur={() => { if (district) setDistrict(toTitleCaseVI(district.trim())) }}
                    placeholder="Quận / Huyện"
                    className="text-base sm:text-base"
                  />
                  {!(DISTRICT_SUGGESTIONS.some((d) => removeVietnameseTones(d).toLowerCase() === removeVietnameseTones(district || '').toLowerCase())) && (
                    <div className="flex flex-wrap gap-2">
                      {DISTRICT_SUGGESTIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900 px-2 py-0.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => {
                            setDistrict(d)
                            setWard('')
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                  {fieldErrors.district && (
                    <div className="text-xs text-red-600">{fieldErrors.district}</div>
                  )}
                  <Input
                    id="ward"
                    value={ward}
                    onChange={(e) => {
                      setWard(e.target.value)
                      if (fieldErrors.ward) setFieldErrors((prev) => ({ ...prev, ward: '' }))
                    }}
                    onBlur={() => { if (ward) setWard(toTitleCaseVI(ward.trim())) }}
                    placeholder="Xã / Phường"
                    className="text-base sm:text-base"
                  />
                  {fieldErrors.ward && (
                    <div className="text-xs text-red-600">{fieldErrors.ward}</div>
                  )}
                  {district && !(DISTRICT_WARD_SUGGESTIONS[district] || []).some((w) => removeVietnameseTones(w).toLowerCase() === removeVietnameseTones(ward || '').toLowerCase()) && (
                    <div className="flex flex-wrap gap-2">
                      {(DISTRICT_WARD_SUGGESTIONS[district] || []).map((w) => (
                        <button
                          key={w}
                          type="button"
                          className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900 px-2 py-0.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => setWard(w)}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input
                    id="address_detail"
                    value={addressDetail}
                    onChange={(e) => {
                      setAddressDetail(e.target.value)
                      if (fieldErrors.address_detail) setFieldErrors((prev) => ({ ...prev, address_detail: '' }))
                    }}
                    onBlur={() => { if (addressDetail) setAddressDetail(toTitleCaseVI(addressDetail.trim())) }}
                    placeholder="Địa chỉ cụ thể (số nhà, đường, thôn/xóm/đội...)"
                    className="text-base sm:text-base"
                  />
                  {fieldErrors.address_detail && (
                    <div className="text-xs text-red-600">{fieldErrors.address_detail}</div>
                  )}
                </div>
              </div>

              {/* Ảnh */}
              <div className="space-y-1.5">
                <Label htmlFor="image" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ảnh cửa hàng (không bắt buộc)</Label>
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
                    <label htmlFor="image" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                      <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4a1 1 0 011-1h8a1 1 0 011 1v12m-4 4h-4a1 1 0 01-1-1v-4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1z" /></svg>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Chụp ảnh</span>
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
                      className="text-base sm:text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ghi chú</Label>
                    <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bán từ 6:00 - 22:00 (nghỉ trưa 12h-13h)" className="text-base sm:text-base" />
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="w-1/3 text-sm sm:text-base"
                >
                  ← Quay lại
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    validateStep2AndGoNext()
                  }}
                  className="flex-1 text-sm sm:text-base"
                >
                  Tiếp theo: Xác định vị trí →
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <>
              {/* Map Picker */}
              <div className="pt-1" ref={mapWrapperRef}>
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
                />
              </div>

          {/* Back and Submit buttons for step 3 */}
          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="w-1/3 text-sm sm:text-base"
            >
              ← Quay lại
            </Button>
            <Button
              type="submit"
              disabled={loading || resolvingAddr || geoBlocked}
              className="flex-1 text-sm sm:text-base"
            >
              {loading || resolvingAddr ? 'Đang thêm…' : 'Lưu cửa hàng'}
            </Button>
          </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
