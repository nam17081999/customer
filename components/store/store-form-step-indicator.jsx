export default function StoreFormStepIndicator({ steps = [], currentStep = 1 }) {
  return (
    <div className="flex items-center justify-center gap-1 pb-1">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              currentStep === step.num
                ? 'bg-blue-600 text-white'
                : currentStep > step.num
                  ? 'bg-green-900/40 text-green-400 border border-green-900/50'
                  : 'bg-gray-800 border border-gray-700 text-gray-400'
            }`}
          >
            {currentStep > step.num ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span>{step.num}</span>
            )}
            <span>{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-6 h-0.5 mx-1 rounded ${currentStep > step.num ? 'bg-green-600' : 'bg-gray-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
