import { useMemo, useState } from 'react'
import { DEFAULT_STORE_TYPE, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import { getBestPosition, getGeoErrorMessage } from '@/helper/geolocation'
import { supabase } from '@/lib/supabaseClient'
import {
  buildStoreReportPayload,
  getStoreReportSuccessMessage,
  normalizeStoreReportCoordinate,
  validateStoreReportSubmission,
} from '@/helper/storeReportFlow'

export function useStoreReportFormController({ store, user, onSubmitted }) {
  const [mode, setMode] = useState('')
  const [reasons, setReasons] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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

  const wardSuggestions = useMemo(() => (
    reportDistrict ? (DISTRICT_WARD_SUGGESTIONS[reportDistrict] || []) : []
  ), [reportDistrict])

  const resetFeedback = () => {
    setError('')
    setSuccess('')
  }

  const toggleReason = (code) => {
    setReasons((prev) => (
      prev.includes(code)
        ? prev.filter((item) => item !== code)
        : [...prev, code]
    ))
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
        setError(getGeoErrorMessage(geoError))
        return
      }

      setReportLat(coords.latitude)
      setReportLng(coords.longitude)
      setSuccess('Đã cập nhật vị trí GPS mới.')
    } catch (err) {
      console.error('Get location error:', err)
      setError(getGeoErrorMessage(err))
    } finally {
      setResolving(false)
    }
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
      setError(validation.error)
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
      setError('Không gửi được báo cáo, vui lòng thử lại.')
      setSubmitting(false)
      return
    }

    const doneMessage = getStoreReportSuccessMessage()
    setSuccess(doneMessage)
    onSubmitted?.(doneMessage)
    setSubmitting(false)
  }

  return {
    mode,
    setMode,
    reasons,
    submitting,
    error,
    success,
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
    wardSuggestions,
    toggleReason,
    resetFeedback,
    handleGetLocation,
    handleSubmit,
  }
}
