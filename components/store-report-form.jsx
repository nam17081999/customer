import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Msg } from '@/components/ui/msg'
import { REPORT_REASON_OPTIONS } from '@/lib/constants'
import StoreDistrictWardPicker from '@/components/store/store-district-ward-picker'
import StoreFormStepIndicator from '@/components/store/store-form-step-indicator'
import StoreTypePicker from '@/components/store/store-type-picker'
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

export default function StoreReportForm({
  store,
  user,
  onSubmitted,
  onCancel,
  initialMode = '',
  hideModeChooser = false,
}) {
  const controller = useStoreReportFormController({ store, user, onSubmitted, initialMode })
  const {
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
    mapKey,
    toggleReason,
    resetFeedback,
    handleGetLocation,
    validateEditStep,
    handleSubmit,
  } = controller

  const editSteps = [
    { num: 1, label: 'Tên' },
    { num: 2, label: 'Thông tin' },
    { num: 3, label: 'Vị trí' },
  ]
  const standaloneEdit = hideModeChooser && initialMode === 'edit'

  const goBack = () => {
    if (mode === 'edit' && currentStep > 1) {
      setCurrentStep((step) => step - 1)
      resetFeedback()
      return
    }

    if (standaloneEdit && typeof onCancel === 'function') {
      resetFeedback()
      onCancel()
      return
    }

    if (!hideModeChooser) {
      setMode('')
    }
    setCurrentStep(1)
    resetFeedback()
  }

  const primaryActionLabel = mode === 'edit' && currentStep < 3
    ? 'Tiếp theo →'
    : submitting ? 'Đang gửi...' : 'Gửi báo cáo'

  const handlePrimaryAction = () => {
    if (mode === 'edit' && currentStep < 3) {
      const canAdvance = validateEditStep(currentStep)
      if (!canAdvance) return
      setCurrentStep((step) => step + 1)
      resetFeedback()
      return
    }

    handleSubmit()
  }

  return (
    <div className="space-y-4">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
      {!hideModeChooser && (
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
      )}

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
        <div className="space-y-3">
          <div className={standaloneEdit ? 'space-y-4' : 'rounded-2xl border border-gray-800 bg-gray-950/80 p-4 space-y-4'}>
            <StoreFormStepIndicator steps={editSteps} currentStep={currentStep} />

            {currentStep === 1 && (
              <div className="space-y-5">
                <StoreTypePicker
                  id="report-store-type"
                  value={reportStoreType}
                  onChange={setReportStoreType}
                />

                <div className="space-y-2">
                  <Label htmlFor="report-name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                    Tên cửa hàng
                  </Label>
                  <Input
                    id="report-name"
                    value={reportName}
                    onChange={(event) => setReportName(event.target.value)}
                    placeholder="VD: Minh Anh"
                    className="h-11 w-full text-base sm:text-base"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <StoreDistrictWardPicker
                  district={reportDistrict}
                  ward={reportWard}
                  districtContainerId="report-district-section"
                  wardContainerId="report-ward-section"
                  onDistrictChange={(item) => {
                    setReportDistrict(item)
                    setReportWard('')
                  }}
                  onWardChange={setReportWard}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="report-address" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                    Địa chỉ cụ thể <span className="font-normal text-gray-400">(không bắt buộc)</span>
                  </Label>
                  <Input
                    id="report-address"
                    value={reportAddressDetail}
                    onChange={(event) => setReportAddressDetail(event.target.value)}
                    placeholder="Số nhà, đường, thôn/xóm/đội..."
                    className="text-base sm:text-base"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="report-phone" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                    Số điện thoại <span className="font-normal text-gray-400">(không bắt buộc)</span>
                  </Label>
                  <Input
                    id="report-phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9+ ]*"
                    value={reportPhone}
                    onChange={(event) => setReportPhone(event.target.value)}
                    placeholder="0901 234 567"
                    className="text-base sm:text-base"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="report-note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                    Ghi chú <span className="font-normal text-gray-400">(không bắt buộc)</span>
                  </Label>
                  <Input
                    id="report-note"
                    value={reportNote}
                    onChange={(event) => setReportNote(event.target.value)}
                    placeholder="VD: Bán từ 6:00 - 22:00"
                    className="text-base sm:text-base"
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3">
                {resolving ? (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
                    <svg className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-blue-700 dark:text-blue-300">Đang xác định vị trí của bạn...</span>
                  </div>
                ) : null}

                {!resolving && reportLat != null && reportLng != null ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-800 dark:bg-green-900/20">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      📍 Tọa độ đề xuất: <strong>{reportLat.toFixed(6)}, {reportLng.toFixed(6)}</strong>. Nếu chưa đúng, bấm <strong>Mở khóa</strong> trên bản đồ để điều chỉnh.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-900/20">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Cửa hàng chưa có vị trí hoặc bạn chưa chọn vị trí mới. Có thể lấy GPS, mở khóa bản đồ, hoặc dán link Google Maps.
                    </p>
                  </div>
                )}

                <div id="report-location-section">
                  <StoreLocationPicker
                    mapKey={`report-${mapKey}`}
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
                    height="65vh"
                    dark={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {mode && (
        <div className={`${standaloneEdit ? 'fixed inset-x-0 z-[55] border-t border-gray-800 bg-gray-950/95 backdrop-blur-md sm:static sm:border-0 sm:bg-transparent' : 'sticky bottom-0 z-10 -mx-3 border-t border-gray-800 bg-black/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0'}`} style={standaloneEdit ? { bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' } : undefined}>
          <div className={standaloneEdit ? 'mx-auto max-w-screen-md px-3 py-2 sm:px-0 sm:py-0' : ''}>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                goBack()
              }}
            >
              Quay lại
            </Button>
            <Button
              type="button"
              className="w-full"
              disabled={submitting}
              onClick={handlePrimaryAction}
            >
              {primaryActionLabel}
            </Button>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}

