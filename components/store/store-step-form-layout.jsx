import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'
import StoreFormStepIndicator from '@/components/store/store-form-step-indicator'

export default function StoreStepFormLayout({
  msgState,
  loading = false,
  loadingMessage = '',
  topContent = null,
  headerContent = null,
  steps = [],
  currentStep = 1,
  onSubmit,
  children,
  mobileActionBar = null,
}) {
  return (
    <div className="min-h-screen bg-black">
      {msgState ? <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg> : null}
      {loadingMessage ? <FullPageLoading visible={loading} message={loadingMessage} /> : null}
      {topContent}

      <div className="mx-auto max-w-screen-md space-y-3 px-3 py-3 sm:px-4 sm:py-4">
        {headerContent}
        {steps.length > 0 ? <StoreFormStepIndicator steps={steps} currentStep={currentStep} /> : null}
        <form onSubmit={onSubmit} className="space-y-3 pb-32 sm:pb-0">
          {children}
        </form>
      </div>

      {mobileActionBar ? (
        <div
          className="fixed inset-x-0 z-[55] border-t border-gray-800 bg-gray-950/95 backdrop-blur-md sm:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto max-w-screen-md px-3 py-2">
            {mobileActionBar}
          </div>
        </div>
      ) : null}
    </div>
  )
}
