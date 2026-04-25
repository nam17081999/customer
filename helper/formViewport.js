export function scrollToFirstMatchingTarget(selectors = []) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  window.setTimeout(() => {
    for (const selector of selectors) {
      if (!selector) continue
      const target = document.querySelector(selector)
      if (!target) continue

      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (typeof target.focus === 'function' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'BUTTON')) {
        target.focus({ preventScroll: true })
      }
      break
    }
  }, 0)
}
