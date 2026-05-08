import { hasLocationCoordinates } from '@/helper/storeLocationStep'

export function buildStoreFormLocationPatch({
  lat,
  lng,
  userHasEditedMap = false,
} = {}) {
  return {
    geoBlocked: false,
    initialGPSLat: lat,
    initialGPSLng: lng,
    pickedLat: lat,
    pickedLng: lng,
    userHasEditedMap: Boolean(userHasEditedMap),
  }
}

export function buildReportLocationPatch({ lat, lng } = {}) {
  return {
    reportLat: lat,
    reportLng: lng,
  }
}

export function shouldAutoAcquireLocationOnStepEnter({ lat, lng } = {}) {
  return !hasLocationCoordinates(lat, lng)
}

export function getLocationStepEntryBehavior({ lat, lng } = {}) {
  return {
    shouldAutoAcquire: shouldAutoAcquireLocationOnStepEnter({ lat, lng }),
    reuseRefreshFlow: true,
  }
}
