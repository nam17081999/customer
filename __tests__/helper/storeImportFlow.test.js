import { describe, expect, it, vi } from 'vitest'

vi.mock('@/helper/duplicateCheck', () => {
  function normalizeNameForMatch(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  function extractWords(value) {
    return normalizeNameForMatch(value)
      .split(/[^a-z0-9]+/g)
      .filter(Boolean)
  }

  function containsAllInputWords(inputWords, storeName) {
    const normalizedStoreName = normalizeNameForMatch(storeName)
    return inputWords.every((word) => normalizedStoreName.includes(word))
  }

  function isSimilarNameByWords(inputWords, storeName) {
    return containsAllInputWords(inputWords, storeName)
  }

  function mergeDuplicateCandidates(nearMatches, globalMatches) {
    const seen = new Set()
    return [...nearMatches, ...globalMatches].filter((item) => {
      const key = String(item?.id ?? '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  return {
    containsAllInputWords,
    extractWords,
    isSimilarNameByWords,
    mergeDuplicateCandidates,
    normalizeNameForMatch,
  }
})

import {
  buildHeaderMap,
  buildImportPreviewRowsFromCsv,
  buildResolutionPatch,
  finalizePreviewRow,
  parseCsv,
} from '@/helper/storeImportFlow'

describe('parseCsv', () => {
  it('parse được ô có dấu phẩy trong quote và giữ đúng số cột', () => {
    expect(parseCsv([
      'Tên cửa hàng,Ghi chú',
      '"Tạp hóa Minh Anh","Gần chợ, cạnh cổng trường"',
    ].join('\n'))).toEqual([
      ['Tên cửa hàng', 'Ghi chú'],
      ['Tạp hóa Minh Anh', 'Gần chợ, cạnh cổng trường'],
    ])
  })
})

describe('buildHeaderMap', () => {
  it('nhận diện alias header tiếng Việt không dấu và báo thiếu cột bắt buộc', () => {
    expect(buildHeaderMap([
      'Ten cua hang',
      'Xa / Phuong',
      'So dien thoai',
    ])).toEqual({
      headerMap: {
        name: 0,
        ward: 1,
        phone: 2,
      },
      missingFields: ['district'],
    })
  })
})

describe('buildImportPreviewRowsFromCsv', () => {
  it('trả lỗi khi file thiếu cột bắt buộc', () => {
    expect(buildImportPreviewRowsFromCsv({
      csvText: [
        'Tên cửa hàng,Xã / Phường',
        'Tạp hóa Minh Anh,An Khánh',
      ].join('\n'),
      existingStores: [],
    })).toEqual({
      previewRows: [],
      error: 'Thiếu cột bắt buộc trong file mẫu: Quận / Huyện',
    })
  })

  it('đánh dấu duplicate khi nghi trùng hệ thống nhưng chưa chọn hướng xử lý', () => {
    const result = buildImportPreviewRowsFromCsv({
      csvText: [
        'Tên cửa hàng,Loại cửa hàng,Địa chỉ chi tiết,Xã / Phường,Quận / Huyện,Số điện thoại,Ghi chú,Vĩ độ,Kinh độ',
        'Tạp hóa Minh Anh,Tạp hóa,Xóm Chợ Mới,An Khánh,Hoài Đức,0902222222,Gần cổng trường,21.031,105.802',
      ].join('\n'),
      existingStores: [
        {
          id: 'dup-1',
          name: 'Tạp hóa Minh Anh',
          store_type: 'tap_hoa',
          address_detail: 'Xóm Chợ Cũ',
          ward: 'An Khánh',
          district: 'Hoài Đức',
          phone: '0901111111',
          note: 'Gần cổng chợ',
          latitude: 21.0309,
          longitude: 105.8019,
          hasCoordinates: true,
        },
      ],
    })

    expect(result.error).toBe('')
    expect(result.previewRows).toHaveLength(1)
    expect(result.previewRows[0].status).toBe('duplicate')
    expect(result.previewRows[0].duplicateMatches).toHaveLength(1)
    expect(result.previewRows[0].issues).toContain('Có 1 cửa hàng có thể trùng trong hệ thống')
  })
})

describe('finalizePreviewRow', () => {
  it('chuyển row về ready khi duplicate hệ thống đã được chọn store và mode keep-existing', () => {
    const draft = {
      rowNumber: 2,
      name: 'Tạp hóa Minh Anh',
      errors: [],
      duplicateMatches: [{ id: 'dup-1', name: 'Tạp hóa Minh Anh' }],
      phoneDuplicateMatches: [],
      duplicateInFileRows: [],
      phoneDuplicateInFileRows: [],
    }

    const row = finalizePreviewRow(draft, [], [], 'keep-existing', 'dup-1', true)
    expect(row.status).toBe('ready')
    expect(row.issues).not.toContain('Có 1 cửa hàng có thể trùng trong hệ thống')
  })
})

describe('buildResolutionPatch', () => {
  it('ưu tiên dữ liệu import khi chọn prefer-import', () => {
    expect(buildResolutionPatch({
      id: 'store-1',
      store_type: 'tap_hoa',
      address_detail: 'Xóm Chợ Cũ',
      ward: 'An Khánh',
      district: 'Hoài Đức',
      phone: '0901111111',
      note: 'Gần cổng chợ',
      latitude: null,
      longitude: null,
    }, {
      storeTypeValue: 'quan_an',
      addressDetail: 'Xóm Chợ Mới',
      ward: 'An Khánh',
      district: 'Hoài Đức',
      phone: '0902222222',
      note: 'Gần cổng trường',
      hasCoordinates: true,
      latitude: 21.03123,
      longitude: 105.80234,
    }, 'prefer-import')).toEqual({
      store_type: 'quan_an',
      address_detail: 'Xóm Chợ Mới',
      phone: '0902222222',
      note: 'Gần cổng trường',
      latitude: 21.03123,
      longitude: 105.80234,
    })
  })

  it('giữ dữ liệu cũ và chỉ bù field thiếu khi chọn keep-existing', () => {
    expect(buildResolutionPatch({
      id: 'store-1',
      store_type: 'tap_hoa',
      address_detail: '',
      ward: 'An Khánh',
      district: 'Hoài Đức',
      phone: '0901111111',
      note: '',
      latitude: null,
      longitude: null,
    }, {
      storeTypeValue: 'quan_an',
      addressDetail: 'Xóm Chợ Mới',
      ward: 'An Khánh',
      district: 'Hoài Đức',
      phone: '0902222222',
      note: 'Gần cổng trường',
      hasCoordinates: true,
      latitude: 21.03123,
      longitude: 105.80234,
    }, 'keep-existing')).toEqual({
      address_detail: 'Xóm Chợ Mới',
      note: 'Gần cổng trường',
      latitude: 21.03123,
      longitude: 105.80234,
    })
  })
})
