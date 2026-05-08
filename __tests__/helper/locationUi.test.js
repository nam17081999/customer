import { describe, expect, it } from 'vitest'

import {
  getLocationBlockedMessage,
  getLocationLoadingMessage,
  getLocationMapsLinkSuccessMessage,
  getLocationNoCoordinatesMessage,
  getLocationPlaceholderCopy,
  getLocationReadyMessage,
  getLocationRefreshSuccessMessage,
} from '@/helper/locationUi'

describe('locationUi copy', () => {
  it('trả về loading message thống nhất', () => {
    expect(getLocationLoadingMessage()).toBe('Đang xác định vị trí của bạn...')
  })

  it('trả về blocked message thống nhất', () => {
    expect(getLocationBlockedMessage()).toBe('Không lấy được vị trí GPS. Hãy bấm Lấy lại vị trí hoặc dán link Google Maps bên dưới.')
  })

  it('trả về ready message thống nhất', () => {
    expect(getLocationReadyMessage()).toBe('Đã xác định vị trí. Nếu chưa đúng, bấm Mở khóa trên bản đồ để điều chỉnh.')
  })

  it('trả về no-coordinates guidance thống nhất', () => {
    expect(getLocationNoCoordinatesMessage()).toBe('Chưa có vị trí. Hãy bấm Lấy lại vị trí, mở khóa bản đồ, hoặc dán link Google Maps để tiếp tục.')
  })

  it('trả về placeholder copy theo phase', () => {
    expect(getLocationPlaceholderCopy('bootstrapping')).toEqual({
      title: 'Đang xác định vị trí hiện tại…',
      description: 'Bản đồ sẽ hiện ngay khi lấy được tọa độ GPS thực tế.',
    })
    expect(getLocationPlaceholderCopy('awaiting_input')).toEqual({
      title: 'Chưa có vị trí để hiển thị trên bản đồ',
      description: 'Hãy bấm Lấy lại vị trí hoặc dán link Google Maps để tiếp tục.',
    })
  })

  it('trả về success message thống nhất cho refresh GPS', () => {
    expect(getLocationRefreshSuccessMessage()).toBe('Đã cập nhật vị trí GPS mới')
  })

  it('trả về success message thống nhất cho maps-link', () => {
    expect(getLocationMapsLinkSuccessMessage(21.028511, 105.804817)).toBe('Đã lấy vị trí: 21.02851, 105.80482')
  })
})
