import { Label } from '@/components/ui/label'
import { DISTRICT_SUGGESTIONS, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import removeVietnameseTones from '@/helper/removeVietnameseTones'

function isSameVietnameseText(left, right) {
  return removeVietnameseTones(left || '').toLowerCase() === removeVietnameseTones(right || '').toLowerCase()
}

export default function StoreDistrictWardPicker({
  district = '',
  ward = '',
  onDistrictChange,
  onWardChange,
  districtError = '',
  wardError = '',
  districtContainerId = '',
  wardContainerId = '',
}) {
  const wardOptions = district ? (DISTRICT_WARD_SUGGESTIONS[district] || []) : []

  return (
    <>
      <div id={districtContainerId || undefined} className="space-y-1.5">
        <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Quận / Huyện</Label>
        <div className="flex flex-wrap gap-2">
          {DISTRICT_SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isSameVietnameseText(district, item)
                  ? 'border border-blue-600 bg-blue-600 text-white'
                  : 'border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
              }`}
              onClick={() => onDistrictChange?.(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {districtError ? <div className="text-xs text-red-600">{districtError}</div> : null}
      </div>

      {district && wardOptions.length > 0 ? (
        <div id={wardContainerId || undefined} className="space-y-1.5">
          <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Xã / Phường</Label>
          <div className="flex flex-wrap gap-2">
            {wardOptions.map((item) => (
              <button
                key={item}
                type="button"
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isSameVietnameseText(ward, item)
                    ? 'border border-blue-600 bg-blue-600 text-white'
                    : 'border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                }`}
                onClick={() => onWardChange?.(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {wardError ? <div className="text-xs text-red-600">{wardError}</div> : null}
        </div>
      ) : null}
    </>
  )
}
