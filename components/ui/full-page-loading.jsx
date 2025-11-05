import React from 'react'

export function FullPageLoading({ visible = false, message = 'Đang xử lý…' }) {
  if (!visible) return null
  return (
    <div aria-hidden={!visible} className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-[99999] flex flex-col items-center gap-3 bg-white dark:bg-gray-900/90 text-gray-900 dark:text-gray-100 rounded-md p-4 shadow-lg">
        <svg className="w-8 h-8 animate-spin text-gray-700 dark:text-gray-100" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4m8-8h-4M4 12H0m15.364-7.364l-2.828 2.828M7.464 16.536l-2.828 2.828m0-13.656l2.828 2.828M16.536 7.464l2.828 2.828" />
        </svg>
        <div className="text-sm">{message}</div>
      </div>
    </div>
  )
}

export default FullPageLoading

