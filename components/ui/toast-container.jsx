'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToastStore } from '@/lib/toastStore'

function ToastItem({ toast, onDismiss }) {
  const [phase, setPhase] = useState('enter')
  const timerRef = useRef(null)

  useEffect(() => {
    requestAnimationFrame(() => setPhase('visible'))
    timerRef.current = setTimeout(() => {
      setPhase('exit')
      setTimeout(onDismiss, 300)
    }, toast.duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.duration, onDismiss])

  const bg = toast.type === 'error' ? 'border-l-red-500 bg-red-950/40' : 'border-l-green-500 bg-green-950/40'

  return (
    <div
      className={`
        w-[360px] rounded-xl border border-white/[0.08] border-l-[3px] ${bg}
        bg-gray-900/95 backdrop-blur-2xl shadow-2xl shadow-black/60
        transition-all duration-[300ms] ease-out
        ${phase === 'enter' ? 'translate-x-[120%] opacity-0' : ''}
        ${phase === 'visible' ? 'translate-x-0 opacity-100' : ''}
        ${phase === 'exit' ? 'translate-x-[120%] opacity-0' : ''}
      `}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <p className="flex-1 text-sm text-gray-100">{toast.message}</p>
        <button
          onClick={() => { setPhase('exit'); setTimeout(onDismiss, 300) }}
          className="shrink-0 text-gray-500 hover:text-gray-300 cursor-pointer"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function ToastContainer() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismissToast)

  if (!mounted || toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col-reverse gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
