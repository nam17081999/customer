import { useEffect, useRef, useState } from 'react'

export function Msg({ type = 'info', children, show = true, duration = 2500 }) {
  const [mounted, setMounted] = useState(show)
  const [visible, setVisible] = useState(show)
  const hideTimerRef = useRef(null)

  useEffect(() => {
    // Clear any pending unmount timer when state changes
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }

    if (show) {
      // Ensure component is mounted, then animate in next frame
      if (!mounted) setMounted(true)
      requestAnimationFrame(() => setVisible(true))
    } else {
      // Trigger exit animation
      setVisible(false)
      // Schedule unmount after animation duration
      hideTimerRef.current = setTimeout(() => {
        setMounted(false)
      }, 300)
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [show, duration, mounted])

  if (!mounted) return null

  const base = 'pointer-events-none select-none fixed left-1/2 -translate-x-1/2 top-5 z-[60000] px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm'
  const styles = {
    success: 'bg-emerald-600/95 text-white shadow-emerald-900/30',
    error: 'bg-red-600/95 text-white shadow-red-900/30',
    info: 'bg-gray-800/95 text-white shadow-black/30',
  }
  const stateCls = visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-3 scale-95'

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        base,
        styles[type] || styles.info,
        'transition-all duration-300 ease-out w-[92%] max-w-md break-words will-change-transform will-change-opacity',
        stateCls,
      ].join(' ')}
    >
      {type === 'success' && (
        <svg className="w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      )}
      {type === 'error' && (
        <svg className="w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
      )}
      {type === 'info' && (
        <svg className="w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      )}
      <span className="leading-snug">{children}</span>
    </div>
  )
}
