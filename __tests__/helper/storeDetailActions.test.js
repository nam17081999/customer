import { describe, expect, it } from 'vitest'
import {
  buildStoreDetailActionModel,
  buildStoreDetailBadges,
  resolveQuickOrderCustomerSelection,
} from '@/helper/storeDetailActions'

describe('store detail badges and actions', () => {
  it('marks missing data and unverified stores for quick scanning', () => {
    const badges = buildStoreDetailBadges({
      active: false,
      phone: '',
      phone_secondary: '',
      latitude: null,
      longitude: null,
    })

    expect(badges.map((badge) => badge.key)).toEqual([
      'unverified',
      'missing-phone',
      'missing-location',
    ])
    expect(badges.every((badge) => badge.tone === 'warning')).toBe(true)
  })

  it('does not show data gap badges for complete verified stores', () => {
    const badges = buildStoreDetailBadges({
      active: true,
      phone: '0912345678',
      latitude: 21,
      longitude: 105,
    })

    expect(badges).toEqual([])
  })

  it('allows admin to create an order from the selected store', () => {
    const model = buildStoreDetailActionModel({
      store: { id: 'store-1', latitude: 21, longitude: 105 },
      isAdmin: true,
      isMapPage: false,
      from: '/?q=abc',
    })

    expect(model.actions.map((action) => action.key)).toContain('quick-order')
    expect(model.actions.find((action) => action.key === 'quick-order')).toMatchObject({
      label: 'Lên đơn',
      href: '/orders/new?storeId=store-1&from=%2F%3Fq%3Dabc',
    })
    expect(model.actions.map((action) => action.key)).toEqual([
      'open-map',
      'quick-order',
      'edit',
      'history',
      'report',
      'delete',
    ])
  })

  it('keeps public users on supplement/report actions only', () => {
    const model = buildStoreDetailActionModel({
      store: { id: 'store-1', latitude: null, longitude: null },
      isAdmin: false,
      isMapPage: false,
      from: '/',
    })

    expect(model.actions.map((action) => action.key)).toEqual(['supplement', 'report'])
  })

  it('resolves a selected order customer from the quick-order query once', () => {
    const stores = [
      { id: 'a', name: 'A', ward: 'Xã A', district: 'Huyện A' },
      { id: 'b', name: 'B', ward: 'Xã B', district: 'Huyện B' },
    ]

    expect(resolveQuickOrderCustomerSelection({ stores, queryStoreId: 'b', currentCustomerStoreId: '' })).toEqual({
      customerStoreId: 'b',
      customerQuery: 'B - Xã B - Huyện B',
    })
    expect(resolveQuickOrderCustomerSelection({ stores, queryStoreId: 'b', currentCustomerStoreId: 'a' })).toBe(null)
    expect(resolveQuickOrderCustomerSelection({ stores, queryStoreId: 'missing', currentCustomerStoreId: '' })).toBe(null)
  })

})
