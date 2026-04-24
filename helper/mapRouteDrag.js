import { moveItem } from '@/helper/mapRoute'

export const ROUTE_DRAG_HOLD_MS = 220
export const ROUTE_DRAG_CANCEL_PX = 10
export const ROUTE_DRAG_AUTOSCROLL_THRESHOLD_PX = 56
export const ROUTE_DRAG_AUTOSCROLL_MAX_STEP_PX = 14

export function buildRenderedRouteStops(routeStops, draggedRouteIndex, dragOverRouteIndex) {
  const items = (routeStops || []).map((store, index) => ({ store, originalIndex: index }))
  if (draggedRouteIndex < 0 || dragOverRouteIndex < 0) {
    return items.map((item, displayIndex) => ({ ...item, displayIndex }))
  }

  return moveItem(items, draggedRouteIndex, dragOverRouteIndex)
    .map((item, displayIndex) => ({ ...item, displayIndex }))
}

export function getRouteDragTargetIndex(entries, clientY) {
  if (!Array.isArray(entries) || entries.length === 0) return -1

  let nextTarget = entries[entries.length - 1][0]
  for (const [index, rect] of entries) {
    if (!rect) continue
    if (clientY < rect.top + (rect.height / 2)) {
      nextTarget = index
      break
    }
  }

  return nextTarget
}

export function getRouteAutoScrollDelta(
  containerRect,
  clientY,
  threshold = ROUTE_DRAG_AUTOSCROLL_THRESHOLD_PX,
  maxStep = ROUTE_DRAG_AUTOSCROLL_MAX_STEP_PX
) {
  if (!containerRect) return 0

  if (clientY < containerRect.top + threshold) {
    return Math.max(-maxStep, -((containerRect.top + threshold - clientY) / 6))
  }

  if (clientY > containerRect.bottom - threshold) {
    return Math.min(maxStep, (clientY - (containerRect.bottom - threshold)) / 6)
  }

  return 0
}
