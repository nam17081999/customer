import { describe, expect, it } from 'vitest'
import { buildReportStatusChangedDetail } from '@/helper/storeReportEvents'

describe('store report events', () => {
  it('mô tả report vừa đổi trạng thái để navbar refresh badge báo cáo', () => {
    expect(buildReportStatusChangedDetail({ reportId: 'r1', status: 'approved' })).toEqual({
      type: 'report-status-changed',
      reportId: 'r1',
      status: 'approved',
    })
  })
})
