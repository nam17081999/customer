import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatAddressParts } from '@/lib/utils'
import { REPORT_REASON_OPTIONS } from '@/lib/constants'
import { getOrRefreshStores, invalidateStoreCache } from '@/lib/storeCache'
import { formatDateTime } from '@/helper/validation'

const reasonLabelMap = REPORT_REASON_OPTIONS.reduce((acc, item) => {
  acc[item.code] = item.label
  return acc
}, {})

const EDIT_FIELDS = [
  { key: 'name', label: 'Tên' },
  { key: 'address_detail', label: 'Địa chỉ chi tiết' },
  { key: 'ward', label: 'Xã/Phường' },
  { key: 'district', label: 'Quận/Huyện' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'latitude', label: 'Vĩ độ' },
  { key: 'longitude', label: 'Kinh độ' },
]

const formatValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'latitude' || key === 'longitude') {
    const num = Number(value)
    if (!Number.isFinite(num)) return '—'
    return num.toFixed(6)
  }
  return String(value)
}

export default function StoreReportsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [actionLoading, setActionLoading] = useState({})
  const [pendingStoreCount, setPendingStoreCount] = useState(0)
  const [confirmAction, setConfirmAction] = useState({ open: false, type: '', report: null })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setPageReady(false)
      router.replace('/login?from=/store/reports')
      return
    }
    setPageReady(true)
  }, [authLoading, user, router])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const { data, error: fetchError } = await supabase
        .from('store_reports')
        .select('id, store_id, report_type, reason_codes, reason_note, proposed_changes, status, created_at, store:stores!inner(id, name, address_detail, ward, district, phone, note, latitude, longitude, image_url, active, deleted_at)')
        .eq('status', 'pending')
        .is('stores.deleted_at', null)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setReports(data || [])
    } catch (err) {
      console.error(err)
      setReports([])
      setError('Không tải được danh sách báo cáo. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPendingStoreCount = useCallback(async () => {
    try {
      const allStores = await getOrRefreshStores()
      const count = (allStores || []).filter((store) => store.active !== true).length
      setPendingStoreCount(count)
    } catch {
      setPendingStoreCount(0)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    loadReports()
    loadPendingStoreCount()
  }, [pageReady, loadReports, loadPendingStoreCount])

  const handleReject = async (reportId) => {
    setActionLoading((prev) => ({ ...prev, [reportId]: true }))
    const { error: updateError } = await supabase
      .from('store_reports')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', reportId)

    if (updateError) {
      setError('Từ chối thất bại. Vui lòng thử lại.')
    } else {
      setReports((prev) => prev.filter((item) => item.id !== reportId))
      setMessage('Đã từ chối báo cáo.')
    }
    setActionLoading((prev) => ({ ...prev, [reportId]: false }))
  }

  const handleApproveReason = async (reportId) => {
    setActionLoading((prev) => ({ ...prev, [reportId]: true }))
    const { error: updateError } = await supabase
      .from('store_reports')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', reportId)

    if (updateError) {
      setError('Cập nhật thất bại. Vui lòng thử lại.')
    } else {
      setReports((prev) => prev.filter((item) => item.id !== reportId))
      setMessage('Đã đánh dấu báo cáo.')
    }
    setActionLoading((prev) => ({ ...prev, [reportId]: false }))
  }

  const handleApproveEdit = async (report) => {
    const reportId = report.id
    setActionLoading((prev) => ({ ...prev, [reportId]: true }))
    setError('')

    const proposed = report.proposed_changes || {}
    const storeId = report.store_id

    if (!storeId || Object.keys(proposed).length === 0) {
      setError('Không có thay đổi để cập nhật.')
      setActionLoading((prev) => ({ ...prev, [reportId]: false }))
      return
    }

    const { error: updateStoreError } = await supabase
      .from('stores')
      .update({ ...proposed, updated_at: new Date().toISOString() })
      .eq('id', storeId)

    if (updateStoreError) {
      console.error(updateStoreError)
      setError('Không cập nhật được cửa hàng. Vui lòng thử lại.')
      setActionLoading((prev) => ({ ...prev, [reportId]: false }))
      return
    }

    const { error: updateReportError } = await supabase
      .from('store_reports')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', reportId)

    if (updateReportError) {
      setError('Cập nhật trạng thái báo cáo thất bại.')
    } else {
      setReports((prev) => prev.filter((item) => item.id !== reportId))
      setMessage('Đã duyệt cập nhật cửa hàng.')
      await invalidateStoreCache()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('storevis:stores-changed', {
            detail: { id: storeId, shouldRefetchAll: true },
          })
        )
      }
    }

    setActionLoading((prev) => ({ ...prev, [reportId]: false }))
  }

  const openConfirmAction = (type, report) => {
    setConfirmAction({ open: true, type, report })
  }

  const closeConfirmAction = () => {
    setConfirmAction({ open: false, type: '', report: null })
  }

  const getReportSummary = (report) => {
    const proposed = report?.proposed_changes || {}
    const keys = Object.keys(proposed)
    const hasLocation = keys.includes('latitude') || keys.includes('longitude')
    const fieldCount = keys.filter((key) => !['latitude', 'longitude'].includes(key)).length + (hasLocation ? 1 : 0)
    return { hasLocation, fieldCount, proposed }
  }

  const pendingCount = reports.length
  const hasReports = pendingCount > 0

  const emptyState = (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
      Hiện chưa có báo cáo cần xử lý.
    </div>
  )

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-6">
          <p className="text-sm text-gray-400">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    )
  }

  if (!pageReady) return null

  return (
    <>
      <Head>
        <title>Báo cáo cửa hàng - StoreVis</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-100">Báo cáo cửa hàng</h1>
                  <p className="text-sm text-gray-400">Duyệt báo cáo người dùng gửi về</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadReports} disabled={loading}>
                  {loading ? 'Đang tải...' : 'Làm mới'}
                </Button>
              </div>
              <div className="rounded-xl bg-blue-950/30 border border-blue-900 p-3">
                <p className="text-sm text-blue-200">Báo cáo chờ xử lý</p>
                <p className="text-2xl font-bold text-blue-100">{pendingCount}</p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-300">
                  {message}
                </div>
              )}
            </CardContent>
          </Card>

          {!loading && !hasReports && emptyState}

          <div className="space-y-3">
            {reports.map((report) => {
              const store = report.store
              const reportId = report.id
              const isLoading = Boolean(actionLoading[reportId])
              const isEdit = report.report_type === 'edit'
              const proposed = report.proposed_changes || {}
              const changedKeys = Object.keys(proposed)
              const baseFields = EDIT_FIELDS.filter((field) => !['latitude', 'longitude'].includes(field.key))
              const changedFields = baseFields.filter((field) => changedKeys.includes(field.key))
              const hasLocationChange = changedKeys.includes('latitude') || changedKeys.includes('longitude')
              const currentLat = store?.latitude
              const currentLng = store?.longitude
              const nextLat = proposed.latitude ?? currentLat
              const nextLng = proposed.longitude ?? currentLng
              const canShowDirection = Number.isFinite(Number(nextLat)) && Number.isFinite(Number(nextLng))
              const locationOld = `${formatValue('latitude', currentLat)}, ${formatValue('longitude', currentLng)}`
              const locationNew = `${formatValue('latitude', nextLat)}, ${formatValue('longitude', nextLng)}`

              return (
                <Card key={reportId} className="rounded-2xl border border-gray-800">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-100 break-words">
                          {store?.name || 'Cửa hàng không rõ'}
                        </h2>
                        <p className="text-sm text-gray-400 break-words">
                          {store ? formatAddressParts(store) : 'Không có địa chỉ'}
                        </p>
                        <p className="text-sm text-gray-500">{formatDateTime(report.created_at)}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${isEdit ? 'bg-amber-900/50 text-amber-200' : 'bg-slate-800 text-slate-200'}`}>
                        {isEdit ? 'Sửa' : 'Báo cáo'}
                      </span>
                    </div>

                    {!isEdit && (
                      <div className="flex flex-wrap gap-2">
                        {(report.reason_codes || []).map((code) => (
                          <span key={code} className="rounded-full bg-gray-800 text-gray-200 text-sm px-3 py-1">
                            {reasonLabelMap[code] || code}
                          </span>
                        ))}
                      </div>
                    )}

                    {isEdit && (
                      <div className="space-y-2">
                        {changedFields.length === 0 && !hasLocationChange && (
                          <div className="text-sm text-gray-400">Không có thay đổi cụ thể.</div>
                        )}
                        {changedFields.map((field) => (
                          <div key={field.key} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                            <p className="text-sm font-medium text-gray-200">{field.label}</p>
                            <p className="text-sm text-gray-500 line-through">
                              {formatValue(field.key, store?.[field.key])}
                            </p>
                            <p className="text-sm text-green-300">
                              {formatValue(field.key, proposed[field.key])}
                            </p>
                          </div>
                        ))}
                        {hasLocationChange && (
                          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                            <p className="text-sm font-medium text-gray-200">Vị trí</p>
                            <p className="text-sm text-gray-500 line-through">{locationOld}</p>
                            <p className="text-sm text-green-300">{locationNew}</p>
                          </div>
                        )}
                        {hasLocationChange && canShowDirection && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => window.open(`https://www.google.com/maps?q=${Number(nextLat)},${Number(nextLng)}`, '_blank')}
                          >
                            Chỉ đường (vị trí mới)
                          </Button>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={isLoading}
                        onClick={() => handleReject(reportId)}
                      >
                        Từ chối
                      </Button>
                      {isEdit ? (
                        <Button
                          type="button"
                          className="w-full"
                          disabled={isLoading}
                          onClick={() => openConfirmAction('edit', report)}
                        >
                          Cập nhật
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="w-full"
                          disabled={isLoading}
                          onClick={() => openConfirmAction('reason', report)}
                        >
                          Đã xử lý
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
      <Dialog open={confirmAction.open} onOpenChange={(open) => setConfirmAction((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-md p-0 overflow-hidden">
          <div className="p-4 space-y-3">
            <h3 className="text-base font-semibold text-gray-100">Xác nhận duyệt</h3>
            <p className="text-sm text-gray-400">
              {confirmAction.type === 'edit'
                ? 'Duyệt và cập nhật cửa hàng theo đề xuất?'
                : 'Đánh dấu báo cáo này là đã xử lý?'}
            </p>
            {confirmAction.report && (
              <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-1">
                <p className="text-sm text-gray-200">
                  Cửa hàng: {confirmAction.report.store?.name || 'Không rõ'}
                </p>
                {confirmAction.type === 'edit' && (() => {
                  const summary = getReportSummary(confirmAction.report)
                  const proposed = summary.proposed || {}
                  const nextLat = proposed.latitude ?? confirmAction.report.store?.latitude
                  const nextLng = proposed.longitude ?? confirmAction.report.store?.longitude
                  return (
                    <>
                      <p className="text-sm text-gray-400">Số thay đổi: {summary.fieldCount}</p>
                      {summary.hasLocation && (
                        <p className="text-sm text-gray-400">
                          Vị trí mới: {formatValue('latitude', nextLat)}, {formatValue('longitude', nextLng)}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeConfirmAction}>
                Hủy
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  const report = confirmAction.report
                  const type = confirmAction.type
                  closeConfirmAction()
                  if (!report) return
                  if (type === 'edit') handleApproveEdit(report)
                  if (type === 'reason') handleApproveReason(report.id)
                }}
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
