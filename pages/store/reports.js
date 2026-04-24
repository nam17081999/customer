import Head from 'next/head'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { REPORT_REASON_OPTIONS } from '@/lib/constants'
import { formatAddressParts } from '@/lib/utils'
import { summarizeStoreReport, STORE_REPORT_EDIT_FIELDS } from '@/helper/storeReportFlow'
import { formatDateTime } from '@/helper/validation'
import { useStoreReportsController } from '@/helper/useStoreReportsController'

const storeTypeLabelMap = {
  tap_hoa: 'Tạp hóa',
  quan_an: 'Quán ăn - Quán cơm',
  quan_nuoc: 'Quán nước',
  kho: 'Kho',
  karaoke: 'Karaoke',
}

const reasonLabelMap = REPORT_REASON_OPTIONS.reduce((acc, item) => {
  acc[item.code] = item.label
  return acc
}, {})

function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'store_type') return storeTypeLabelMap[value] || String(value)
  if (key === 'latitude' || key === 'longitude') {
    const num = Number(value)
    if (!Number.isFinite(num)) return '—'
    return num.toFixed(6)
  }
  return String(value)
}

export default function StoreReportsPage() {
  const {
    authLoading,
    pageReady,
    reports,
    loading,
    error,
    message,
    actionLoading,
    confirmAction,
    loadReports,
    handleReject,
    openConfirmAction,
    closeConfirmAction,
    handleConfirmAction,
  } = useStoreReportsController()

  const pendingCount = reports.length
  const hasReports = pendingCount > 0

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
        <title>Báo cáo cửa hàng - NPP Hà Công</title>
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

          {!loading && !hasReports && (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
              Hiện chưa có báo cáo cần xử lý.
            </div>
          )}

          <div className="space-y-3">
            {reports.map((report) => {
              const store = report.store
              const reportId = report.id
              const isLoading = Boolean(actionLoading[reportId])
              const isEdit = report.report_type === 'edit'
              const reportSummary = summarizeStoreReport(report)
              const changedKeys = Object.keys(reportSummary.proposed)
              const changedFields = STORE_REPORT_EDIT_FIELDS
                .filter((field) => !['latitude', 'longitude'].includes(field.key))
                .filter((field) => changedKeys.includes(field.key))
              const currentLat = store?.latitude
              const currentLng = store?.longitude
              const nextLat = reportSummary.proposed.latitude ?? currentLat
              const nextLng = reportSummary.proposed.longitude ?? currentLng
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
                        {changedFields.length === 0 && !reportSummary.hasLocation && (
                          <div className="text-sm text-gray-400">Không có thay đổi cụ thể.</div>
                        )}

                        {changedFields.map((field) => (
                          <div key={field.key} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                            <p className="text-sm font-medium text-gray-200">{field.label}</p>
                            <p className="text-sm text-gray-500 line-through">
                              {formatValue(field.key, store?.[field.key])}
                            </p>
                            <p className="text-sm text-green-300">
                              {formatValue(field.key, reportSummary.proposed[field.key])}
                            </p>
                          </div>
                        ))}

                        {reportSummary.hasLocation && (
                          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                            <p className="text-sm font-medium text-gray-200">Vị trí</p>
                            <p className="text-sm text-gray-500 line-through">{locationOld}</p>
                            <p className="text-sm text-green-300">{locationNew}</p>
                          </div>
                        )}

                        {reportSummary.hasLocation && canShowDirection && (
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

      <Dialog open={confirmAction.open} onOpenChange={(open) => {
        if (open) return
        closeConfirmAction()
      }}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-md p-0 overflow-hidden">
          <div className="p-4 space-y-3">
            <DialogTitle className="text-base font-semibold text-gray-100">Xác nhận duyệt</DialogTitle>
            <DialogDescription className="text-sm text-gray-400">
              {confirmAction.type === 'edit'
                ? 'Duyệt và cập nhật cửa hàng theo đề xuất?'
                : 'Đánh dấu báo cáo này là đã xử lý?'}
            </DialogDescription>

            {confirmAction.report && (
              <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-1">
                <p className="text-sm text-gray-200">
                  Cửa hàng: {confirmAction.report.store?.name || 'Không rõ'}
                </p>
                {confirmAction.type === 'edit' && (() => {
                  const summary = summarizeStoreReport(confirmAction.report)
                  const nextLat = summary.proposed.latitude ?? confirmAction.report.store?.latitude
                  const nextLng = summary.proposed.longitude ?? confirmAction.report.store?.longitude
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
              <Button type="button" className="flex-1" onClick={handleConfirmAction}>
                Xác nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
