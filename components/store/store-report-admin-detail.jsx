import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { REPORT_REASON_OPTIONS } from '@/lib/constants'
import { formatAddressParts } from '@/lib/utils'
import { summarizeStoreReport, STORE_REPORT_EDIT_FIELDS } from '@/helper/storeReportFlow'
import { formatDateTime } from '@/helper/validation'

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

export default function StoreReportAdminDetail({
  report,
  isLoading = false,
  onApprove,
  onReject,
  topAction = null,
}) {
  if (!report) return null

  const store = report.store
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
    <Card className="rounded-2xl border border-gray-800">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                isEdit
                  ? 'bg-blue-950/60 text-blue-200 border border-blue-900'
                  : 'bg-amber-950/60 text-amber-200 border border-amber-900'
              }`}>
                {isEdit ? 'Báo cáo sửa thông tin' : 'Báo cáo vấn đề'}
              </span>
              <span className="text-xs text-gray-500">{formatDateTime(report.created_at)}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-100">{store?.name || 'Cửa hàng không rõ'}</h2>
            <p className="text-sm text-gray-400">{formatAddressParts(store) || 'Chưa có địa chỉ'}</p>
          </div>
          {topAction}
        </div>

        {isEdit ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-gray-100">Thông tin đề xuất</h3>
              <p className="text-sm text-gray-400">So sánh dữ liệu hiện tại với nội dung người dùng muốn cập nhật.</p>
            </div>

            <div className="space-y-2">
              {changedFields.map((field) => (
                <div key={field.key} className="rounded-xl border border-gray-800 bg-gray-950/80 p-3">
                  <p className="text-sm font-medium text-gray-200">{field.label}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-800 bg-black/40 p-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Hiện tại</p>
                      <p className="mt-1 text-sm text-gray-300">{formatValue(field.key, store?.[field.key])}</p>
                    </div>
                    <div className="rounded-lg border border-blue-900 bg-blue-950/20 p-2">
                      <p className="text-xs uppercase tracking-wide text-blue-300">Đề xuất</p>
                      <p className="mt-1 text-sm text-blue-100">{formatValue(field.key, reportSummary.proposed[field.key])}</p>
                    </div>
                  </div>
                </div>
              ))}

              {reportSummary.hasLocation ? (
                <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-3">
                  <p className="text-sm font-medium text-gray-200">Vị trí</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-800 bg-black/40 p-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Hiện tại</p>
                      <p className="mt-1 text-sm text-gray-300">{locationOld}</p>
                    </div>
                    <div className="rounded-lg border border-blue-900 bg-blue-950/20 p-2">
                      <p className="text-xs uppercase tracking-wide text-blue-300">Đề xuất</p>
                      <p className="mt-1 text-sm text-blue-100">{locationNew}</p>
                    </div>
                  </div>
                  {canShowDirection ? (
                    <div className="mt-3">
                      <Button asChild variant="outline" size="sm">
                        <a href={`/map?storeId=${encodeURIComponent(store?.id || '')}&lat=${encodeURIComponent(nextLat)}&lng=${encodeURIComponent(nextLng)}`}>
                          Xem trên bản đồ
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-gray-100">Lý do báo cáo</h3>
              <p className="text-sm text-gray-400">Người dùng chỉ báo vấn đề, không đề xuất sửa dữ liệu trực tiếp.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(report.reason_codes || []).map((code) => (
                <span key={code} className="inline-flex rounded-full border border-amber-900 bg-amber-950/50 px-3 py-1 text-sm text-amber-200">
                  {reasonLabelMap[code] || code}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
          <Button type="button" variant="outline" disabled={isLoading} onClick={onReject}>
            Từ chối
          </Button>
          <Button type="button" variant="outline" disabled={isLoading} onClick={onApprove}>
            {isEdit ? 'Cập nhật' : 'Đã xử lý'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
