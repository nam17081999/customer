import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_STORE_TYPE,
  DISTRICT_SUGGESTIONS,
  REPORT_REASON_OPTIONS,
  STORE_TYPE_OPTIONS,
} from '@/lib/constants'
import { useStoreReportFormController } from '@/helper/useStoreReportFormController'

const StoreLocationPicker = dynamic(
  () => import('@/components/map/store-location-picker'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-2xl bg-gray-900">
        <span className="text-sm text-gray-400 animate-pulse">Đang tải bản đồ…</span>
      </div>
    ),
  }
)

export default function StoreReportForm({ store, user, onSubmitted }) {
  const controller = useStoreReportFormController({ store, user, onSubmitted })
  const {
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
  } = controller

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
        <p className="text-base font-semibold text-gray-100">Chọn cách báo cáo</p>
        <p className="mt-1 text-sm text-gray-400">
          Tách riêng khỏi modal để dễ nhập liệu hơn trên điện thoại.
        </p>
        {!mode && (
          <div className="mt-4 grid gap-2">
            <Button type="button" className="w-full" onClick={() => setMode('edit')}>
              Sửa thông tin
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setMode('reason')}>
              Chỉ báo cáo vấn đề
            </Button>
          </div>
        )}
      </div>

      {mode === 'reason' && (
        <div className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4 space-y-3">
          <div>
            <p className="text-base font-semibold text-gray-100">Lý do báo cáo</p>
            <p className="mt-1 text-sm text-gray-400">Có thể chọn nhiều lý do.</p>
          </div>
          <div className="grid gap-2">
            {REPORT_REASON_OPTIONS.map((option) => {
              const active = reasons.includes(option.code)
              return (
                <button
                  key={option.code}
                  type="button"
                  className={`flex min-h-11 items-center justify-between rounded-xl border px-3 py-3 text-left text-base transition ${
                    active
                      ? 'border-blue-500 bg-blue-500/15 text-blue-100'
                      : 'border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                  }`}
                  onClick={() => toggleReason(option.code)}
                  aria-pressed={active}
                >
                  <span>{option.label}</span>
                  <span className={`text-sm ${active ? 'text-blue-300' : 'text-gray-500'}`}>
                    {active ? 'Đã chọn' : 'Chọn'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4 space-y-4">
            <div>
              <p className="text-base font-semibold text-gray-100">Thông tin đề xuất</p>
              <p className="mt-1 text-sm text-gray-400">Nhập lại các trường cần chỉnh sửa.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-store-type" className="text-sm text-gray-300">Loại cửa hàng</Label>
              <select
                id="report-store-type"
                value={reportStoreType}
                onChange={(event) => setReportStoreType(event.target.value || DEFAULT_STORE_TYPE)}
                className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
              >
                {STORE_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-name" className="text-sm text-gray-300">Tên cửa hàng</Label>
              <Input
                id="report-name"
                value={reportName}
                onChange={(event) => setReportName(event.target.value)}
                placeholder="VD: Tạp hóa Minh Anh"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-district" className="text-sm text-gray-300">Quận / Huyện</Label>
                <select
                  id="report-district"
                  value={reportDistrict}
                  onChange={(event) => {
                    setReportDistrict(event.target.value)
                    setReportWard('')
                  }}
                  className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                >
                  <option value="">Chọn quận / huyện</option>
                  {DISTRICT_SUGGESTIONS.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-ward" className="text-sm text-gray-300">Xã / Phường</Label>
                {wardSuggestions.length > 0 ? (
                  <select
                    id="report-ward"
                    value={reportWard}
                    onChange={(event) => setReportWard(event.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                  >
                    <option value="">Chọn xã / phường</option>
                    {wardSuggestions.map((ward) => (
                      <option key={ward} value={ward}>{ward}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="report-ward"
                    value={reportWard}
                    onChange={(event) => setReportWard(event.target.value)}
                    placeholder="VD: Minh Khai"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-address" className="text-sm text-gray-300">Địa chỉ chi tiết</Label>
              <Input
                id="report-address"
                value={reportAddressDetail}
                onChange={(event) => setReportAddressDetail(event.target.value)}
                placeholder="Số nhà, đường, thôn/xóm/đội..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-phone" className="text-sm text-gray-300">Số điện thoại</Label>
              <Input
                id="report-phone"
                type="tel"
                value={reportPhone}
                onChange={(event) => setReportPhone(event.target.value)}
                placeholder="0901 234 567"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-note" className="text-sm text-gray-300">Ghi chú</Label>
              <Input
                id="report-note"
                value={reportNote}
                onChange={(event) => setReportNote(event.target.value)}
                placeholder="VD: Mở cửa từ 6:00 - 22:00"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950/80 p-4 space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-gray-100">Vị trí trên bản đồ</p>
                <p className="text-sm text-gray-400">
                  {reportLat != null && reportLng != null
                    ? `Tọa độ: ${reportLat.toFixed(6)}, ${reportLng.toFixed(6)}`
                    : 'Cửa hàng chưa có vị trí hoặc bạn chưa chọn vị trí mới.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={resolving}
                  onClick={handleGetLocation}
                >
                  {resolving ? 'Đang lấy...' : 'Lấy GPS'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setMapEditable((prev) => !prev)}
                >
                  {mapEditable ? 'Khóa bản đồ' : 'Mở khóa'}
                </Button>
              </div>
            </div>

            <div className="h-[36vh] min-h-[280px] overflow-hidden rounded-2xl border border-gray-800 sm:h-[42vh]">
              <StoreLocationPicker
                initialLat={reportLat}
                initialLng={reportLng}
                editable={mapEditable}
                onToggleEditable={() => setMapEditable((prev) => !prev)}
                onChange={(lat, lng) => {
                  setReportLat(lat)
                  setReportLng(lng)
                }}
                onGetLocation={handleGetLocation}
                resolvingAddr={resolving}
                dark={false}
              />
            </div>
          </div>
        </div>
      )}

      {(error || success) && (
        <div className={`rounded-xl border px-3 py-3 text-sm ${
          error
            ? 'border-red-900 bg-red-950/20 text-red-300'
            : 'border-emerald-900 bg-emerald-950/20 text-emerald-300'
        }`}>
          {error || success}
        </div>
      )}

      {mode && (
        <div className="sticky bottom-0 z-10 -mx-3 border-t border-gray-800 bg-black/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setMode('')
                resetFeedback()
              }}
            >
              Quay lại
            </Button>
            <Button
              type="button"
              className="w-full"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
