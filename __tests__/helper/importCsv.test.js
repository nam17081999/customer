import { describe, expect, it } from 'vitest'
import { parseCsvContent, validateProductImportRows } from '@/helper/importCsv'

describe('import csv helpers', () => {
  it('parses CSV with BOM, quoted comma and row numbers', () => {
    expect(parseCsvContent('\uFEFFname,sku\n"Nước, suối",LV01')).toEqual({
      headers: ['name', 'sku'],
      rows: [{ __rowNumber: 2, name: 'Nước, suối', sku: 'LV01' }],
    })
  })

  it('validates product import rows with duplicate SKU and bad price', () => {
    const result = validateProductImportRows([
      { __rowNumber: 2, name: 'A', sku: 'SKU1', unit: 'chai', sale_price: '1000' },
      { __rowNumber: 3, name: '', sku: 'sku1', unit: '', sale_price: '-1' },
    ])

    expect(result[0]).toMatchObject({ errors: [] })
    expect(result[1].errors).toEqual(['Thiếu tên hàng', 'Thiếu đơn vị gốc', 'Giá bán không hợp lệ', 'Trùng SKU trong file'])
  })
})
