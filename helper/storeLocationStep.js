export function hasLocationCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
}

export function buildLocationStepResetPatch(step2Key = 0, currentLocation = {}) {
  const hasCurrentCoordinates = hasLocationCoordinates(
    currentLocation.pickedLat,
    currentLocation.pickedLng
  )

  return {
    geoBlocked: false,
    mapEditable: false,
    userHasEditedMap: hasCurrentCoordinates ? Boolean(currentLocation.userHasEditedMap) : false,
    pickedLat: hasCurrentCoordinates ? currentLocation.pickedLat : null,
    pickedLng: hasCurrentCoordinates ? currentLocation.pickedLng : null,
    initialGPSLat: hasLocationCoordinates(currentLocation.initialGPSLat, currentLocation.initialGPSLng)
      ? currentLocation.initialGPSLat
      : null,
    initialGPSLng: hasLocationCoordinates(currentLocation.initialGPSLat, currentLocation.initialGPSLng)
      ? currentLocation.initialGPSLng
      : null,
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
