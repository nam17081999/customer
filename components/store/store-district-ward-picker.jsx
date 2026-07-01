import { Label } from '@/components/ui/label'
import { DISTRICT_SUGGESTIONS, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'

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
    <div className="grid grid-cols-2 gap-3">
      <div id={districtContainerId || undefined} className="space-y-1.5">
        <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Quận / Huyện</Label>
        <select
          value={district}
          onChange={(e) => {
            onDistrictChange?.(e.target.value)
          }}
          className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Chọn quận / huyện</option>
          {DISTRICT_SUGGESTIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        {districtError ? <div className="text-xs text-red-600">{districtError}</div> : null}
      </div>

      <div id={wardContainerId || undefined} className="space-y-1.5">
        <Label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Xã / Phường</Label>
        <select
          value={ward}
          onChange={(e) => {
            onWardChange?.(e.target.value)
          }}
          className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={!district}
        >
          <option value="">{district ? 'Chọn xã / phường' : 'Chọn quận trước'}</option>
          {wardOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        {wardError ? <div className="text-xs text-red-600">{wardError}</div> : null}
      </div>
    </div>
  )
}
