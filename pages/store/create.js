import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'
import { toTitleCaseVI } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import StoreDistrictWardPicker from '@/components/store/store-district-ward-picker'
import StoreTypePicker from '@/components/store/store-type-picker'
import { getLocationStepView } from '@/helper/storeLocationStep'
import { getLocationBlockedMessage, getLocationPlaceholderCopy } from '@/helper/locationUi'
import { useStoreCreateController } from '@/helper/useStoreCreateController'

const StoreLocationPicker = dynamic(() => import('@/components/map/store-location-picker'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-md bg-gray-900" style={{ height: '65vh' }}>
      <span className="animate-pulse text-sm text-gray-400">Đang tải bản đồ…</span>
    </div>
  ),
})

const SearchStoreCard = dynamic(() => import('@/components/search-store-card'), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border border-gray-800 bg-gray-950 p-3 text-sm text-gray-400">
      Đang tải thẻ cửa hàng nghi trùng...
    </div>
  ),
})

export default function AddStore() {
  const createFormId = 'store-create-form'
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsMobile(window.innerWidth <= 600)
    const onResize = () => setIsMobile(window.innerWidth <= 600)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
    confirmCreate,
    dismissConfirmCreate,
    handleLocationChange,
    handleGetLocation,
    handleKeepCreateDuplicate,
    markUserChangedDistrictWard,
    handleConfirmCreate,
    handleSubmit,
    resetCreateForm,
  } = useStoreCreateController()

  const sheetOpen = !allowDuplicate && isMobile && duplicateCandidates.length > 0

  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sheetOpen])

  useEffect(() => {
    if (!sheetOpen) return
    const handler = (e) => { if (e.key === 'Escape') handleKeepCreateDuplicate() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sheetOpen, handleKeepCreateDuplicate])

  useEffect(() => {
    if (nameInputRef.current) {
      try { nameInputRef.current.focus() } catch { /* noop */ }
    }
  }, [nameInputRef])

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

    if (isMobile) {
      return (
        <>
          <div className="filter-backdrop open" onClick={handleKeepCreateDuplicate} />
          <div className="filter-sheet open">
            <div className="sheet-handle" />
            <div className="sheet-title">Phát hiện cửa hàng có thể đã được tạo</div>
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
              <button type="button" className="apply-btn !bg-transparent !text-[var(--fg)] border border-[var(--border)]" onClick={resetCreateForm}>
                Quay lại
              </button>
              <button type="button" className="apply-btn" onClick={handleKeepCreateDuplicate}>
                Vẫn tạo cửa hàng
              </button>
            </div>
          </div>
        </>
      )
    }

    return (
      <Dialog open onOpenChange={(open) => { if (!open) handleKeepCreateDuplicate() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base text-gray-100">
              Phát hiện cửa hàng có thể đã được tạo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 px-4">
            {duplicateCandidates.map((store) => (
              <SearchStoreCard
                key={store.id}
                store={store}
                distance={store.distance}
                compact
              />
            ))}
          </div>
          <div className="px-4 pb-4">
            <div className="mb-3 rounded-md border border-red-800 bg-red-950/30 px-3 py-2 text-xs text-red-400">
              Vui lòng xác nhận “Vẫn tạo cửa hàng” để tiếp tục.
            </div>
            <div className="flex items-center gap-2">
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
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const createLocationView = getLocationStepView({
    resolving: resolvingAddr,
    lat: pickedLat,
    lng: pickedLng,
    blocked: geoBlocked,
  })

  return (
    <>
      <div className="min-h-full" style={{ color: 'var(--foreground)' }}>
        {msgState ? (
          <Msg type={msgState.type} show={msgState.show}>
            {msgState.text}
          </Msg>
        ) : null}
        <FullPageLoading visible={loading} message="Đang tạo cửa hàng…" />

          <form
            id={createFormId}
            onSubmit={handleSubmit}
            className="space-y-4 pb-20"
          >
            {/* Name + Store Type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Tên cửa hàng
              </Label>
              <div className="flex gap-2">
                <StoreTypePicker
                  value={storeType}
                  onChange={setStoreType}
                  inline
                />
                <div className="flex-1 min-w-0">
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
                  {fieldErrors.name ? (
                    <div className="text-xs text-red-600 mt-1">{fieldErrors.name}</div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Duplicate check loading */}
            {duplicateCheckLoading ? (
              <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-200">
                Đang kiểm tra trùng tên gần đây và toàn hệ thống…
              </div>
            ) : null}

            {geoBlocked ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {getLocationBlockedMessage()}
                </p>
              </div>
            ) : null}

            <div id="create-location-section">
              {createLocationView.shouldRenderMap ? (
                <StoreLocationPicker
                  mapKey={`step2-${step2Key}`}
                  initialLat={pickedLat}
                  initialLng={pickedLng}
                  onChange={handleLocationChange}
                  editable={mapEditable}
                  onToggleEditable={() => setMapEditable((value) => !value)}
                  onGetLocation={handleGetLocation}
                  heading={heading}
                  height="50vh"
                  compassError={compassError}
                  geoBlocked={geoBlocked}
                  onReload={() => window.location.reload()}
                  resolvingAddr={resolvingAddr}
                  dark={false}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-md border border-dashed border-gray-800 bg-gray-950 px-4 text-center text-gray-400"
                  style={{ height: '50vh' }}
                >
                  <div className="max-w-md space-y-2">
                    <div className="text-base font-medium text-gray-300">
                      {getLocationPlaceholderCopy(createLocationView.phase).title}
                    </div>
                    <p className="text-sm text-gray-400">
                      {getLocationPlaceholderCopy(createLocationView.phase).description}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* District / Ward - auto-filled from map */}
            <StoreDistrictWardPicker
              district={district}
              ward={ward}
              districtContainerId="create-district-section"
              wardContainerId="create-ward-section"
              districtError={fieldErrors.district}
              wardError={fieldErrors.ward}
              onDistrictChange={(item) => {
                markUserChangedDistrictWard()
                setDistrict(item)
                setWard('')
                if (fieldErrors.district) setFieldErrors((prev) => ({ ...prev, district: '' }))
              }}
              onWardChange={(item) => {
                markUserChangedDistrictWard()
                setWard(item)
                if (fieldErrors.ward) setFieldErrors((prev) => ({ ...prev, ward: '' }))
              }}
            />

            {/* Address detail */}
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

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                Số điện thoại <span className="font-normal text-gray-400">(không bắt buộc)</span>
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

            {/* Phone 2 - conditional */}
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

            {/* Note */}
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

            {/* Duplicate panel */}
            {renderDuplicatePanel()}

            {/* Submit */}
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-gray-950/95 px-3 py-3 backdrop-blur-md">
              <div className="mx-auto max-w-screen-md">
                <Button
                  type="submit"
                  disabled={loading || resolvingAddr}
                  className="w-full"
                  leftIcon={(resolvingAddr || loading) ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : undefined}
                >
                  {resolvingAddr ? 'Đang lấy vị trí...' : loading ? 'Đang lưu...' : 'Lưu cửa hàng'}
                </Button>
              </div>
            </div>
          </form>
      </div>

      <ConfirmDialog
        open={confirmCreate.open}
        onClose={dismissConfirmCreate}
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
