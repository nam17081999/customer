import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Msg } from '@/components/ui/msg'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import StoreFormStepIndicator from '@/components/store/store-form-step-indicator'
import StoreMapsLinkFields from '@/components/store/store-maps-link-fields'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import {
  DISTRICT_SUGGESTIONS,
  STORE_TYPE_OPTIONS,
  STORE_SIZE_OPTIONS,
  DEFAULT_STORE_TYPE,
  DEFAULT_STORE_SIZE,
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

export default function StoreSupplementForm({
  router,
  user,
  store,
  msgState,
  steps,
  currentStep,
  setCurrentStep,
  stepCount,
  saving,
  storeType,
  setStoreType,
  storeSize,
  setStoreSize,
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
  note,
  setNote,
  imageFile,
  setImageFile,
  imagePreview,
  setImagePreview,
  setImageError,
  currentImage,
  fileInputRef,
  supplementLocks,
  pickedLat,
  pickedLng,
  locationSectionOpen,
  openLocationSection,
  onLocationChange,
  mapEditable,
  setMapEditable,
  resolvingAddr,
  handleGetLocation,
  mapsLink,
  mapsLinkLoading,
  mapsLinkError,
  setMapsLink,
  handleMapsLink,
  handleSaveSupplement,
}) {
  const noEditableFieldsStep1 = supplementLocks.storeType && supplementLocks.storeSize && supplementLocks.name
  const noEditableFieldsStep2 = supplementLocks.district
    && supplementLocks.ward
    && supplementLocks.addressDetail
    && supplementLocks.phone
    && supplementLocks.note
    && supplementLocks.image

  const submitLabel = user ? 'Hoàn thành bổ sung' : 'Gửi bổ sung'

  function handlePrimaryAction() {
    if (currentStep < stepCount) {
      setCurrentStep((prev) => Math.min(stepCount, prev + 1))
      return
    }
    handleSaveSupplement()
  }

  function renderPrimaryLabel() {
    if (saving) return 'Đang lưu...'
    if (currentStep < stepCount) return currentStep === 1 ? 'Tiếp theo' : 'Tiếp theo →'
    return submitLabel
  }

  function isSameArea(a, b) {
    return removeVietnameseTones(String(a || '')).toLowerCase() === removeVietnameseTones(String(b || '')).toLowerCase()
  }

  const lockedChipClass = 'cursor-not-allowed border-gray-500 bg-gray-800 text-gray-100 opacity-100'
  const lockedInputClass = 'disabled:cursor-not-allowed disabled:opacity-100 disabled:border-gray-500 disabled:bg-gray-800 disabled:text-gray-100'
  const lockedUploadClass = 'cursor-not-allowed border-gray-500 bg-gray-800/90 opacity-100'
  const visibleStoreTypes = supplementLocks.storeType && storeType
    ? STORE_TYPE_OPTIONS.filter((type) => type.value === storeType)
    : STORE_TYPE_OPTIONS
  const visibleStoreSizes = supplementLocks.storeSize && storeSize
    ? STORE_SIZE_OPTIONS.filter((sizeOption) => sizeOption.value === storeSize)
    : STORE_SIZE_OPTIONS
  const visibleDistricts = supplementLocks.district && district
    ? DISTRICT_SUGGESTIONS.filter((item) => isSameArea(item, district))
    : DISTRICT_SUGGESTIONS
  const visibleWards = supplementLocks.ward && ward
    ? wardSuggestions.filter((item) => isSameArea(item, ward))
    : wardSuggestions

  return (
    <div className="min-h-screen bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>

      <div className="mx-auto max-w-screen-md space-y-3 px-3 py-3 sm:px-4 sm:py-4">
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">Bổ sung cửa hàng</p>
            <OverflowMarquee text={store.name} className="mt-1" textClassName="text-sm text-gray-200" />
          </div>

          {!user && (
            <div className="rounded-xl border border-amber-900/70 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-200">
              Bạn chưa đăng nhập. Dữ liệu bổ sung sẽ được gửi vào danh sách duyệt thay vì cập nhật trực tiếp.
            </div>
          )}
        </div>

        <StoreFormStepIndicator steps={steps} currentStep={currentStep} />

        <form
          onSubmit={(event) => {
            event.preventDefault()
            handlePrimaryAction()
          }}
          className="space-y-3 pb-32 sm:pb-0"
        >
          {currentStep === 1 && (
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
                            if (supplementLocks.storeType) return
                            setStoreType(type.value || DEFAULT_STORE_TYPE)
                          }}
                          disabled={supplementLocks.storeType}
                          aria-pressed={selected}
                          className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition ${
                            selected
                              ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                              : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                          } ${supplementLocks.storeType ? lockedChipClass : ''}`}
                        >
                          {type.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplement-store-size" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                    Độ lớn cửa hàng <span className="font-normal text-gray-400">(không bắt buộc)</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleStoreSizes.map((sizeOption) => {
                      const selected = storeSize === sizeOption.value
                      return (
                        <button
                          key={`supplement-size-${sizeOption.value}`}
                          type="button"
                          onClick={() => {
                            if (supplementLocks.storeSize) return
                            setStoreSize((prev) => (prev === sizeOption.value ? DEFAULT_STORE_SIZE : sizeOption.value))
                          }}
                          disabled={supplementLocks.storeSize}
                          aria-pressed={selected}
                          className={`min-h-11 rounded-md border px-3 py-2 text-center text-sm transition ${
                            selected
                              ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                              : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
                          } ${supplementLocks.storeSize ? lockedChipClass : ''}`}
                        >
                          {sizeOption.label}
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
                    disabled={supplementLocks.name}
                    placeholder="VD: Minh Anh"
                    className={`h-11 w-full text-base sm:text-base ${lockedInputClass}`}
                  />
                </div>

                {noEditableFieldsStep1 && (
                  <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-300">
                    Bước này không còn dữ liệu thiếu. Bạn chỉ cần kiểm tra lại rồi sang bước tiếp theo.
                  </div>
                )}
              </div>

              <div className="hidden gap-2 pt-2 sm:flex">
                <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                  Thoát
                </Button>
                <Button type="button" className="flex-1" onClick={handlePrimaryAction}>
                  Tiếp theo
                </Button>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Quận / Huyện</Label>
                  <div className="flex flex-wrap gap-2">
                    {visibleDistricts.map((item) => (
                      <button
                        key={item}
                        type="button"
                        disabled={supplementLocks.district}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                          isSameArea(district, item)
                            ? 'border border-blue-600 bg-blue-600 text-white'
                            : 'border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                        } ${supplementLocks.district ? lockedChipClass : ''}`}
                        onClick={() => {
                          if (supplementLocks.district) return
                          setDistrict(item)
                          if (!supplementLocks.ward) setWard('')
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {district && wardSuggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Xã / Phường</Label>
                    <div className="flex flex-wrap gap-2">
                      {visibleWards.map((item) => (
                        <button
                          key={item}
                          type="button"
                          disabled={supplementLocks.ward}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                            isSameArea(ward, item)
                              ? 'border border-blue-600 bg-blue-600 text-white'
                              : 'border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                          } ${supplementLocks.ward ? lockedChipClass : ''}`}
                          onClick={() => {
                            if (supplementLocks.ward) return
                            setWard(item)
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                    disabled={supplementLocks.addressDetail}
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
                    disabled={supplementLocks.phone}
                    placeholder="0901 234 567"
                    className={`text-base sm:text-base ${lockedInputClass}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supplement-image" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                    Ảnh cửa hàng <span className="font-normal text-gray-400">(không bắt buộc)</span>
                  </Label>
                  <div className="relative w-full">
                    {imagePreview ? (
                      <div className="relative group w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreview}
                          alt="Ảnh xem trước"
                          className="h-40 w-full max-w-full rounded border border-gray-300 bg-gray-100 object-cover dark:border-gray-700 dark:bg-gray-800"
                        />
                        {!supplementLocks.image && (
                          <button
                            type="button"
                            className="absolute -right-2 -top-2 cursor-pointer rounded-full border border-gray-300 bg-white p-1 text-gray-400 shadow hover:bg-red-100 hover:text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-red-900"
                            onClick={() => {
                              setImageFile(null)
                              if (imagePreview) URL.revokeObjectURL(imagePreview)
                              setImagePreview(null)
                            }}
                            aria-label="Xóa ảnh"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                              <path d="M6 6l8 8M6 14L14 6" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : currentImage ? (
                      <div className="relative group w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentImage}
                          alt={store.name}
                          className="h-40 w-full max-w-full rounded border border-gray-500 bg-gray-100 object-cover dark:border-gray-600 dark:bg-gray-800"
                          onError={() => setImageError(true)}
                        />
                      </div>
                    ) : (
                      <label
                        htmlFor="supplement-image"
                        className={`flex h-32 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 transition ${
                          supplementLocks.image ? lockedUploadClass : 'cursor-pointer hover:bg-gray-800'
                        }`}
                      >
                        <svg className="mb-1 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                        <span className="text-sm text-gray-500 dark:text-gray-400">Chụp hoặc chọn ảnh</span>
                        <input
                          id="supplement-image"
                          ref={fileInputRef}
                          type="file"
                          accept="image/*;capture=camera"
                          capture="environment"
                          disabled={supplementLocks.image}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setImageFile(file)
                            setImageError(false)
                            setImagePreview(URL.createObjectURL(file))
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="supplement-note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                    Ghi chú <span className="font-normal text-gray-400">(không bắt buộc)</span>
                  </Label>
                  <textarea
                    id="supplement-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={supplementLocks.note}
                    placeholder="VD: Mở cửa từ 6h-11h, chỉ bán thứ 2-7"
                    rows={3}
                    className={`w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 ${lockedInputClass}`}
                  />
                </div>

                {noEditableFieldsStep2 && (
                  <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-300">
                    Bước này không còn dữ liệu thiếu. Bạn có thể hoàn thành luôn hoặc sang bước vị trí nếu cửa hàng vẫn chưa có tọa độ.
                  </div>
                )}
              </div>

              <div className="hidden gap-2 pt-2 sm:flex">
                <Button type="button" variant="outline" size="icon" icon={<span>←</span>} onClick={() => setCurrentStep(1)} />
                <Button type="button" className="flex-1" onClick={handlePrimaryAction}>
                  {stepCount === 2 ? renderPrimaryLabel() : 'Tiếp theo →'}
                </Button>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              {!locationSectionOpen && pickedLat == null && pickedLng == null ? (
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 px-5 py-10 text-center">
                  <Button type="button" className="h-11 px-6" onClick={openLocationSection}>
                    Thêm vị trí
                  </Button>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-200">Nếu không thêm vị trí, hãy bấm hoàn thành bổ sung.</p>
                    <p className="text-sm text-gray-400">Bạn có thể bỏ qua bước này nếu chưa xác định được vị trí chính xác.</p>
                  </div>
                </div>
              ) : (
                <>
                  {resolvingAddr && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
                      <svg className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm text-blue-700 dark:text-blue-300">Đang xác định vị trí của bạn...</span>
                    </div>
                  )}

                  {!resolvingAddr && pickedLat != null && pickedLng != null && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-800 dark:bg-green-900/20">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Đã xác định vị trí. Nếu chưa đúng, bấm <strong>Mở khóa</strong> trên bản đồ để điều chỉnh.
                      </p>
                    </div>
                  )}

                  <div>
                    <StoreLocationPicker
                      initialLat={pickedLat}
                      initialLng={pickedLng}
                      onChange={onLocationChange}
                      editable={mapEditable}
                      onToggleEditable={() => setMapEditable((value) => !value)}
                      onGetLocation={handleGetLocation}
                      height="65vh"
                      resolvingAddr={resolvingAddr}
                      dark={false}
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <StoreMapsLinkFields
                      value={mapsLink}
                      loading={mapsLinkLoading}
                      error={mapsLinkError}
                      mobile
                      onChange={setMapsLink}
                      onSubmit={() => handleMapsLink(mapsLink)}
                    />
                  </div>
                </>
              )}

              <div className="hidden gap-2 pt-2 sm:flex">
                <Button type="button" variant="outline" size="icon" icon={<span>←</span>} onClick={() => setCurrentStep(2)} />
                <Button type="button" className="flex-1" onClick={handlePrimaryAction}>
                  {renderPrimaryLabel()}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>

      <div
        className="fixed inset-x-0 z-[55] border-t border-gray-800 bg-gray-950/95 backdrop-blur-md sm:hidden"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-screen-md px-3 py-2">
          {currentStep === 1 && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                Thoát
              </Button>
              <Button type="button" className="flex-1" onClick={handlePrimaryAction}>
                Tiếp theo
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="icon" icon={<span>←</span>} onClick={() => setCurrentStep(1)} />
              <Button type="button" className="flex-1" onClick={handlePrimaryAction}>
                {stepCount === 2 ? renderPrimaryLabel() : 'Tiếp theo →'}
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="icon" icon={<span>←</span>} onClick={() => setCurrentStep(2)} />
              <Button type="button" className="flex-1" onClick={handlePrimaryAction}>
                {renderPrimaryLabel()}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
