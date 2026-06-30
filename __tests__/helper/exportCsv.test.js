import { describe, expect, it } from 'vitest'
import { buildCsvContent, buildReportExportRows, downloadCsvFile } from '@/helper/exportCsv'

describe('export csv helpers', () => {
  it('builds CSV with headers, escaping commas, quotes and new lines', () => {
    expect(buildCsvContent({
      columns: [
        { key: 'name', label: 'Tên' },
        { key: 'note', label: 'Ghi chú' },
      ],
      rows: [{ name: 'Nước, suối', note: 'Có "chai"\n24' }],
    })).toBe('Tên,Ghi chú\n"Nước, suối","Có ""chai""\n24"')
  })

  it('adds stable row numbers for report export rows', () => {
    expect(buildReportExportRows([{ name: 'A' }, { name: 'B' }], (row) => ({ ten: row.name }))).toEqual([
      { stt: 1, ten: 'A' },
      { stt: 2, ten: 'B' },
    ])
  })

  it('does not try to download on server side', () => {
    expect(downloadCsvFile({ content: 'a,b' })).toBe(false)
  })
})
