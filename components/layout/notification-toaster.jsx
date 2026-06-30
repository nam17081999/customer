'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { subscribeFeed, markFeedRead } from '@/lib/notification-store'
import { playNotificationSound } from '@/lib/notification-sound'

const DURATION = 7000 // 7s auto-dismiss

const ALERT_STYLES = {
  'low-stock': {
    accent: 'border-l-amber-500',
    dot: 'bg-amber-500',
    icon: (
      <svg className="h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  'report': {
    accent: 'border-l-red-500',
    dot: 'bg-red-500',
    icon: (
      <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  'store-verify': {
    accent: 'border-l-blue-500',
    dot: 'bg-blue-500',
    icon: (
      <svg className="h-4 w-4 shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-2m-6 0h-2" />
      </svg>
    ),
  },
}

// ─── Single toast ──────────────────────────────────────────────────
function NotifItem({ item, onClose }) {
  const [phase, setPhase] = useState('enter')
  const [hovering, setHovering] = useState(false)
  const [readMarked, setReadMarked] = useState(false)
  const timerRef = useRef(null)
  const pausedRef = useRef(false)

  // Mark as read on hover (once)
  const markReadOnce = useCallback(async () => {
    if (readMarked || !item.id) return
    setReadMarked(true)
    await markFeedRead(item.id).catch(() => {})
  }, [readMarked, item.id])

  // Auto-dismiss
  useEffect(() => {
    requestAnimationFrame(() => setPhase('visible'))
    timerRef.current = setTimeout(() => {
      setPhase('exit')
      setTimeout(onClose, 400)
    }, DURATION)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onClose])

  // Pause/resume timer on hover
  useEffect(() => {
    if (hovering) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        pausedRef.current = true
      }
    } else if (pausedRef.current && phase === 'visible' && !timerRef.current) {
      // Rời chuột → restart timer
      timerRef.current = setTimeout(() => {
        setPhase('exit')
        setTimeout(onClose, 400)
      }, DURATION)
    }
  }, [hovering, phase, onClose])

  const style = ALERT_STYLES[item.type] || ALERT_STYLES.report

  return (
    <div
      onMouseEnter={() => { setHovering(true); markReadOnce() }}
      onMouseLeave={() => setHovering(false)}
      className={`
        relative overflow-hidden w-[360px] rounded-xl border border-white/[0.08] bg-gray-900/95 backdrop-blur-2xl shadow-2xl shadow-black/60
        border-l-[3px] ${style.accent}
        transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]
        ${phase === 'enter' ? 'translate-x-[120%] opacity-0' : ''}
        ${phase === 'visible' ? 'translate-x-0 opacity-100' : ''}
        ${phase === 'exit' ? 'translate-x-[120%] opacity-0 scale-95' : ''}
      `}
    >
      {/* Title line */}
      <div className="flex items-start gap-3 px-3.5 pt-3 pb-1">
        <span className={`mt-1 shrink-0 h-2 w-2 rounded-full ${style.dot}`} />
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {style.icon}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">
              {item.title}
            </p>
            <p className="text-xs text-gray-400 leading-snug mt-0.5">
              {item.detail}
            </p>
          </div>
        </div>
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (item.id && !readMarked) {
              await markFeedRead(item.id).catch(() => {})
            }
            setPhase('exit')
            setTimeout(onClose, 400)
          }}
          className="shrink-0 mt-0.5 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar — only show when not hovering */}
      {!hovering && (
        <div className="h-[2px] bg-white/[0.06] overflow-hidden mt-1">
          <div
            className={`h-full ${style.dot}`}
            style={{ animation: `notifShrink ${DURATION}ms linear`, transformOrigin: 'left' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Container ────────────────────────────────────────────────────
export function NotificationToaster() {
  const [alerts, setAlerts] = useState([])

  // Track which feed IDs we already showed as toast (never removed)
  const shownRef = useRef(new Set())

  // Track toast IDs for items already in alerts (dedup via id)
  const alertIdsRef = useRef(new Set())

  const removeAlert = useCallback((toastId) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.toastId !== toastId)
      return next
    })
  }, [])

  // Subscribe to feed changes → show toast for new unread items
  // NOTE: opening the bell panel may mark items as read on the server,
  // but toasts already shown stay because shownRef is additive only.
  useEffect(() => {
    const unsub = subscribeFeed((feed) => {
      const candidates = feed.filter(e => !e.is_read)
      for (const item of candidates) {
        if (shownRef.current.has(item.id)) continue
        shownRef.current.add(item.id)

        playNotificationSound(item.type)
        const toastId = Date.now() + Math.random()
        alertIdsRef.current.add(item.id)

        setAlerts((prev) => {
          const next = [...prev, { toastId, id: item.id, type: item.type, title: item.title, detail: item.detail }]
          return next.length > 4 ? next.slice(-4) : next
        })
      }
    })
    return unsub
  }, [])

  // Also listen for manual notification events (e.g. from polling)
  useEffect(() => {
    const handler = (e) => {
      if (!e.detail || !e.detail.id) return
      if (shownRef.current.has(e.detail.id)) return
      shownRef.current.add(e.detail.id)

      playNotificationSound(e.detail.type)
      const toastId = Date.now() + Math.random()

      setAlerts((prev) => {
        const next = [...prev, { toastId, ...e.detail }]
        return next.length > 4 ? next.slice(-4) : next
      })
    }
    window.addEventListener('notification', handler)
    return () => window.removeEventListener('notification', handler)
  }, [])

  if (alerts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col-reverse gap-2.5 pointer-events-none">
      {alerts.map((alert) => (
        <div key={alert.toastId} className="pointer-events-auto">
          <NotifItem item={alert} onClose={() => removeAlert(alert.toastId)} />
        </div>
      ))}
    </div>
  )
}
