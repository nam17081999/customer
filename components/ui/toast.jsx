'use client'

import { useEffect, useState } from 'react'

export function Toast({ message, type = 'success', visible, onDismiss, duration = 3000 }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        onDismiss?.()
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [visible, duration, onDismiss])

  return (
    <div
      className={`
        fixed top-4 right-4 z-[200] max-w-sm
        px-5 py-3 rounded-xl shadow-lg
        border border-[var(--border)] bg-[var(--surface)]
        text-sm text-[var(--fg)]
        transition-all duration-300 ease-out
        ${show ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0 pointer-events-none'}
      `}
      style={{
        borderLeft: `3px solid ${type === 'success' ? 'var(--green)' : 'var(--red)'}`
      }}
    >
      {message}
    </div>
  )
}
