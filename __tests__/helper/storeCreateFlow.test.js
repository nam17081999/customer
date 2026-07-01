import { describe, expect, it } from 'vitest'

import {
  buildCreateDuplicatePhoneMessage,
  buildCreateInsertPayload,
  buildCreatePrefillFromRouteQuery,
  extractCoordsFromMapsUrl,
  findNearestDistrictWard,
  getCreateFinalCoordinates,
  validateStoreCreateStep2,
} from '@/helper/storeCreateFlow'

describe('extractCoordsFromMapsUrl', () => {
  it('đọc được tọa độ từ pattern @lat,lng', () => {
    expect(extractCoordsFromMapsUrl('https://maps.google.com/@21.02851,105.80482,17z')).toEqual({
      lat: 21.02851,
      lng: 105.80482,
    })
  })

  it('đọc được tọa độ từ q=lat,lng', () => {
    expect(extractCoordsFromMapsUrl('https://maps.google.com/?q=21.1,105.9')).toEqual({
      lat: 21.1,
      lng: 105.9,
    })
  })

  it('trả về null khi không tìm thấy tọa độ hợp lệ', () => {
    expect(extractCoordsFromMapsUrl('https://maps.google.com/?q=999,999')).toBeNull()
    expect(extractCoordsFromMapsUrl('https://example.com')).toBeNull()
  })
})

describe('findNearestDistrictWard', () => {
  it('chọn store gần nhất có district/ward hợp lệ', () => {
    expect(findNearestDistrictWard([
      {
        district: 'quốc oai',
        ward: 'yên sơn',
        latitude: 21.05,
        longitude: 105.7,
      },
      {
        district: 'hoài đức',
        ward: 'an khánh',
        latitude: 21.01,
        longitude: 105.81,
      },
    ], 21.011, 105.809)).toEqual({
      district: 'Hoài Đức',
      ward: 'An Khánh',
    })
  })

  it('bỏ qua store thiếu tọa độ hoặc thiếu địa bàn', () => {
    expect(findNearestDistrictWard([
      { district: 'Hoài Đức', ward: 'An Khánh', latitude: null, longitude: 105.8 },
      { district: '', ward: 'An Thượng', latitude: 21.0, longitude: 105.8 },
    ], 21.0, 105.8)).toBeNull()
  })
})

describe('buildCreateDuplicatePhoneMessage', () => {
  it('ghép tối đa 3 tên store vào message', () => {
    expect(buildCreateDuplicatePhoneMessage([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'D' },
    ], 'Số điện thoại 1')).toBe('Số điện thoại 1 đã tồn tại ở A; B; C')
  })
})

describe('validateStoreCreateStep2', () => {
  it('báo lỗi district/ward và phone bắt buộc khi lưu nhanh', () => {
    expect(validateStoreCreateStep2({
      district: '',
      ward: '',
      phone: '',
      phoneSecondary: '',
      stores: [],
      requirePhone: true,
    })).toEqual({
      fieldErrors: {
        district: 'Vui lòng nhập quận/huyện',
        ward: 'Vui lòng nhập xã/phường',
        phone: 'Vui lòng nhập số điện thoại để lưu luôn',
      },
      normalizedPhone: '',
      normalizedPhoneSecondary: '',
    })
  })

  it('báo lỗi khi chỉ nhập số phụ', () => {
    expect(validateStoreCreateStep2({
      district: 'Hoài Đức',
      ward: 'An Khánh',
      phone: '',
      phoneSecondary: '0901234568',
      stores: [],
      requirePhone: false,
    }).fieldErrors.phone).toBe('Vui lòng nhập số điện thoại 1 trước')
  })

  it('báo lỗi khi số phụ trùng số chính', () => {
    expect(validateStoreCreateStep2({
      district: 'Hoài Đức',
      ward: 'An Khánh',
      phone: '0901234567',
      phoneSecondary: '0901234567',
      stores: [],
      requirePhone: false,
    }).fieldErrors.phone_secondary).toBe('Số điện thoại 2 không được trùng số điện thoại 1')
  })

  it('báo lỗi khi số điện thoại trùng store đã có', () => {
    const result = validateStoreCreateStep2({
      district: 'Hoài Đức',
      ward: 'An Khánh',
      phone: '0901234567',
      phoneSecondary: '',
      stores: [
        { id: 2, name: 'Tạp hóa Minh Anh', phone: '0901234567' },
      ],
      requirePhone: false,
    })

    expect(result.fieldErrors.phone).toBe('Số điện thoại 1 đã tồn tại ở Tạp hóa Minh Anh')
  })

  it('normalize thành công 2 số hợp lệ', () => {
    const result = validateStoreCreateStep2({
      district: 'Hoài Đức',
      ward: 'An Khánh',
      phone: '+84901234567',
      phoneSecondary: '0912345678',
      stores: [],
      requirePhone: false,
    })

    expect(result).toEqual({
      fieldErrors: {},
      normalizedPhone: '0901234567',
      normalizedPhoneSecondary: '0912345678',
    })
  })
})

