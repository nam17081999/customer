import { describe, expect, it } from 'vitest'
import { buildMergeDeduplicateStoresChangedDetail } from '@/helper/storeDeduplicateEvents'

describe('store deduplicate events', () => {
  it('yêu cầu các màn đang mở refetch toàn bộ sau khi cache bị invalidate', () => {
    expect(buildMergeDeduplicateStoresChangedDetail()).toEqual({
      type: 'merge_deduplicate',
      shouldRefetchAll: true,
    })
  })
})
