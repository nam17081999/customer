import { describe, expect, it } from 'vitest'

import {
  buildStoreReportPayload,
  buildStoreReportProposedChanges,
  getStoreReportSuccessMessage,
  normalizeStoreReportCoordinate,
  summarizeStoreReport,
  validateStoreReportSubmission,
} from '@/helper/storeReportFlow'

describe('normalizeStoreReportCoordinate', () => {
  it('chuẩn hóa tọa độ về 7 chữ số thập phân', () => {
    expect(normalizeStoreReportCoordinate('21.02861049')).toBe(21.0286105)
  })

  it('trả về null nếu tọa độ không hợp lệ', () => {
    expect(normalizeStoreReportCoordinate('abc')).toBeNull()
    expect(normalizeStoreReportCoordinate(null)).toBeNull()
  })
})

describe('buildStoreReportProposedChanges', () => {
  it('chỉ tạo patch cho trường thực sự thay đổi', () => {
    const store = {
      name: 'Tạp hóa cũ',
      store_type: 'Tạp hóa',
      address_detail: 'xóm chợ cũ',
      ward: 'an khánh',
      district: 'hoài đức',
      phone: '0901234567',
      note: 'Gần cổng chợ',
      latitude: null,
      longitude: null,
    }

    expect(buildStoreReportProposedChanges({
      store,
      values: {
        name: 'tạp hóa minh anh',
        storeType: 'Tạp hóa',
        addressDetail: 'xóm chợ mới',
        ward: 'an khánh',
        district: 'hoài đức',
        phone: '0901234568',
        note: 'Mở từ 5 giờ sáng',
        latitude: 21.03333,
        longitude: 105.81111,
      },
      normalizedPhoneOverride: '0901234568',
    })).toEqual({
      name: 'Tạp Hóa Minh Anh',
      address_detail: 'Xóm Chợ Mới',
      phone: '0901234568',
      note: 'Mở từ 5 giờ sáng',
      latitude: 21.03333,
      longitude: 105.81111,
    })
  })

  it('không tự tạo thay đổi nếu người dùng giữ nguyên dữ liệu đang thấy', () => {
    const store = {
      name: 'Tạp hóa Báo Cáo',
      store_type: 'Tạp hóa',
      address_detail: 'Xóm Chợ Cũ',
      ward: 'An Khánh',
      district: 'Hoài Đức',
      phone: '0901234567',
      note: 'Gần cổng chợ',
      latitude: 21.02861,
      longitude: 105.80492,
    }

    expect(buildStoreReportProposedChanges({
      store,
      values: {
        name: 'Tạp hóa Báo Cáo',
        storeType: 'Tạp hóa',
        addressDetail: 'Xóm Chợ Cũ',
        ward: 'An Khánh',
        district: 'Hoài Đức',
        phone: '0901234567',
        note: 'Gần cổng chợ',
        latitude: 21.02861,
        longitude: 105.80492,
      },
      normalizedPhoneOverride: '0901234567',
    })).toEqual({})
  })
})

describe('validateStoreReportSubmission', () => {
  it('chặn reason report nếu chưa chọn lý do', () => {
    expect(validateStoreReportSubmission({
      mode: 'reason',
      reasons: [],
    })).toEqual({
      error: 'Vui lòng chọn ít nhất một lý do.',
    })
  })

  it('chặn edit report nếu số điện thoại sai', () => {
    const result = validateStoreReportSubmission({
      mode: 'edit',
      reasons: [],
      store: {
        name: 'Tạp hóa Báo Cáo',
        district: 'Hoài Đức',
        ward: 'An Khánh',
      },
      values: {
        name: 'Tạp hóa Báo Cáo',
        storeType: 'Tạp hóa',
        addressDetail: 'Xóm Chợ Cũ',
        district: 'Hoài Đức',
        ward: 'An Khánh',
        phone: '123',
        note: '',
        latitude: null,
        longitude: null,
      },
    })

    expect(result.error).toContain('0, 84 hoặc +84')
  })

  it('chặn edit report nếu không có thay đổi nào', () => {
    expect(validateStoreReportSubmission({
      mode: 'edit',
      reasons: [],
      store: {
        name: 'Tạp hóa Báo Cáo',
        store_type: 'Tạp hóa',
        address_detail: 'Xóm Chợ Cũ',
        ward: 'An Khánh',
        district: 'Hoài Đức',
        phone: '0901234567',
        note: 'Gần cổng chợ',
        latitude: 21.02861,
        longitude: 105.80492,
      },
      values: {
        name: 'Tạp hóa Báo Cáo',
        storeType: 'Tạp hóa',
        addressDetail: 'Xóm Chợ Cũ',
        ward: 'An Khánh',
        district: 'Hoài Đức',
        phone: '0901234567',
        note: 'Gần cổng chợ',
        latitude: 21.02861,
        longitude: 105.80492,
      },
    })).toEqual({
      error: 'Bạn chưa thay đổi thông tin nào.',
    })
  })
})

describe('buildStoreReportPayload', () => {
  it('tạo đúng payload cho reason_only', () => {
    expect(buildStoreReportPayload({
      storeId: 'store-1',
      mode: 'reason',
      reasons: ['wrong_location'],
      proposedChanges: null,
      reporterId: 'user-1',
    })).toEqual({
      store_id: 'store-1',
      report_type: 'reason_only',
      reason_codes: ['wrong_location'],
      proposed_changes: null,
      reporter_id: 'user-1',
    })
  })
})

describe('summarizeStoreReport', () => {
  it('đếm thay đổi vị trí thành 1 mục', () => {
    expect(summarizeStoreReport({
      proposed_changes: {
        name: 'Tạp hóa mới',
        latitude: 21.1,
        longitude: 105.9,
      },
    })).toEqual({
      proposed: {
        name: 'Tạp hóa mới',
        latitude: 21.1,
        longitude: 105.9,
      },
      hasLocation: true,
      fieldCount: 2,
    })
  })
})

describe('getStoreReportSuccessMessage', () => {
  it('trả về message thành công thống nhất', () => {
    expect(getStoreReportSuccessMessage()).toBe('Đã gửi báo cáo. Admin sẽ xem xét và cập nhật.')
  })
})
