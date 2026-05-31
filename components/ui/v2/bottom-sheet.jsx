import React from 'react'

export function BottomSheet({ open, onClose, children, height = '70vh' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="w-full rounded-t-2xl bg-surface p-4 shadow-xl" style={{ height }}>
        <div className="mx-auto max-w-screen-md h-full overflow-auto">
          <div className="mb-3 flex items-center justify-end">
            <button aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-gray-200" onClick={onClose}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default BottomSheet
