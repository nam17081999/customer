import React from 'react'
import { LoaderCircle } from 'lucide-react'

export function FullPageLoading({ visible = false, message = 'Đang xử lý…' }) {
  if (!visible) return null
  return (
    <div aria-hidden={!visible} className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-[99999] flex flex-col items-center gap-3 px-5 py-4 text-gray-100" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,15,15,0.92)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
          <LoaderCircle className="h-7 w-7 animate-spin text-[color:var(--primary)]" strokeWidth={1.8} />
        </div>
        <div className="text-sm">{message}</div>
      </div>
    </div>
  )
}

export default FullPageLoading

