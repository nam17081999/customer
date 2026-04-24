import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import StoreSupplementForm from '@/components/store/store-supplement-form'
import { useStoreEditController } from '@/helper/useStoreEditController'

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
    pickedLat,
    pickedLng,
    mapEditable,
    setMapEditable,
    heading,
    compassError,
    geoBlocked,
    resolvingAddr,
    step2Key,
    mapsLink,
    setMapsLink,
    mapsLinkLoading,
    mapsLinkError,
    saving,
    currentStep,
    setCurrentStep,
    msgState,
    confirmAction,
    resolvedWardSuggestions,
    supplementLocks,
    supplementSteps,
    editSteps,
    handleLocationChange,
    handleGetLocation,
    handleMapsLink,
    handleSaveSupplement,
    handleConfirmAction,
    dismissConfirmAction,
    handleEditStepChange,
    handleSaveEdit,
  } = useStoreEditController()

  if (authLoading || !pageReady) return <FullPageLoading />

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6">
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

  const confirmDialogNode = (
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
  )

  const supplementHeaderContent = (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">Bổ sung cửa hàng</p>
        <OverflowMarquee text={store.name} className="mt-1" textClassName="text-sm text-gray-200" />
      </div>

      {!isAuthenticated ? (
        <div className="rounded-xl border border-amber-900/70 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-200">
          Bạn chưa đăng nhập. Dữ liệu bổ sung sẽ được gửi vào danh sách duyệt thay vì cập nhật trực tiếp.
        </div>
      ) : null}
    </div>
  )

  const editTopContent = (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-800 bg-black/95 px-4 py-3 backdrop-blur">
      <Button
        size="icon"
        variant="ghost"
        onClick={() => router.back()}
        icon={(
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        )}
      />
      <div>
        <h1 className="text-base font-semibold leading-tight text-white">Sửa cửa hàng</h1>
        <OverflowMarquee text={store.name} className="max-w-[200px]" textClassName="text-xs text-gray-400" />
      </div>
    </div>
  )

  if (isSupplementMode) {
    return (
      <>
        <StoreSupplementForm
          router={router}
          msgState={msgState}
          loadingMessage="Đang lưu bổ sung…"
          headerContent={supplementHeaderContent}
          steps={supplementSteps}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          stepCount={supplementSteps.length}
          saving={saving}
          mode="supplement"
          storeType={storeType}
          setStoreType={setStoreType}
          name={name}
          setName={setName}
          district={district}
          setDistrict={setDistrict}
          ward={ward}
          setWard={setWard}
          wardSuggestions={resolvedWardSuggestions}
          addressDetail={addressDetail}
          setAddressDetail={setAddressDetail}
          phone={phone}
          setPhone={setPhone}
          phoneSecondary={phoneSecondary}
          setPhoneSecondary={setPhoneSecondary}
          note={note}
          setNote={setNote}
          supplementLocks={supplementLocks}
          pickedLat={pickedLat}
          pickedLng={pickedLng}
          onLocationChange={handleLocationChange}
          mapEditable={mapEditable}
          setMapEditable={setMapEditable}
          mapKey={step2Key}
          heading={heading}
          compassError={compassError}
          geoBlocked={geoBlocked}
          resolvingAddr={resolvingAddr}
          handleGetLocation={handleGetLocation}
          onReload={() => window.location.reload()}
          mapsLink={mapsLink}
          mapsLinkLoading={mapsLinkLoading}
          mapsLinkError={mapsLinkError}
          setMapsLink={setMapsLink}
          handleMapsLink={handleMapsLink}
          onFinalSubmit={handleSaveSupplement}
          step1SecondaryLabel="Thoát"
          onStep1SecondaryAction={() => router.back()}
          submitLabel={isAuthenticated ? 'Hoàn thành bổ sung' : 'Gửi bổ sung'}
        />
        {confirmDialogNode}
      </>
    )
  }

  return (
    <>
      <StoreSupplementForm
        router={router}
        msgState={msgState}
        loadingMessage="Đang cập nhật cửa hàng…"
        topContent={editTopContent}
        steps={editSteps}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        stepCount={editSteps.length}
        saving={saving}
        mode="edit"
        storeType={storeType}
        setStoreType={setStoreType}
        name={name}
        setName={setName}
        district={district}
        setDistrict={setDistrict}
        ward={ward}
        setWard={setWard}
        wardSuggestions={resolvedWardSuggestions}
        addressDetail={addressDetail}
        setAddressDetail={setAddressDetail}
        phone={phone}
        setPhone={setPhone}
        phoneSecondary={phoneSecondary}
        setPhoneSecondary={setPhoneSecondary}
        note={note}
        setNote={setNote}
        fieldErrors={fieldErrors}
        active={active}
        setActive={setActive}
        showActiveToggle
        pickedLat={pickedLat}
        pickedLng={pickedLng}
        onLocationChange={handleLocationChange}
        mapEditable={mapEditable}
        setMapEditable={setMapEditable}
        mapKey={step2Key}
        heading={heading}
        compassError={compassError}
        geoBlocked={geoBlocked}
        resolvingAddr={resolvingAddr}
        handleGetLocation={handleGetLocation}
        onReload={() => window.location.reload()}
        mapsLink={mapsLink}
        mapsLinkLoading={mapsLinkLoading}
        mapsLinkError={mapsLinkError}
        setMapsLink={setMapsLink}
        handleMapsLink={handleMapsLink}
        onBeforeStepChange={handleEditStepChange}
        onFinalSubmit={handleSaveEdit}
        submitLabel="Lưu thay đổi"
      />
      {confirmDialogNode}
    </>
  )
}
