export async function getAdminNavbarCounts({ isAdmin, getStores, getPendingReports }) {
  if (!isAdmin) {
    return { pendingStores: 0, pendingReports: 0 }
  }

  const [stores, pendingReports] = await Promise.all([
    getStores(),
    getPendingReports(),
  ])

  const pendingStores = Array.isArray(stores)
    ? stores.filter((store) => store?.active !== true).length
    : 0

  return {
    pendingStores,
    pendingReports: typeof pendingReports === 'number' ? pendingReports : 0,
  }
}

export function shouldRefreshNavbarCountsForEvent(eventType) {
  return eventType === 'storevis:stores-changed' || eventType === 'storevis:reports-changed'
}
