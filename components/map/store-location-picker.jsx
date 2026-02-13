import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'

const LocationPicker = dynamic(() => import('@/components/map/location-picker'), { ssr: false })

/**
 * StoreLocationPicker - Reusable map picker for store create/edit pages
 * 
 * @param {number} initialLat - Initial latitude
 * @param {number} initialLng - Initial longitude  
 * @param {function} onChange - Callback (lat, lng) when location changes
 * @param {boolean} editable - Whether map is unlocked for editing
 * @param {function} onToggleEditable - Callback to toggle lock/unlock
 * @param {string|number} height - Map height (default "60vh")
 * @param {number} heading - Compass heading for map rotation
 * @param {string} mapKey - Key for forcing re-render
 * @param {string} className - Additional wrapper class
 * @param {string} compassError - Compass error message to display
 * @param {boolean} geoBlocked - Whether geolocation is blocked
 * @param {function} onReload - Callback for reload when geo blocked
 * @param {boolean} showHelpText - Show help text below map (default false)
 * @param {boolean} showCoordinates - Show coordinates below map (default false)
 * @param {boolean} resolvingAddr - Show resolving address overlay
 * @param {function} onGetLocation - Callback to get fresh GPS location
 * @param {boolean} showControls - Show control buttons inside map (default true)
 */
export default function StoreLocationPicker({
  initialLat,
  initialLng,
  onChange,
  editable = false,
  onToggleEditable,
  height = '60vh',
  heading = null,
  mapKey,
  className = '',
  compassError = '',
  geoBlocked = false,
  onReload,
  showHelpText = false,
  showCoordinates = false,
  resolvingAddr = false,
  onGetLocation,
  showControls = true,
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Control buttons - top right inside map */}
      {showControls && (
        <div className="absolute top-3 right-2 z-[1100] flex flex-col gap-1.5 items-end">
          {/* Get location button */}
          {onGetLocation && (
            <button
              type="button"
              onClick={onGetLocation}
              disabled={resolvingAddr}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 shadow-lg flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              title="Lấy lại vị trí hiện tại"
            >
              <svg
                className={`w-3.5 h-3.5 ${resolvingAddr ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {resolvingAddr ? 'Đang lấy...' : 'Lấy lại vị trí'}
            </button>
          )}
          
          {/* Lock/Unlock button */}
          {onToggleEditable && (
            <button
              type="button"
              onClick={onToggleEditable}
              className={`border rounded-lg px-2.5 py-1.5 shadow-lg flex items-center gap-1.5 text-xs font-medium ${
                editable 
                  ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600' 
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={editable ? 'Khóa bản đồ' : 'Mở khóa để chỉnh vị trí'}
            >
              {editable ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Khóa
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  Mở khóa
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Lock status badge - top right (only show if no controls) */}
      {!showControls && (
        editable ? (
          <div className="absolute top-2 right-2 z-[1000] bg-orange-600 text-white px-2 py-1 rounded-md shadow-lg flex items-center gap-1 text-xs font-medium pointer-events-none">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Đang mở khóa
          </div>
        ) : (
          <div className="absolute top-2 right-2 z-[1000] bg-gray-700 text-white px-2 py-1 rounded-md shadow-lg flex items-center gap-1 text-xs font-medium pointer-events-none">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Đã khóa
          </div>
        )
      )}

      {/* Map */}
      <div className="relative">
        <LocationPicker
          key={mapKey}
          initialLat={initialLat}
          initialLng={initialLng}
          onChange={onChange}
          className={`rounded-md overflow-hidden ${geoBlocked ? 'blur-sm pointer-events-none select-none' : ''}`}
          editable={editable}
          onToggleEditable={onToggleEditable}
          heading={heading}
          height={height}
        />

        {/* Compass error - bottom right to avoid control buttons */}
        {compassError && (
          <div className="absolute bottom-3 right-2 z-[1000] max-w-[200px] rounded-md border border-orange-300 bg-orange-50 px-2 py-1.5 text-[10px] text-orange-800">
            {compassError}
          </div>
        )}

        {/* Geo blocked overlay */}
        {geoBlocked && (
          <div className="absolute inset-0 z-[1200] flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-xl border border-red-200 bg-white/95 p-5 text-center shadow-lg">
              <div className="text-base font-semibold text-red-600">
                Không thể lấy vị trí của bạn
              </div>
              <div className="mt-2 text-sm text-gray-700">
                Vui lòng bật định vị/GPS và cho phép quyền vị trí cho trình duyệt.
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Mở Cài đặt → Quyền vị trí → cho phép truy cập vị trí, sau đó thử lại.
              </div>
              {onReload && (
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={onReload}
                    className="w-full"
                  >
                    Tải lại trang
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resolving address overlay */}
        {resolvingAddr && (
          <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-white/70 dark:bg-black/60 backdrop-blur-sm rounded-md">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
              Đang lấy vị trí…
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
