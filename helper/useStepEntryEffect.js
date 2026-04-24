import { useEffect, useRef } from 'react'

export function useStepEntryEffect(isActive, onEnter) {
  const wasActiveRef = useRef(false)

  useEffect(() => {
    if (!isActive) {
      wasActiveRef.current = false
      return
    }

    if (wasActiveRef.current) return
    wasActiveRef.current = true
    void onEnter()
  }, [isActive, onEnter])
}