describe('getCreateFinalCoordinates', () => {
  it('ưu tiên tọa độ map do người dùng chỉnh', () => {
    expect(getCreateFinalCoordinates({
      userHasEditedMap: true,
      pickedLat: 21.1,
      pickedLng: 105.9,
      initialGPSLat: 21.0,
      initialGPSLng: 105.8,
    })).toEqual({ latitude: 21.1, longitude: 105.9 })
  })

  it('fallback về GPS ban đầu khi chưa sửa map', () => {
    expect(getCreateFinalCoordinates({
      userHasEditedMap: false,
      pickedLat: 21.1,
      pickedLng: 105.9,
      initialGPSLat: 21.0,
      initialGPSLng: 105.8,
    })).toEqual({ latitude: 21.0, longitude: 105.8 })
  })

  it('trả về null/null khi chưa có tọa độ nào', () => {
    expect(getCreateFinalCoordinates({
      userHasEditedMap: false,
      pickedLat: null,
      pickedLng: null,
      initialGPSLat: null,
      initialGPSLng: null,
    })).toEqual({ latitude: null, longitude: null })
  })
})

describe('buildCreateInsertPayload', () => {
  it('build payload create theo rule hiện tại', () => {
    expect(buildCreateInsertPayload({
      values: {
        name: 'tạp hóa minh anh',
        storeType: 'Tạp hóa',
        addressDetail: 'xóm chợ',
        ward: 'an khánh',
        district: 'hoài đức',
        note: 'Gần cổng chợ',
      },
      validatedPhone: '0901234567',
      validatedPhoneSecondary: '',
      latitude: 21.01,
      longitude: 105.81,
      isAdmin: false,
      isTelesale: true,
    })).toEqual({
      name: 'Tạp Hóa Minh Anh',
      store_type: 'Tạp hóa',
      address_detail: 'Xóm Chợ',
      ward: 'An Khánh',
      district: 'Hoài Đức',
      active: false,
      is_potential: true,
      note: 'Gần cổng chợ',
      phone: '0901234567',
      phone_secondary: null,
      latitude: 21.01,
      longitude: 105.81,
    })
  })
})

describe('buildCreatePrefillFromRouteQuery', () => {
  it('nhận name + step=2 để mở thẳng bước 2', () => {
    expect(buildCreatePrefillFromRouteQuery({
      name: '  Minh Anh  ',
      step: '2',
    })).toEqual({
      name: 'Minh Anh',
      shouldStartAtStep2: true,
    })
  })

  it('không mở bước 2 nếu thiếu name hoặc step khác 2', () => {
    expect(buildCreatePrefillFromRouteQuery({ name: 'Minh Anh' })).toEqual({
      name: 'Minh Anh',
      shouldStartAtStep2: false,
    })
    expect(buildCreatePrefillFromRouteQuery({ step: '2' })).toEqual({
      name: '',
      shouldStartAtStep2: false,
    })
  })

  it('hỗ trợ query array từ Next router', () => {
    expect(buildCreatePrefillFromRouteQuery({
      name: ['Minh Anh', 'Bỏ Qua'],
      step: ['2'],
    })).toEqual({
      name: 'Minh Anh',
      shouldStartAtStep2: true,
    })
  })
})


