import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  ROUTE_DRAG_CANCEL_PX,
  ROUTE_DRAG_HOLD_MS,
  buildRenderedRouteStops,
  getRouteAutoScrollDelta,
  getRouteDragTargetIndex,
} from '@/helper/mapRouteDrag'
import { moveItem } from '@/helper/mapRoute'

export function useMapRouteDragController({
  routeStops,
  setRouteStops,
  resetRouteProgress,
}) {
  const [armedRouteIndex, setArmedRouteIndex] = useState(-1)
  const [draggedRouteIndex, setDraggedRouteIndex] = useState(-1)
  const [dragOverRouteIndex, setDragOverRouteIndex] = useState(-1)
  const [dragRouteOffset, setDragRouteOffset] = useState({ x: 0, y: 0 })
  const [dragRouteBox, setDragRouteBox] = useState(null)

  const routeListScrollRef = useRef(null)
  const routeItemRefs = useRef(new Map())
  const routeDragStateRef = useRef(null)
  const pendingRouteDragRef = useRef(null)
  const routeAutoScrollRef = useRef(null)

  const renderedRouteStops = useMemo(
    () => buildRenderedRouteStops(routeStops, draggedRouteIndex, dragOverRouteIndex),
    [dragOverRouteIndex, draggedRouteIndex, routeStops]
  )
  const draggedRouteStore = draggedRouteIndex >= 0 ? routeStops[draggedRouteIndex] : null

  const cancelPendingRouteDrag = useCallback(() => {
    if (!pendingRouteDragRef.current) return
    window.clearTimeout(pendingRouteDragRef.current.timerId)
    pendingRouteDragRef.current = null
  }, [])

  const finishRouteDrag = useCallback((cancelled = false) => {
    const dragState = routeDragStateRef.current
    routeDragStateRef.current = null
    cancelPendingRouteDrag()
    if (routeAutoScrollRef.current) {
      window.cancelAnimationFrame(routeAutoScrollRef.current)
      routeAutoScrollRef.current = null
    }

    const fromIndex = dragState?.fromIndex ?? -1
    const toIndex = dragState?.targetIndex ?? -1

    if (!cancelled && fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      setRouteStops((prev) => moveItem(prev, fromIndex, toIndex))
      resetRouteProgress()
    }

    setArmedRouteIndex(-1)
    setDraggedRouteIndex(-1)
    setDragOverRouteIndex(-1)
    setDragRouteOffset({ x: 0, y: 0 })
    setDragRouteBox(null)
  }, [cancelPendingRouteDrag, resetRouteProgress, setRouteStops])

  const updateRouteDragTarget = useCallback((clientY) => {
    const entries = Array.from(routeItemRefs.current.entries()).map(([index, element]) => {
      return [index, element?.getBoundingClientRect?.() || null]
    })
    const nextTarget = getRouteDragTargetIndex(entries, clientY)
    if (nextTarget < 0) return

    if (routeDragStateRef.current) {
      routeDragStateRef.current.targetIndex = nextTarget
    }
    setDragOverRouteIndex(nextTarget)
  }, [])

  const tickRouteAutoScroll = useCallback(() => {
    routeAutoScrollRef.current = null
    const dragState = routeDragStateRef.current
    const container = routeListScrollRef.current
    if (!dragState || !container) return

    const delta = getRouteAutoScrollDelta(container.getBoundingClientRect(), dragState.lastClientY)
    if (delta !== 0) {
      container.scrollTop += delta
      updateRouteDragTarget(dragState.lastClientY)
      routeAutoScrollRef.current = window.requestAnimationFrame(tickRouteAutoScroll)
    }
  }, [updateRouteDragTarget])

  const activateRouteDrag = useCallback((dragState) => {
    if (!dragState?.element) return

    const elementRect = dragState.element.getBoundingClientRect()
    routeDragStateRef.current = {
      ...dragState,
      status: 'dragging',
      lastClientY: dragState.latestClientY,
    }
    dragState.element.setPointerCapture?.(dragState.pointerId)
    setArmedRouteIndex(-1)
    setDraggedRouteIndex(dragState.fromIndex)
    setDragOverRouteIndex(dragState.fromIndex)
    setDragRouteOffset({
      x: dragState.latestClientX - dragState.startX,
      y: dragState.latestClientY - dragState.startY,
    })
    setDragRouteBox({
      left: elementRect.left,
      top: elementRect.top,
      width: elementRect.width,
      height: elementRect.height,
    })
    updateRouteDragTarget(dragState.latestClientY)
  }, [updateRouteDragTarget])

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (routeDragStateRef.current?.status === 'dragging') {
        if (event.cancelable) event.preventDefault()
        routeDragStateRef.current.lastClientY = event.clientY
        routeDragStateRef.current.latestClientX = event.clientX
        routeDragStateRef.current.latestClientY = event.clientY
        setDragRouteOffset({
          x: event.clientX - routeDragStateRef.current.startX,
          y: event.clientY - routeDragStateRef.current.startY,
        })
        updateRouteDragTarget(event.clientY)
        if (!routeAutoScrollRef.current) {
          routeAutoScrollRef.current = window.requestAnimationFrame(tickRouteAutoScroll)
        }
        return
      }

      if (routeDragStateRef.current?.status === 'armed') {
        if (event.cancelable) event.preventDefault()
        routeDragStateRef.current.latestClientX = event.clientX
        routeDragStateRef.current.latestClientY = event.clientY
        routeDragStateRef.current.lastClientY = event.clientY

        const movedX = Math.abs(event.clientX - routeDragStateRef.current.startX)
        const movedY = Math.abs(event.clientY - routeDragStateRef.current.startY)
        if (movedX > 3 || movedY > 3) {
          activateRouteDrag(routeDragStateRef.current)
        }
        return
      }

      const pending = pendingRouteDragRef.current
      if (!pending) return

      const movedX = Math.abs(event.clientX - pending.startX)
      const movedY = Math.abs(event.clientY - pending.startY)
      if (movedX > ROUTE_DRAG_CANCEL_PX || movedY > ROUTE_DRAG_CANCEL_PX) {
        cancelPendingRouteDrag()
        return
      }
      pending.latestClientX = event.clientX
      pending.latestClientY = event.clientY
    }

    const handlePointerUp = () => {
      if (routeDragStateRef.current) {
        finishRouteDrag(false)
        return
      }
      cancelPendingRouteDrag()
      setArmedRouteIndex(-1)
    }

    const handlePointerCancel = () => {
      if (routeDragStateRef.current) {
        finishRouteDrag(true)
        return
      }
      cancelPendingRouteDrag()
      setArmedRouteIndex(-1)
    }

    const handleTouchMove = (event) => {
      if (!routeDragStateRef.current) return
      if (event.cancelable) event.preventDefault()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [activateRouteDrag, cancelPendingRouteDrag, finishRouteDrag, tickRouteAutoScroll, updateRouteDragTarget])

  const startRouteDrag = useCallback((index, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    cancelPendingRouteDrag()
    pendingRouteDragRef.current = {
      fromIndex: index,
      startX: event.clientX,
      startY: event.clientY,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      pointerId: event.pointerId,
      element: event.currentTarget,
      timerId: window.setTimeout(() => {
        const pending = pendingRouteDragRef.current
        if (!pending) return
        routeDragStateRef.current = {
          ...pending,
          status: 'armed',
          targetIndex: pending.fromIndex,
          lastClientY: pending.latestClientY,
        }
        pendingRouteDragRef.current = null
        setArmedRouteIndex(pending.fromIndex)
      }, ROUTE_DRAG_HOLD_MS),
    }
  }, [cancelPendingRouteDrag])

  const setRouteItemRef = useCallback((displayIndex, element) => {
    if (element) routeItemRefs.current.set(displayIndex, element)
    else routeItemRefs.current.delete(displayIndex)
  }, [])

  return {
    armedRouteIndex,
    draggedRouteIndex,
    dragOverRouteIndex,
    dragRouteOffset,
    dragRouteBox,
    routeListScrollRef,
    renderedRouteStops,
    draggedRouteStore,
    setRouteItemRef,
    startRouteDrag,
  }
}
