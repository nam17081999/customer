import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const DEFAULT_PLACEHOLDER = 'https://maps.app.goo.gl/... ho\u1eb7c link Google Maps'
const LABEL = 'D\u00e1n \u0111\u01b0\u1eddng d\u1eabn Google Maps'
const LOADING_LABEL = '\u0110ang l\u1ea5y...'
const BUTTON_LABEL = 'L\u1ea5y v\u1ecb tr\u00ed'
const HINT = 'M\u1edf Google Maps \u2192 ch\u1ecdn v\u1ecb tr\u00ed \u2192 Chia s\u1ebb \u2192 Sao ch\u00e9p link'

export default function StoreMapsLinkFields({
  value = '',
  loading = false,
  error = '',
  mobile = false,
  placeholder = DEFAULT_PLACEHOLDER,
  onChange,
  onSubmit,
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-600 dark:text-gray-300">{LABEL}</label>
      <div className={mobile ? 'space-y-2' : 'flex gap-2'}>
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit?.()
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 text-base sm:text-base"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || !value.trim()}
          leftIcon={loading ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : undefined}
          onClick={() => onSubmit?.()}
          className={mobile ? 'w-full' : 'shrink-0'}
        >
          {loading ? LOADING_LABEL : BUTTON_LABEL}
        </Button>
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div className="text-xs text-gray-400 dark:text-gray-500">{HINT}</div>
    </div>
  )
}
