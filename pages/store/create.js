import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toTitleCaseVI } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import SearchStoreCard from '@/components/search-store-card'
import StoreDistrictWardPicker from '@/components/store/store-district-ward-picker'
import StoreMapsLinkFields from '@/components/store/store-maps-link-fields'
import StoreStepFormLayout from '@/components/store/store-step-form-layout'
import StoreTypePicker from '@/components/store/store-type-picker'
import { buildCreateSteps, shouldShowCreateMobileActionBar } from '@/helper/storeCreateFlow'
import { useStoreCreateController } from '@/helper/useStoreCreateController'

const StoreLocationPicker = dynamic(() => import('@/components/map/store-location-picker'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-md bg-gray-900" style={{ height: '65vh' }}>
      <span className="animate-pulse text-sm text-gray-400">Đang tải bản đồ…</span>
    </div>
  ),
})

export default function AddStore() {
  const createFormId = 'store-create-form'
  const {
    isAdmin,
    telesaleNoStep3,
    name,
    setName,
    storeType,
    setStoreType,
    nameInputRef,
    addressDetail,
    setAddressDetail,
    ward,
    setWard,
    district,
    setDistrict,
    msgState,
    phone,
    setPhone,
    phoneSecondary,
    setPhoneSecondary,
    note,
    setNote,
    fieldErrors,
    setFieldErrors,
    loading,
    resolvingAddr,
    currentStep,
    setCurrentStep,
    duplicateCandidates,
    duplicateCheckLoading,
    duplicateCheckError,
    allowDuplicate,
    pickedLat,
    pickedLng,
    mapEditable,
    setMapEditable,
    heading,
    compassError,
    geoBlocked,
    step2Key,
    mapsLink,
    setMapsLink,
    mapsLinkLoading,
    mapsLinkError,
    confirmCreate,
    dismissConfirmCreate,
    handleMapsLink,
    handleLocationChange,
    handleGetLocation,
    handleStep1Next,
    validateStep2AndGoNext,
    handleKeepCreateDuplicate,
    handleConfirmCreate,
    handleSubmit,
    resetCreateForm,
  } = useStoreCreateController()

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
        <div className="my-2 text-sm font-semibold text-gray-100">
          Phát hiện cửa hàng có thể đã được tạo
        </div>
        <div className="space-y-2">
          {duplicateCandidates.map((store) => (
            <SearchStoreCard
              key={store.id}
              store={store}
              distance={store.distance}
              compact
            />
          ))}
        </div>
        <div className="mt-3 rounded-md border border-red-800 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          Vui lòng xác nhận “Vẫn tạo cửa hàng” để tiếp tục.
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={resetCreateForm}
          >
            Quay lại
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleKeepCreateDuplicate}
          >
            Vẫn tạo cửa hàng
          </Button>
        </div>
      </>
    )
  }

  const steps = buildCreateSteps(telesaleNoStep3)
  const showMobileActionBar = shouldShowCreateMobileActionBar({
    currentStep,
    allowDuplicate,
    duplicateCandidates,
  })

  const mobileActionBar = showMobileActionBar ? (
    <>
      {currentStep === 1 && (allowDuplicate || duplicateCandidates.length === 0) ? (
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
          >
            {telesaleNoStep3 ? 'Lưu cửa hàng' : 'Tiếp theo →'}
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
            type="submit"
            disabled={loading || resolvingAddr || geoBlocked}
            className="flex-1"
            leftIcon={(resolvingAddr || loading) ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : undefined}
          >
            {resolvingAddr ? 'Đang lấy vị trí...' : loading ? 'Đang lưu...' : '✓ Lưu cửa hàng'}
          </Button>
        </div>
      )}
    </>
  ) : null

  return (
    <>
      <StoreStepFormLayout
        msgState={msgState}
        loading={loading}
        loadingMessage="Đang tạo cửa hàng…"
        steps={steps}
        currentStep={currentStep}
        onSubmit={handleSubmit}
        formId={createFormId}
        mobileActionBar={mobileActionBar}
      >
        {currentStep === 1 && (
          <>
            <div className="space-y-5">
              <StoreTypePicker value={storeType} onChange={setStoreType} />
              <div className="space-y-2">
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
              {fieldErrors.name ? (
                <div className="text-xs text-red-600">{fieldErrors.name}</div>
              ) : null}
              {duplicateCheckLoading ? (
                <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-200">
                  Đang kiểm tra trùng tên gần đây và toàn hệ thống…
                </div>
              ) : null}
              {renderDuplicatePanel()}
            </div>

            {(allowDuplicate || duplicateCandidates.length === 0) ? (
              <div className="hidden pt-2 sm:block">
                <Button
                  type="button"
                  onClick={handleStep1Next}
                  className="w-full"
                >
                  Tiếp theo
                </Button>
              </div>
            ) : null}
          </>
        )}

        {currentStep === 2 && (
          <>
            <StoreDistrictWardPicker
              district={district}
              ward={ward}
              districtContainerId="create-district-section"
              wardContainerId="create-ward-section"
              districtError={fieldErrors.district}
              wardError={fieldErrors.ward}
              onDistrictChange={(item) => {
                setDistrict(item)
                setWard('')
                if (fieldErrors.district) setFieldErrors((prev) => ({ ...prev, district: '' }))
              }}
              onWardChange={(item) => {
                setWard(item)
                if (fieldErrors.ward) setFieldErrors((prev) => ({ ...prev, ward: '' }))
              }}
            />

            <div className="space-y-1.5">
              <Label htmlFor="address_detail" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Địa chỉ cụ thể <span className="font-normal text-gray-400">(không bắt buộc)</span>
              </Label>
              <Input
                id="address_detail"
                value={addressDetail}
                onChange={(e) => {
                  setAddressDetail(e.target.value)
                  if (fieldErrors.address_detail) setFieldErrors((prev) => ({ ...prev, address_detail: '' }))
                }}
                onBlur={() => {
                  if (addressDetail) setAddressDetail(toTitleCaseVI(addressDetail.trim()))
                }}
                placeholder="Số nhà, đường, thôn/xóm/đội..."
                className="text-base sm:text-base"
              />
            </div>

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
              {fieldErrors.phone ? <div className="text-xs text-red-600">{fieldErrors.phone}</div> : null}
            </div>

            {(phone.trim() || phoneSecondary.trim()) ? (
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
                {fieldErrors.phone_secondary ? <div className="text-xs text-red-600">{fieldErrors.phone_secondary}</div> : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Ghi chú <span className="font-normal text-gray-400">(không bắt buộc)</span>
              </Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Bán từ 6:00 - 22:00"
                className="text-base sm:text-base"
              />
            </div>
            <div className="hidden gap-2 pt-2 sm:flex">
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
              >
                {telesaleNoStep3 ? 'Lưu cửa hàng' : 'Tiếp theo →'}
              </Button>
            </div>
          </>
        )}

        {currentStep === 3 && (
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

            {!resolvingAddr && pickedLat != null && !geoBlocked ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-sm text-green-700 dark:text-green-300">
                  📍 Đã xác định vị trí. Nếu chưa đúng, bấm <strong>Mở khóa</strong> trên bản đồ để điều chỉnh.
                </p>
              </div>
            ) : null}

            {geoBlocked ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-300">
                  ❌ Không lấy được vị trí GPS. Hãy bấm <strong>Lấy lại vị trí</strong> hoặc dán link Google Maps bên dưới.
                </p>
              </div>
            ) : null}

            <div id="create-location-section">
              <StoreLocationPicker
                mapKey={`step2-${step2Key}`}
                initialLat={pickedLat}
                initialLng={pickedLng}
                onChange={handleLocationChange}
                editable={mapEditable}
                onToggleEditable={() => setMapEditable((value) => !value)}
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

            <div className="space-y-2 pt-2 md:hidden">
              <StoreMapsLinkFields
                value={mapsLink}
                loading={mapsLinkLoading}
                error={mapsLinkError}
                mobile
                showDirectionIcon
                onChange={setMapsLink}
                onSubmit={() => handleMapsLink(mapsLink)}
              />
            </div>

            <div className="hidden space-y-1.5 pt-2 md:block">
              <StoreMapsLinkFields
                value={mapsLink}
                loading={mapsLinkLoading}
                error={mapsLinkError}
                showDirectionIcon
                onChange={setMapsLink}
                onSubmit={() => handleMapsLink(mapsLink)}
              />
            </div>

            <div className="hidden gap-2 pt-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                size="icon"
                icon={<span>←</span>}
                onClick={() => setCurrentStep(2)}
              />
        <Button
          type="submit"
          form={createFormId}
          disabled={loading || resolvingAddr || geoBlocked}
          className="flex-1"
          leftIcon={(resolvingAddr || loading) ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : undefined}
              >
                {resolvingAddr ? 'Đang lấy vị trí...' : loading ? 'Đang lưu...' : '✓ Lưu cửa hàng'}
              </Button>
            </div>
          </>
        )}
      </StoreStepFormLayout>

      <ConfirmDialog
        open={confirmCreate.open}
        onOpenChange={(open) => {
          if (!open) dismissConfirmCreate()
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
    </>
  )
}
