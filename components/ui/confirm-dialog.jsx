'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', danger }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="fixed inset-0 bg-black/60" />
      <div
        ref={dialogRef}
        className="relative w-full max-w-[400px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-lg flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[17px] font-bold text-[var(--fg)]">{title}</h3>
          <button
            className="size-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface2)] transition-colors"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-[var(--muted)]">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground transition-colors"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            className={danger
              ? "inline-flex items-center justify-center h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer bg-red-600 text-white hover:bg-red-500 border-none transition-colors"
              : "inline-flex items-center justify-center h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer bg-accent text-white hover:opacity-90 border-none transition-colors"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
