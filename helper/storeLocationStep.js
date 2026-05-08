export function hasLocationCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
}

export function buildLocationStepResetPatch(step2Key = 0) {
  return {
    geoBlocked: false,
    mapEditable: false,
    userHasEditedMap: false,
    pickedLat: null,
    pickedLng: null,
    initialGPSLat: null,
    initialGPSLng: null,
    heading: null,
    nextStep2Key: step2Key + 1,
  }
}

export function getLocationStepView({
  resolving = false,
  lat = null,
  lng = null,
  blocked = false,
} = {}) {
  const hasCoordinates = hasLocationCoordinates(lat, lng)

  if (blocked) {
    return {
      hasCoordinates,
      phase: 'blocked',
      shouldRenderMap: true,
      shouldShowPlaceholder: false,
    }
  }

  if (hasCoordinates) {
    return {
      hasCoordinates,
      phase: 'ready',
      shouldRenderMap: true,
      shouldShowPlaceholder: false,
    }
  }

  if (resolving) {
    return {
      hasCoordinates: false,
      phase: 'bootstrapping',
      shouldRenderMap: false,
      shouldShowPlaceholder: true,
    }
  }

  return {
    hasCoordinates: false,
    phase: 'awaiting_input',
    shouldRenderMap: false,
    shouldShowPlaceholder: true,
  }
}

export function getCreateLocationStepView({
  resolvingAddr = false,
  pickedLat = null,
  pickedLng = null,
  geoBlocked = false,
} = {}) {
  return getLocationStepView({
    resolving: resolvingAddr,
    lat: pickedLat,
    lng: pickedLng,
    blocked: geoBlocked,
  })
}
