import { describe, expect, it } from 'vitest'

import {
  buildEditSteps,
  buildDuplicatePhoneMessage,
  buildEditUpdates,
  buildSupplementLocks,
  buildSupplementSteps,
  buildSupplementUpdates,
  getFinalCoordinates,
  hasEditableSupplementFields,
  validateStoreEditPhones,
} from '@/helper/storeEditFlow'

describe('buildSupplementLocks', () => {
  it('khóa field đã có dữ liệu và mở field còn thiếu', () => {
    const locks = buildSupplementLocks(
      {
        name: 'Tạp hóa Minh Anh',
        store_type: 'Tạp hóa',
        address_detail: '',
        ward: 'An Khánh',
        district: '',
        phone: '0901234567',
        phone_secondary: '',
        note: null,
      },
      true
    )

    expect(locks).toEqual({
      name: true,
      storeType: true,
      addressDetail: false,
      ward: true,
      district: false,
      phone: true,
      phoneSecondary: false,
      note: false,
      location: false,
    })
  })

  it('khóa location khi supplement location không được phép', () => {
    const locks = buildSupplementLocks({}, false)
    expect(locks.location).toBe(true)
  })
})

describe('buildEditSteps', () => {
  it('trả về 3 bước giống layout create cho màn edit', () => {
    expect(buildEditSteps()).toEqual([
      { num: 1, label: 'Tên' },
      { num: 2, label: 'Thông tin' },
      { num: 3, label: 'Vị trí' },
    ])
  })
})

describe('buildSupplementSteps', () => {
  it('trả về 2 bước khi store đã có vị trí', () => {
    expect(buildSupplementSteps(false)).toEqual([
      { num: 1, label: 'Tên' },
      { num: 2, label: 'Thông tin' },
    ])
  })

  it('trả về 3 bước khi còn bổ sung vị trí', () => {
    expect(buildSupplementSteps(true)).toEqual([
      { num: 1, label: 'Tên' },
      { num: 2, label: 'Thông tin' },
      { num: 3, label: 'Vị trí' },
    ])
  })
})

describe('hasEditableSupplementFields', () => {
  it('trả về true khi còn ít nhất một field chưa khóa', () => {
    expect(hasEditableSupplementFields({ name: true, note: false })).toBe(true)
  })

  it('trả về false khi mọi field đều đã khóa', () => {
    expect(hasEditableSupplementFields({ name: true, note: true, location: true })).toBe(false)
  })
})

describe('getFinalCoordinates', () => {
  it('ưu tiên tọa độ map do người dùng chỉnh', () => {
    expect(getFinalCoordinates({
      userHasEditedMap: true,
      pickedLat: 21.1,
      pickedLng: 105.9,
      initialGPSLat: 21.0,
      initialGPSLng: 105.8,
    })).toEqual({ latitude: 21.1, longitude: 105.9 })
  })

  it('fallback về GPS ban đầu khi chưa sửa map', () => {
    expect(getFinalCoordinates({
      userHasEditedMap: false,
      pickedLat: 21.1,
      pickedLng: 105.9,
      initialGPSLat: 21.0,
      initialGPSLng: 105.8,
    })).toEqual({ latitude: 21.0, longitude: 105.8 })
  })

  it('fallback về picked coordinates khi không có GPS ban đầu', () => {
    expect(getFinalCoordinates({
      userHasEditedMap: false,
      pickedLat: 21.1,
      pickedLng: 105.9,
      initialGPSLat: null,
      initialGPSLng: null,
    })).toEqual({ latitude: 21.1, longitude: 105.9 })
  })
})

describe('buildSupplementUpdates', () => {
  it('chỉ build field còn thiếu và thêm updated_at', () => {
    const updates = buildSupplementUpdates({
      supplementLocks: {
        name: true,
        storeType: false,
        addressDetail: false,
        ward: true,
        district: false,
        phone: false,
        phoneSecondary: false,
        note: false,
        location: false,
      },
      values: {
        name: 'không dùng',
        storeType: 'Quán ăn',
        addressDetail: 'xóm chợ',
        district: 'hoài đức',
        ward: 'không dùng',
        note: 'Gần cổng chợ',
      },
      validatedPhone: '0901234567',
      validatedPhoneSecondary: '',
      coordinates: { latitude: 21.01, longitude: 105.81 },
      nowIso: '2026-04-23T12:00:00.000Z',
    })

    expect(updates).toEqual({
      store_type: 'Quán ăn',
      address_detail: 'Xóm Chợ',
      district: 'Hoài Đức',
      phone: '0901234567',
      note: 'Gần cổng chợ',
      latitude: 21.01,
      longitude: 105.81,
      updated_at: '2026-04-23T12:00:00.000Z',
    })
  })

  it('trả về object rỗng nếu không có field nào thật sự được bổ sung', () => {
    const updates = buildSupplementUpdates({
      supplementLocks: {
        name: true,
        storeType: true,
        addressDetail: true,
        ward: true,
        district: true,
        phone: true,
        phoneSecondary: true,
        note: true,
        location: true,
      },
      values: {},
      validatedPhone: '',
      validatedPhoneSecondary: '',
      coordinates: { latitude: null, longitude: null },
      nowIso: '2026-04-23T12:00:00.000Z',
    })

    expect(updates).toEqual({})
  })
})

