import { useState, useEffect } from 'react'
import { DEFAULT_STORE_TYPE, STORE_TYPE_OPTIONS } from '@/lib/constants'

const DEFAULT_VISIBLE_COUNT = 2

export default function StoreTypePicker({
  id = 'store_type',
  value = DEFAULT_STORE_TYPE,
  onChange,
  label = 'Loại cửa hàng',
  hiddenSelect = true,
  showMore = false,
  inline = false,
}) {
  const selectedValue = value || DEFAULT_STORE_TYPE
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (
      showMore
      && !STORE_TYPE_OPTIONS.slice(0, DEFAULT_VISIBLE_COUNT).some((t) => t.value === selectedValue)
    ) {
      setExpanded(true)
    }
  }, [showMore, selectedValue])

  const visibleTypes = showMore && !expanded
    ? STORE_TYPE_OPTIONS.slice(0, DEFAULT_VISIBLE_COUNT)
    : STORE_TYPE_OPTIONS

  if (inline) {
    return (
      <select
        id={id}
        value={selectedValue}
        onChange={(event) => onChange?.(event.target.value || DEFAULT_STORE_TYPE)}
        aria-label={label}
        className="h-11 rounded-md border border-gray-700 bg-gray-900 px-2 text-sm text-gray-100 w-auto min-w-[90px]"
      >
        {STORE_TYPE_OPTIONS.map((type) => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {visibleTypes.map((type) => {
          const selected = selectedValue === type.value
          return (
            <button
              key={`${id}-${type.value}`}
              type="button"
              onClick={() => onChange?.(type.value || DEFAULT_STORE_TYPE)}
              aria-pressed={selected}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                selected
                  ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                  : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'
              }`}
            >
              {type.label}
            </button>
          )
        })}
        {showMore && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-md border border-dashed border-gray-600 bg-transparent px-2.5 py-1 text-xs text-gray-400 transition hover:border-gray-500 hover:text-gray-300"
          >
            Xem thêm
          </button>
        ) : null}
      </div>
      {showMore && expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full text-center text-xs text-gray-500 transition hover:text-gray-400"
        >
          Thu gọn
        </button>
      ) : null}
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
