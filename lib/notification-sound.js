'use client'

// ════════════════════════════════════════════════════════════════════
// Shared audio context — must be resumed on first user gesture
// Browsers block AudioContext until user interacts with the page.
// We lazily init + resume on first document click/keydown.
// ════════════════════════════════════════════════════════════════════

let ctx = null
let initialized = false

function getAudioContext() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch { return null }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

/** Call once on first user interaction so AudioContext becomes allowed */
export function initNotificationSound() {
  if (initialized) return
  initialized = true
  // Just creating + automatic resume is enough
  getAudioContext()
}

/**
 * Play a short synthesized alert sound matching notification type.
 * Safe to call multiple times — AudioContext is reused.
 */
export function playNotificationSound(type) {
  const ac = getAudioContext()
  if (!ac) return

  try {
    const gain = ac.createGain()
    gain.connect(ac.destination)
    gain.gain.value = 0.12

    if (type === 'low-stock') {
      // Two descending triangle beeps
      ;[0, 0.12].forEach((delay) => {
        const osc = ac.createOscillator()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(660, ac.currentTime + delay)
        osc.frequency.linearRampToValueAtTime(360, ac.currentTime + delay + 0.12)
        const g = ac.createGain()
        g.gain.value = 0.1
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.15)
        osc.connect(g).connect(ac.destination)
        osc.start(ac.currentTime + delay)
        osc.stop(ac.currentTime + delay + 0.15)
      })
    } else if (type === 'store-verify') {
      // Rising two-note chord
      ;[0, 0.1].forEach((delay) => {
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ac.currentTime + delay)
        osc.frequency.linearRampToValueAtTime(1100, ac.currentTime + delay + 0.12)
        const g = ac.createGain()
        g.gain.value = 0.08
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.2)
        osc.connect(g).connect(gain)
        osc.start(ac.currentTime + delay)
        osc.stop(ac.currentTime + delay + 0.25)
      })
    } else {
      // Single chime
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ac.currentTime)
      osc.frequency.linearRampToValueAtTime(1200, ac.currentTime + 0.08)
      const g = ac.createGain()
      g.gain.value = 0.08
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25)
      osc.connect(g).connect(ac.destination)
      osc.start()
      osc.stop(ac.currentTime + 0.3)
    }
  } catch { /* audio fail silently */ }
}
