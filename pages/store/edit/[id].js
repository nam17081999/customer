import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import StoreDistrictWardPicker from '@/components/store/store-district-ward-picker'
import StoreTypePicker from '@/components/store/store-type-picker'
import { getLocationStepView } from '@/helper/storeLocationStep'
import { getLocationBlockedMessage, getLocationPlaceholderCopy } from '@/helper/locationUi'
import { useStoreEditController } from '@/helper/useStoreEditController'
import { toTitleCaseVI } from '@/lib/utils'

const StoreLocationPicker = dynamic(() => import('@/components/map/store-location-picker'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-md bg-gray-900" style={{ height: '65vh' }}>
      <span className="animate-pulse text-sm text-gray-400">Đang tải bản đồ…</span>
    </div>
  ),
})

export default function EditStore() {
  const {
    router,
    isAdmin,
    isAuthenticated,
    authLoading,
    isSupplementMode,
    pageReady,
    store,
    fetchError,
    name,
    setName,
    storeType,
    setStoreType,
    addressDetail,
    setAddressDetail,
    ward,
    setWard,
    district,
    setDistrict,
    phone,
    setPhone,
    phoneSecondary,
    setPhoneSecondary,
    note,
    setNote,
    active,
    setActive,
    fieldErrors,
    setFieldErrors,
    pickedLat,
    pickedLng,
    mapEditable,
    setMapEditable,
    heading,
    compassError,
    geoBlocked,
    resolvingAddr,
    step2Key,
    saving,
    msgState,
    confirmAction,
    resolvedWardSuggestions,
    supplementLocks,
    handleLocationChange,
    handleGetLocation,
    handleSaveSupplement,
    handleConfirmAction,
    dismissConfirmAction,
    handleSaveEdit,
  } = useStoreEditController()

  const [showLocationEditor, setShowLocationEditor] = useState(false)

  const handleAddLocation = useCallback(() => {
    setShowLocationEditor(true)
    setMapEditable(true)
    setStep2Key((v) => v + 1)
  }, [setMapEditable])

  if (authLoading || !pageReady) return <FullPageLoading />

  if (fetchError) {
    return (
      <div className="flex min-h-full items-center justify-center bg-black p-6">
        <div className="text-center">
          <p className="mb-4 text-red-400">{fetchError}</p>
          <Button onClick={() => router.back()}>Quay lại</Button>
        </div>
      </div>
    )
  }

  if (!store) {
    return <FullPageLoading />
  }

  const safeLocks = supplementLocks || {}
  const storeHasCoords = pickedLat != null && pickedLng != null
  const editLocationView = getLocationStepView({
    resolving: resolvingAddr,
    lat: pickedLat,
    lng: pickedLng,
    blocked: geoBlocked,
  })

  const lockedInputClass = 'disabled:cursor-not-allowed disabled:opacity-100 disabled:border-gray-500 disabled:bg-gray-800 disabled:text-gray-100'

  function handleSubmit(event) {
    event.preventDefault()
    if (isSupplementMode) {
      handleSaveSupplement()
    } else {
      handleSaveEdit()
    }
  }

  function renderMapSection() {
    if (!isSupplementMode && !storeHasCoords && !showLocationEditor) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-gray-300">
            Cửa hàng hiện chưa có vị trí. Nếu bạn muốn thêm vị trí, hãy bấm <strong>Thêm vị trí</strong>.
          </div>
          <Button type="button" className="w-full" onClick={handleAddLocation}>
            Thêm vị trí
          </Button>
        </div>
      )
    }

    if (!editLocationView.shouldRenderMap) {
      return (
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-gray-800 bg-gray-950 px-4 text-center text-gray-400"
          style={{ height: '50vh' }}
        >
          <div className="max-w-md space-y-2">
            <div className="text-base font-medium text-gray-300">
              {getLocationPlaceholderCopy(editLocationView.phase).title}
            </div>
            <p className="text-sm text-gray-400">
              {getLocationPlaceholderCopy(editLocationView.phase).description}
            </p>
          </div>
        </div>
      )
    }

    return (
      <StoreLocationPicker
        mapKey={`step2-${step2Key}`}
        initialLat={pickedLat}
        initialLng={pickedLng}
        onChange={handleLocationChange}
        editable={mapEditable}
        onToggleEditable={() => setMapEditable((v) => !v)}
        onGetLocation={handleGetLocation}
        heading={heading}
        height="50vh"
        compassError={compassError}
        geoBlocked={geoBlocked}
        onReload={() => window.location.reload()}
        resolvingAddr={resolvingAddr}
        dark={false}
      />
    )
  }

  const isLocked = (field) => safeLocks[field] === true
  const submitLabel = isSupplementMode
    ? (isAuthenticated ? 'Hoàn thành bổ sung' : 'Gửi bổ sung')
    : 'Lưu thay đổi'

  return (
    <>
      <div className="min-h-full" style={{ color: 'var(--foreground)' }}>
        {msgState ? (
          <Msg type={msgState.type} show={msgState.show}>
            {msgState.text}
          </Msg>
        ) : null}
        <FullPageLoading visible={saving} message={isSupplementMode ? 'Đang lưu bổ sung…' : 'Đang cập nhật cửa hàng…'} />

        

        <form onSubmit={handleSubmit} className="space-y-4 pb-20">
          {/* Name + Store Type */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Tên cửa hàng
            </Label>
            <div className="flex gap-2">
              <StoreTypePicker
                value={storeType}
                onChange={(v) => {
                  if (isLocked('storeType')) return
                  setStoreType(v)
                }}
                inline
              />
              <div className="flex-1 min-w-0">
                <Input
                  value={name}
                  onChange={(e) => {
                    if (isLocked('name')) return
                    setName(e.target.value)
                    if (fieldErrors?.name) setFieldErrors?.((prev) => ({ ...prev, name: '' }))
                  }}
                  disabled={isLocked('name')}
                  placeholder="VD: Minh Anh"
                  className={`h-11 w-full text-base sm:text-base ${isLocked('name') ? lockedInputClass : ''}`}
                />
                {fieldErrors?.name ? (
                  <div className="text-xs text-red-600 mt-1">{fieldErrors.name}</div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Map location section */}
          {geoBlocked ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">
                {getLocationBlockedMessage()}
              </p>
            </div>
          ) : null}

          <div>
            {renderMapSection()}
          </div>

          {/* District / Ward - select style like create */}
          <StoreDistrictWardPicker
            district={district}
            ward={ward}
            districtContainerId="edit-district-section"
            wardContainerId="edit-ward-section"
            districtError={fieldErrors?.district}
            wardError={fieldErrors?.ward}
            onDistrictChange={(item) => {
              if (isLocked('district')) return
              setDistrict(item)
              setWard('')
              if (fieldErrors?.district) setFieldErrors?.((prev) => ({ ...prev, district: '' }))
            }}
            onWardChange={(item) => {
              if (isLocked('ward')) return
              setWard(item)
              if (fieldErrors?.ward) setFieldErrors?.((prev) => ({ ...prev, ward: '' }))
            }}
          />

          {/* Address detail */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-address" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
              Địa chỉ cụ thể <span className="font-normal text-gray-400">(không bắt buộc)</span>
            </Label>
            <Input
              id="edit-address"
              value={addressDetail}
              onChange={(e) => {
                if (isLocked('addressDetail')) return
                setAddressDetail(e.target.value)
                if (fieldErrors?.address_detail) setFieldErrors?.((prev) => ({ ...prev, address_detail: '' }))
              }}
              onBlur={() => {
                if (addressDetail && !isLocked('addressDetail')) setAddressDetail(toTitleCaseVI(addressDetail.trim()))
              }}
              disabled={isLocked('addressDetail')}
              placeholder="Số nhà, đường, thôn/xóm/đội..."
              className={`text-base sm:text-base ${isLocked('addressDetail') ? lockedInputClass : ''}`}
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
              Số điện thoại <span className="font-normal text-gray-400">(không bắt buộc)</span>
            </Label>
            <Input
              id="edit-phone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9+ ]*"
              value={phone}
              onChange={(e) => {
                if (isLocked('phone')) return
                setPhone(e.target.value)
                if (fieldErrors?.phone) setFieldErrors?.((prev) => ({ ...prev, phone: '' }))
              }}
              disabled={isLocked('phone')}
              placeholder="0901 234 567"
              className={`text-base sm:text-base ${isLocked('phone') ? lockedInputClass : ''}`}
            />
            {fieldErrors?.phone ? <div className="text-xs text-red-600">{fieldErrors.phone}</div> : null}
          </div>

          {/* Phone 2 - conditional */}
          {(phone.trim() || phoneSecondary.trim()) ? (
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone-secondary" className="block text-sm font-medium text-gray-300">
                Số điện thoại 2 <span className="font-normal text-gray-400">(không bắt buộc)</span>
              </Label>
              <Input
                id="edit-phone-secondary"
                type="tel"
                inputMode="numeric"
                pattern="[0-9+ ]*"
                value={phoneSecondary}
                onChange={(e) => {
                  if (isLocked('phoneSecondary')) return
                  setPhoneSecondary(e.target.value)
                  if (fieldErrors?.phone_secondary) setFieldErrors?.((prev) => ({ ...prev, phone_secondary: '' }))
                }}
                disabled={isLocked('phoneSecondary')}
                placeholder="0912 345 678"
                className={`text-base sm:text-base ${isLocked('phoneSecondary') ? lockedInputClass : ''}`}
              />
              {fieldErrors?.phone_secondary ? <div className="text-xs text-red-600">{fieldErrors.phone_secondary}</div> : null}
            </div>
          ) : null}

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-note" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
              Ghi chú <span className="font-normal text-gray-400">(không bắt buộc)</span>
            </Label>
            <Input
              id="edit-note"
              value={note}
              onChange={(e) => {
                if (isLocked('note')) return
                setNote(e.target.value)
              }}
              disabled={isLocked('note')}
              placeholder="VD: Bán từ 6:00 - 22:00"
              className={`text-base sm:text-base ${isLocked('note') ? lockedInputClass : ''}`}
            />
          </div>

          {/* Submit */}
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-gray-950/95 px-3 py-3 backdrop-blur-md">
            <div className="mx-auto max-w-screen-md flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                icon={(
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                )}
                onClick={() => {
                  if (
                    name !== store?.name
                    || storeType !== store?.store_type
                    || addressDetail !== (store?.address_detail || '')
                    || ward !== (store?.ward || '')
                    || district !== (store?.district || '')
                    || phone !== (store?.phone || '')
                    || phoneSecondary !== (store?.phone_secondary || '')
                    || note !== (store?.note || '')
                  ) {
                    if (!window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn rời trang?')) return
                  }
                  router.back()
                }}
              />
              <Button
                type="submit"
                disabled={saving || resolvingAddr}
                className="flex-1"
                leftIcon={(resolvingAddr || saving) ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : undefined}
              >
                {resolvingAddr ? 'Đang lấy vị trí...' : saving ? 'Đang lưu...' : submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmAction.open}
        onOpenChange={(open) => {
          if (!open) dismissConfirmAction()
        }}
        title={confirmAction.type === 'supplement' ? 'Xác nhận bổ sung cửa hàng' : 'Xác nhận chỉnh sửa cửa hàng'}
        description={
          confirmAction.type === 'supplement'
            ? 'Bạn có chắc muốn lưu phần dữ liệu bổ sung này không?'
            : 'Bạn có chắc muốn lưu các thay đổi của cửa hàng không?'
        }
        confirmLabel={confirmAction.type === 'supplement' ? 'Lưu bổ sung' : 'Lưu thay đổi'}
        loading={saving}
        onConfirm={handleConfirmAction}
      />
    </>
  )
}