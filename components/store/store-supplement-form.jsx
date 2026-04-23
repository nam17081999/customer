import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StoreMapsLinkFields from '@/components/store/store-maps-link-fields'
import StoreStepFormLayout from '@/components/store/store-step-form-layout'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import {
  DISTRICT_SUGGESTIONS,
  STORE_TYPE_OPTIONS,
  DEFAULT_STORE_TYPE,
} from '@/lib/constants'
import { toTitleCaseVI } from '@/lib/utils'

const StoreLocationPicker = dynamic(
  () => import('@/components/map/store-location-picker'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-md bg-gray-900" style={{ height: '40vh' }}>
        <span className="animate-pulse text-sm text-gray-400">Đang tải bản đồ…</span>
      </div>
    ),
  }
)

function buildDefaultLocks() {
  return {
    name: false,
    storeType: false,
    addressDetail: false,
    ward: false,
    district: false,
    phone: false,
    phoneSecondary: false,
    note: false,
    location: false,
  }
}

export default function StoreSupplementForm({
  router,
  msgState,
  loadingMessage,
  topContent,
  headerContent,
  steps,
  currentStep,
  setCurrentStep,
  stepCount,
  saving,
  mode = 'supplement',
  storeType,
  setStoreType,
  name,
  setName,
  district,
  setDistrict,
  ward,
  setWard,
  wardSuggestions,
  addressDetail,
  setAddressDetail,
  phone,
  setPhone,
  phoneSecondary,
  setPhoneSecondary,
  note,
  setNote,
  supplementLocks,
  fieldErrors,
  active = false,
  setActive,
  showActiveToggle = false,
  pickedLat,
  pickedLng,
  onLocationChange,
  mapEditable,
  setMapEditable,
  mapKey,
  heading,
  compassError,
  geoBlocked,
  resolvingAddr,
  handleGetLocation,
  onReload,
  mapsLink,
  mapsLinkLoading,
  mapsLinkError,
  setMapsLink,
  handleMapsLink,
  onBeforeStepChange,
  onFinalSubmit,
  step1SecondaryLabel = '',
  onStep1SecondaryAction,
  submitLabel,
}) {
  const isSupplementMode = mode === 'supplement'
  const safeLocks = supplementLocks || buildDefaultLocks()
  const safeFieldErrors = fieldErrors || {}

  const noEditableFieldsStep1 = safeLocks.storeType && safeLocks.name
  const noEditableFieldsStep2 = safeLocks.district
    && safeLocks.ward
    && safeLocks.addressDetail
    && safeLocks.phone
    && safeLocks.phoneSecondary
    && safeLocks.note
    && (!showActiveToggle || setActive == null)

  const finalSubmitLabel = submitLabel || (isSupplementMode ? 'Hoàn thành bổ sung' : 'Lưu thay đổi')

  async function handlePrimaryAction() {
    if (currentStep < stepCount) {
      const shouldContinue = await onBeforeStepChange?.({
        currentStep,
        nextStep: Math.min(stepCount, currentStep + 1),
      })
      if (shouldContinue === false) return
      setCurrentStep((prev) => Math.min(stepCount, prev + 1))
      return
    }
    await onFinalSubmit?.()
  }

  function renderPrimaryLabel() {
    if (saving) return 'Đang lưu...'
    if (currentStep < stepCount) return currentStep === 1 ? 'Tiếp theo' : 'Tiếp theo →'
    return finalSubmitLabel
  }

  function isSameArea(a, b) {
    return removeVietnameseTones(String(a || '')).toLowerCase() === removeVietnameseTones(String(b || '')).toLowerCase()
  }

  const lockedChipClass = 'cursor-not-allowed border-gray-500 bg-gray-800 text-gray-100 opacity-100'
  const lockedInputClass = 'disabled:cursor-not-allowed disabled:opacity-100 disabled:border-gray-500 disabled:bg-gray-800 disabled:text-gray-100'
  const visibleStoreTypes = safeLocks.storeType && storeType
    ? STORE_TYPE_OPTIONS.filter((type) => type.value === storeType)
    : STORE_TYPE_OPTIONS
  const visibleDistricts = safeLocks.district && district
    ? DISTRICT_SUGGESTIONS.filter((item) => isSameArea(item, district))
    : DISTRICT_SUGGESTIONS
  const visibleWards = safeLocks.ward && ward
    ? wardSuggestions.filter((item) => isSameArea(item, ward))
    : wardSuggestions

  const mobileActionBar = (
    <>
      {currentStep === 1 ? (
        <div className="flex gap-2">
          {step1SecondaryLabel && onStep1SecondaryAction ? (
            <Button type="button" variant="outline" className="flex-1" onClick={onStep1SecondaryAction}>
              {step1SecondaryLabel}
            </Button>
          ) : null}
          <Button type="button" className="flex-1" onClick={handlePrimaryAction} disabled={saving}>
            Tiếp theo
          </Button>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="icon" icon={<span>←</span>} onClick={() => setCurrentStep(1)} />
          <Button type="button" className="flex-1" onClick={handlePrimaryAction} disabled={saving}>
            {stepCount === 2 ? renderPrimaryLabel() : 'Tiếp theo →'}
          </Button>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="icon" icon={<span>←</span>} onClick={() => setCurrentStep(2)} />
          <Button type="button" className="flex-1" onClick={handlePrimaryAction} disabled={saving || resolvingAddr || geoBlocked}>
            {renderPrimaryLabel()}
          </Button>
        </div>
      ) : null}
    </>
  )

  return (
    <StoreStepFormLayout
      msgState={msgState}
      loading={saving}
      loadingMessage={loadingMessage}
      topContent={topContent}
      headerContent={headerContent}
      steps={steps}
      currentStep={currentStep}
      onSubmit={(event) => {
        event.preventDefault()
        void handlePrimaryAction()
      }}
      mobileActionBar={mobileActionBar}
    >
      {currentStep === 1 ? (
        <>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="supplement-store-type" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Loại cửa hàng
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {visibleStoreTypes.map((type) => {
                  const selected = storeType === type.value
                  return (
                    <button
                      key={`supplement-type-${type.value}`}
                      type="button"
                      onClick={() => {
                        if (safeLocks.storeType) return
                        setStoreType(type.value || DEFAULT_STORE_TYPE)
                      }}
                      disabled={safeLocks.storeType}
                      aria-pressed={selected}
                      className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition ${
                        selected
                          ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                          : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                      } ${safeLocks.storeType ? lockedChipClass : ''}`}
                    >
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplement-name" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Tên cửa hàng
              </Label>
              <Input
                id="supplement-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={safeLocks.name}
                placeholder="VD: Minh Anh"
                className={`h-11 w-full text-base sm:text-base ${lockedInputClass}`}
              />
              {safeFieldErrors.name ? <div className="text-xs text-red-600">{safeFieldErrors.name}</div> : null}
            </div>

            {isSupplementMode && noEditableFieldsStep1 ? (
              <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-300">
                Bước này không còn dữ liệu thiếu. Bạn chỉ cần kiểm tra lại rồi sang bước tiếp theo.
              </div>
            ) : null}
          </div>

          <div className="hidden gap-2 pt-2 sm:flex">
            {step1SecondaryLabel && onStep1SecondaryAction ? (
              <Button type="button" variant="outline" className="flex-1" onClick={onStep1SecondaryAction}>
                {step1SecondaryLabel}
              </Button>
            ) : null}
            <Button type="button" className="flex-1" onClick={handlePrimaryAction} disabled={saving}>
              Tiếp theo
            </Button>
          </div>
        </>
      ) : null}

      {currentStep === 2 ? (
        <>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Quận / Huyện</Label>
              <div className="flex flex-wrap gap-2">
                {visibleDistricts.map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={safeLocks.district}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      isSameArea(district, item)
                        ? 'border border-blue-600 bg-blue-600 text-white'
                        : 'border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                    } ${safeLocks.district ? lockedChipClass : ''}`}
                    onClick={() => {
                      if (safeLocks.district) return
                      setDistrict(item)
                      if (!safeLocks.ward) setWard('')
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {safeFieldErrors.district ? <div className="text-xs text-red-600">{safeFieldErrors.district}</div> : null}
            </div>

            {district && wardSuggestions.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Xã / Phường</Label>
                <div className="flex flex-wrap gap-2">
                  {visibleWards.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={safeLocks.ward}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        isSameArea(ward, item)
                          ? 'border border-blue-600 bg-blue-600 text-white'
                          : 'border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                      } ${safeLocks.ward ? lockedChipClass : ''}`}
                      onClick={() => {
                        if (safeLocks.ward) return
                        setWard(item)
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {safeFieldErrors.ward ? <div className="text-xs text-red-600">{safeFieldErrors.ward}</div> : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="supplement-address" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Địa chỉ cụ thể <span className="font-normal text-gray-400">(không bắt buộc)</span>
              </Label>
              <Input
                id="supplement-address"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                onBlur={() => {
                  if (addressDetail) setAddressDetail(toTitleCaseVI(addressDetail.trim()))
                }}
                disabled={safeLocks.addressDetail}
                placeholder="Số nhà, đường, thôn/xóm/đội..."
                className={`text-base sm:text-base ${lockedInputClass}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplement-phone" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Số điện thoại
              </Label>
              <Input
                id="supplement-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9+ ]*"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={safeLocks.phone}
                placeholder="0901 234 567"
                className={`text-base sm:text-base ${lockedInputClass}`}
              />
              {safeFieldErrors.phone ? <div className="text-xs text-red-600">{safeFieldErrors.phone}</div> : null}
            </div>

            {(phone.trim() || phoneSecondary.trim()) ? (
              <div className="space-y-1.5">
                <Label htmlFor="supplement-phone-secondary" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                  Số điện thoại 2
                </Label>
                <Input
                  id="supplement-phone-secondary"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9+ ]*"
                  value={phoneSecondary}
                  onChange={(e) => setPhoneSecondary(e.target.value)}
                  disabled={safeLocks.phoneSecondary}
                  placeholder="0912 345 678"
                  className={`text-base sm:text-base ${lockedInputClass}`}
                />
                {safeFieldErrors.phone_secondary ? <div className="text-xs text-red-600">{safeFieldErrors.phone_secondary}</div> : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="supplement-note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Ghi chú <span className="font-normal text-gray-400">(không bắt buộc)</span>
              </Label>
              <textarea
                id="supplement-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={safeLocks.note}
                placeholder="VD: Mở cửa từ 6h-11h, chỉ bán thứ 2-7"
                rows={3}
                className={`w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 ${lockedInputClass}`}
              />
            </div>

            {showActiveToggle && typeof setActive === 'function' ? (
              <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3">
                <button
                  type="button"
                  onClick={() => setActive((value) => !value)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <div>
                  <span className="text-sm font-medium text-gray-300">Đã xác minh</span>
                  <p className="text-xs text-gray-400">Cửa hàng đã được kiểm tra thực tế</p>
                </div>
              </div>
            ) : null}

            {isSupplementMode && noEditableFieldsStep2 ? (
              <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-300">
                Bước này không còn dữ liệu thiếu. Bạn có thể hoàn thành luôn hoặc sang bước vị trí nếu cửa hàng vẫn chưa có tọa độ.
              </div>
            ) : null}
          </div>

          <div className="hidden gap-2 pt-2 sm:flex">
            <Button type="button" variant="outline" size="icon" icon={<span>←</span>} onClick={() => setCurrentStep(1)} />
            <Button type="button" className="flex-1" onClick={handlePrimaryAction} disabled={saving}>
              {stepCount === 2 ? renderPrimaryLabel() : 'Tiếp theo →'}
            </Button>
          </div>
        </>
      ) : null}

      {currentStep === 3 ? (
        <>
          {resolvingAddr ? (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
              <svg className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-blue-700 dark:text-blue-300">Đang xác định vị trí của bạn...</span>
            </div>
          ) : null}

          {!resolvingAddr && pickedLat != null && pickedLng != null && !geoBlocked ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm text-green-700 dark:text-green-300">
                Đã xác định vị trí. Nếu chưa đúng, bấm <strong>Mở khóa</strong> trên bản đồ để điều chỉnh.
              </p>
            </div>
          ) : null}

          {geoBlocked ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">
                Không lấy được vị trí GPS. Hãy bấm <strong>Lấy lại vị trí</strong> hoặc dán link Google Maps bên dưới.
              </p>
            </div>
          ) : null}

          <div>
            <StoreLocationPicker
              mapKey={`step2-${mapKey}`}
              initialLat={pickedLat}
              initialLng={pickedLng}
              onChange={onLocationChange}
              editable={mapEditable}
              onToggleEditable={() => setMapEditable((value) => !value)}
              onGetLocation={handleGetLocation}
              heading={heading}
              height="65vh"
              compassError={compassError}
              geoBlocked={geoBlocked}
              onReload={onReload}
              resolvingAddr={resolvingAddr}
              dark={false}
            />
          </div>

          <div className="space-y-2 pt-2 md:hidden">
            <StoreMapsLinkFields
              value={mapsLink}
              loading={mapsLinkLoading}
              error={mapsLinkError}
              mobile
              onChange={setMapsLink}
              onSubmit={() => handleMapsLink(mapsLink)}
            />
          </div>

          <div className="hidden space-y-1.5 pt-2 md:block">
            <StoreMapsLinkFields
              value={mapsLink}
              loading={mapsLinkLoading}
              error={mapsLinkError}
              onChange={setMapsLink}
              onSubmit={() => handleMapsLink(mapsLink)}
            />
          </div>

          <div className="hidden gap-2 pt-2 sm:flex">
            <Button type="button" variant="outline" size="icon" icon={<span>←</span>} onClick={() => setCurrentStep(2)} />
            <Button
              type="button"
              className="flex-1"
              onClick={handlePrimaryAction}
              disabled={saving || resolvingAddr || geoBlocked}
            >
              {renderPrimaryLabel()}
            </Button>
          </div>
        </>
      ) : null}
    </StoreStepFormLayout>
  )
}
