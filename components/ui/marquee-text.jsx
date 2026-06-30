'use client'
import { useRef, useEffect } from 'react'

export default function MarqueeText({ text, className = '' }) {
  const containerRef = useRef(null)
  const textRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const textEl = textRef.current
    if (!container || !textEl) return

    const check = () => {
      if (textEl.scrollWidth > container.clientWidth) {
        const dist = textEl.scrollWidth - container.clientWidth
        container.style.setProperty('--overflow-distance', `${dist}px`)
        container.style.setProperty('--overflow-duration', `${Math.max(4, dist / 30)}s`)
        textEl.classList.add('store-name-marquee')
      }
    }

    check()
    const observer = new ResizeObserver(check)
    observer.observe(container)
    return () => observer.disconnect()
  }, [text])

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap min-w-0 ${className} `}>
      <span ref={textRef} className="inline-block max-w-full">{text}</span>
    </div>
  )
}