describe('buildEditUpdates', () => {
  it('build payload edit đầy đủ theo rule hiện tại', () => {
    const updates = buildEditUpdates({
      values: {
        name: 'tạp hóa minh anh',
        storeType: 'Tạp hóa',
        addressDetail: 'xóm chợ',
        ward: 'an khánh',
        district: 'hoài đức',
        note: '  ',
      },
      validatedPhone: '0901234567',
      validatedPhoneSecondary: '',
      active: 1,
      coordinates: { latitude: 21.01, longitude: 105.81 },
      nowIso: '2026-04-23T12:00:00.000Z',
    })

    expect(updates).toEqual({
      name: 'Tạp Hóa Minh Anh',
      store_type: 'Tạp hóa',
      address_detail: 'Xóm Chợ',
      ward: 'An Khánh',
      district: 'Hoài Đức',
      phone: '0901234567',
      phone_secondary: null,
      note: null,
      active: true,
      latitude: 21.01,
      longitude: 105.81,
      updated_at: '2026-04-23T12:00:00.000Z',
    })
  })
})

describe('buildDuplicatePhoneMessage', () => {
  it('ghép tối đa 3 tên store vào thông báo', () => {
    expect(buildDuplicatePhoneMessage([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'D' },
    ], 'Số điện thoại 1')).toBe('Số điện thoại 1 đã tồn tại ở A; B; C')
  })
})

describe('validateStoreEditPhones', () => {
  it('validate và normalize số chính', () => {
    expect(validateStoreEditPhones({
      phone: '+84901234567',
      phoneSecondary: '',
      store: {},
      storeId: 1,
      stores: [],
      supplementLocks: {},
    })).toEqual({
      normalizedPhone: '0901234567',
      normalizedPhoneSecondary: '',
      error: '',
    })
  })

  it('báo lỗi nếu chỉ nhập số phụ', () => {
    expect(validateStoreEditPhones({
      phone: '',
      phoneSecondary: '0901234567',
      store: {},
      storeId: 1,
      stores: [],
      supplementLocks: {},
    }).error).toBe('Vui lòng nhập số điện thoại 1 trước')
  })

  it('báo lỗi nếu số phụ trùng số chính', () => {
    expect(validateStoreEditPhones({
      phone: '0901234567',
      phoneSecondary: '0901234567',
      store: {},
      storeId: 1,
      stores: [],
      supplementLocks: {},
    }).error).toBe('Số điện thoại 2 không được trùng số điện thoại 1')
  })

  it('báo lỗi nếu trùng store khác trong cache', () => {
    const result = validateStoreEditPhones({
      phone: '0901234567',
      phoneSecondary: '',
      store: {},
      storeId: 1,
      stores: [
        { id: 2, name: 'Tạp hóa Minh Anh', phone: '0901234567' },
      ],
      supplementLocks: {},
    })

    expect(result.error).toBe('Số điện thoại 1 đã tồn tại ở Tạp hóa Minh Anh')
  })

  it('bỏ qua duplicate của chính store hiện tại', () => {
    const result = validateStoreEditPhones({
      phone: '0901234567',
      phoneSecondary: '',
      store: {},
      storeId: 1,
      stores: [
        { id: 1, name: 'Tạp hóa Minh Anh', phone: '0901234567' },
      ],
      supplementLocks: {},
    })

    expect(result.error).toBe('')
    expect(result.normalizedPhone).toBe('0901234567')
  })

  it('dùng fallback phone đã khóa trong supplement mode', () => {
    const result = validateStoreEditPhones({
      phone: '',
      phoneSecondary: '0901234568',
      store: {
        phone: '0901234567',
        phone_secondary: '',
      },
      storeId: 1,
      stores: [],
      supplementLocks: {
        phone: true,
        phoneSecondary: false,
      },
      skipWhenLocked: true,
    })

    expect(result).toEqual({
      normalizedPhone: '0901234567',
      normalizedPhoneSecondary: '0901234568',
      error: '',
    })
  })
})
