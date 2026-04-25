import { Label } from '@/components/ui/label'
import { DEFAULT_STORE_TYPE, STORE_TYPE_OPTIONS } from '@/lib/constants'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'

export default function StoreTypePicker({
  id = 'store_type',
  value = DEFAULT_STORE_TYPE,
  onChange,
  label = 'Loại cửa hàng',
  hiddenSelect = true,
}) {
  const selectedValue = value || DEFAULT_STORE_TYPE

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block text-sm font-medium text-gray-600 dark:text-gray-300">
        {label}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {STORE_TYPE_OPTIONS.map((type) => {
          const selected = selectedValue === type.value
          const typeMeta = getStoreTypeMeta(type.value)
          return (
            <button
              key={`${id}-${type.value}`}
              type="button"
              onClick={() => onChange?.(type.value || DEFAULT_STORE_TYPE)}
              aria-pressed={selected}
              className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition ${
                selected
                  ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                  : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center">
                  {typeMeta.icon}
                </span>
                <span>{type.label}</span>
              </span>
            </button>
          )
        })}
      </div>
      <select
        hidden={hiddenSelect}
        id={id}
        value={selectedValue}
        onChange={(event) => onChange?.(event.target.value || DEFAULT_STORE_TYPE)}
        aria-label={label}
        className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
      >
        {STORE_TYPE_OPTIONS.map((type) => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>
    </div>
  )
}
