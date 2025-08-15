import React from 'react'

export default function LocationSwitch({ locationMode, onLocationModeChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 dark:text-gray-400">
        So sánh với:
      </span>
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <button
          onClick={() => onLocationModeChange?.('user')}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
            locationMode === 'user'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Tôi
        </button>
        <button
          onClick={() => onLocationModeChange?.('npp')}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
            locationMode === 'npp'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          NPP
        </button>
      </div>
    </div>
  )
}
