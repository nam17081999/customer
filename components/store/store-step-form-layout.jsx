import { FullPageLoading } from "@/components/ui/full-page-loading";
import { Msg } from "@/components/ui/msg";
import StoreFormStepIndicator from "@/components/store/store-form-step-indicator";

export default function StoreStepFormLayout({
  msgState,
  loading = false,
  loadingMessage = "",
  topContent = null,
  headerContent = null,
  steps = [],
  currentStep = 1,
  onSubmit,
  formId,
  children,
  mobileActionBar = null,
}) {
  return (
    <div className="min-h-full" style={{ color: "var(--foreground)" }}>
      {msgState ? (
        <Msg type={msgState.type} show={msgState.show}>
          {msgState.text}
        </Msg>
      ) : null}
      {loadingMessage ? (
        <FullPageLoading visible={loading} message={loadingMessage} />
      ) : null}
      {topContent}

        {headerContent}
        {steps.length > 0 ? (
          <StoreFormStepIndicator steps={steps} currentStep={currentStep} />
        ) : null}
        <form
          id={formId}
          onSubmit={onSubmit}
          className="space-y-3 pb-32 sm:pb-0"
        >
          {children}
          {mobileActionBar ? (
            <div
              className="fixed inset-x-0 z-[55] backdrop-blur-md sm:hidden"
              style={{
                bottom: "calc(3.5rem + env(safe-area-inset-bottom))",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(15,15,15,0.95)",
              }}
            >
              <div className="mx-auto max-w-screen-md px-3 py-2">
                {mobileActionBar}
              </div>
            </div>
          ) : null}
        </form>
    </div>
  );
}
