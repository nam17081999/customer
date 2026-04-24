export function buildMergeDeduplicateStoresChangedDetail() {
  return {
    type: 'merge_deduplicate',
    shouldRefetchAll: true,
  }
}
