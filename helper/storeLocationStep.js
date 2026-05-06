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
