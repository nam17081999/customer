import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_STORE_TYPE } from '@/lib/constants'
import { getBestPosition, getGeoErrorMessage } from '@/helper/geolocation'
import { supabase } from '@/lib/supabaseClient'
import {
  buildStoreReportPayload,
  getStoreReportSuccessMessage,
  normalizeStoreReportCoordinate,
  validateStoreReportSubmission,
} from '@/helper/storeReportFlow'
import { resolveMapsLinkCoordinates } from '@/helper/storeFormShared'
import { scrollToFirstMatchingTarget } from '@/helper/formViewport'

function getReportErrorSelectors(message) {
  const errorText = String(message || '')

  if (!errorText) return []
  if (errorText.includes('Tên cửa hàng')) return ['#report-name']
  if (errorText.includes('quận/huyện') || errorText.includes('xã/phường')) {
    return ['#report-district-section', '#report-ward-section']
  }
  if (errorText.includes('điện thoại') || errorText.includes('0, 84 hoặc +84')) {
    return ['#report-phone']
  }
  if (errorText.includes('Vị trí chưa hợp lệ') || errorText.includes('vị trí')) {
    return ['#report-location-section']
  }

  return []
}
export function useStoreReportFormController({ store, user, onSubmitted, initialMode = '' }) {
  const [mode, setMode] = useState(initialMode)
  const [reasons, setReasons] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  const [reportName, setReportName] = useState(store?.name || '')
  const [reportStoreType, setReportStoreType] = useState(store?.store_type || DEFAULT_STORE_TYPE)
  const [reportAddressDetail, setReportAddressDetail] = useState(store?.address_detail || '')
  const [reportWard, setReportWard] = useState(store?.ward || '')
  const [reportDistrict, setReportDistrict] = useState(store?.district || '')
  const [reportPhone, setReportPhone] = useState(store?.phone || '')
  const [reportNote, setReportNote] = useState(store?.note || '')
  const [reportLat, setReportLat] = useState(normalizeStoreReportCoordinate(store?.latitude))
  const [reportLng, setReportLng] = useState(normalizeStoreReportCoordinate(store?.longitude))
  const [mapEditable, setMapEditable] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [mapsLink, setMapsLink] = useState('')
  const [mapsLinkLoading, setMapsLinkLoading] = useState(false)
  const [mapsLinkError, setMapsLinkError] = useState('')
  const [mapKey, setMapKey] = useState(0)

  const resetFeedback = useCallback(() => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    setMsgState((prev) => ({ ...prev, show: false }))
  }, [])

  useEffect(() => () => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
  }, [])

  const showMessage = useCallback((type, text, duration = 3000) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    setMsgState({ type, text, show: true })
    msgTimerRef.current = setTimeout(() => {
      setMsgState((prev) => ({ ...prev, show: false }))
    }, duration)
  }, [])

  const toggleReason = (code) => {
    setReasons((prev) => (
      prev.includes(code)
        ? prev.filter((item) => item !== code)
        : [...prev, code]
    ))
  }

  const showErrorWithScroll = (message) => {
    showMessage('error', message)
    scrollToFirstMatchingTarget(getReportErrorSelectors(message))
    return false
  }

  const validateEditStep = (step) => {
    if (step === 1) {
      if (!String(reportName || '').trim()) {
        return showErrorWithScroll('Tên cửa hàng không được để trống.')
      }
      return true
    }

    if (step === 2) {
      if (!String(reportDistrict || '').trim() || !String(reportWard || '').trim()) {
        return showErrorWithScroll('Vui lòng nhập đủ quận/huyện và xã/phường.')
      }

      const rawPhone = String(reportPhone || '').trim()
      if (rawPhone) {
        const validation = validateStoreReportSubmission({
          mode: 'edit',
          reasons,
          store,
          values: {
            name: reportName,
            storeType: reportStoreType,
            addressDetail: reportAddressDetail,
            ward: reportWard,
            district: reportDistrict,
            phone: reportPhone,
            note: reportNote,
            latitude: store?.latitude,
            longitude: store?.longitude,
          },
        })

        if (validation.error && validation.error !== 'Bạn chưa thay đổi thông tin nào.') {
          return showErrorWithScroll(validation.error)
        }
      }
    }

    return true
  }
  const handleGetLocation = async () => {
    try {
      setResolving(true)
      resetFeedback()
      const { coords, error: geoError } = await getBestPosition({
        maxWaitTime: 2000,
        desiredAccuracy: 15,
        skipCache: true,
      })

      if (!coords) {
        showErrorWithScroll(getGeoErrorMessage(geoError))
        return
      }

      setReportLat(coords.latitude)
      setReportLng(coords.longitude)
      setMapKey((value) => value + 1)
      showMessage('success', 'Đã cập nhật vị trí GPS mới.')
    } catch (err) {
      console.error('Get location error:', err)
      showErrorWithScroll(getGeoErrorMessage(err))
    } finally {
      setResolving(false)
    }
  }

  const handleMapsLink = async (link) => {
    const trimmed = String(link || '').trim()
    setMapsLink(trimmed)
    setMapsLinkError('')
    if (!trimmed) return

    setMapsLinkLoading(true)
    const { coords, error: linkError } = await resolveMapsLinkCoordinates(trimmed)
    if (coords) {
      setReportLat(coords.lat)
      setReportLng(coords.lng)
      setMapEditable(false)
      setMapKey((value) => value + 1)
      showMessage('success', `Đã lấy vị trí: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
    } else {
      setMapsLinkError(linkError)
    }
    setMapsLinkLoading(false)
  }

  const handleSubmit = async () => {
    if (submitting) return
    resetFeedback()

    const validation = validateStoreReportSubmission({
      mode,
      reasons,
      store,
      values: {
        name: reportName,
        storeType: reportStoreType,
        addressDetail: reportAddressDetail,
        ward: reportWard,
        district: reportDistrict,
        phone: reportPhone,
        note: reportNote,
        latitude: reportLat,
        longitude: reportLng,
      },
    })

    if (validation.error) {
      showErrorWithScroll(validation.error)
      return
    }

    const payload = buildStoreReportPayload({
      storeId: store.id,
      mode,
      reasons,
      proposedChanges: validation.proposedChanges,
      reporterId: user?.id,
    })

    setSubmitting(true)
    const { error: submitError } = await supabase.from('store_reports').insert([payload])

    if (submitError) {
      console.error(submitError)
      showErrorWithScroll('Không gửi được báo cáo, vui lòng thử lại.')
      setSubmitting(false)
      return
    }

    const doneMessage = getStoreReportSuccessMessage()
    showMessage('success', doneMessage)
    onSubmitted?.(doneMessage)
    setSubmitting(false)
  }

  return {
    mode,
    setMode,
    reasons,
    submitting,
    msgState,
    reportName,
    setReportName,
    reportStoreType,
    setReportStoreType,
    reportAddressDetail,
    setReportAddressDetail,
    reportWard,
    setReportWard,
    reportDistrict,
    setReportDistrict,
    reportPhone,
    setReportPhone,
    reportNote,
    setReportNote,
    reportLat,
    setReportLat,
    reportLng,
    setReportLng,
    mapEditable,
    setMapEditable,
    resolving,
    currentStep,
    setCurrentStep,
    mapsLink,
    setMapsLink,
    mapsLinkLoading,
    mapsLinkError,
    mapKey,
    toggleReason,
    resetFeedback,
    handleGetLocation,
    handleMapsLink,
    validateEditStep,
    handleSubmit,
  }
}


