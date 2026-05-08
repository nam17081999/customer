const BOOTSTRAP_OPTIONS = {
  maxWaitTime: 1500,
  desiredAccuracy: 30,
}

const REFRESH_OPTIONS = {
  maxWaitTime: 2000,
  desiredAccuracy: 30,
  skipCache: true,
}

const REPORT_REFRESH_OPTIONS = {
  maxWaitTime: 2000,
  desiredAccuracy: 15,
  skipCache: true,
}

const DUPLICATE_CHECK_OPTIONS = {
  maxWaitTime: 2000,
  desiredAccuracy: 50,
}

const FALLBACK_SUBMIT_OPTIONS = {
  maxWaitTime: 2000,
  desiredAccuracy: 30,
}

export function getLocationBootstrapOptions() {
  return { ...BOOTSTRAP_OPTIONS }
}

export function getLocationRefreshOptions({ profile = 'default' } = {}) {
  if (profile === 'report') return { ...REPORT_REFRESH_OPTIONS }
  return { ...REFRESH_OPTIONS }
}

export function getLocationDuplicateCheckOptions() {
  return { ...DUPLICATE_CHECK_OPTIONS }
}

export function getLocationFallbackSubmitOptions() {
  return { ...FALLBACK_SUBMIT_OPTIONS }
}
