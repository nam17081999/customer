export function getLocationLoadingMessage() {
  return 'Đang xác định vị trí của bạn...'
}

export function getLocationBlockedMessage() {
  return 'Không lấy được vị trí GPS. Hãy bấm Lấy lại vị trí hoặc dán link Google Maps bên dưới.'
}

export function getLocationReadyMessage() {
  return 'Đã xác định vị trí. Nếu chưa đúng, bấm Mở khóa trên bản đồ để điều chỉnh.'
}

export function getLocationNoCoordinatesMessage() {
  return 'Chưa có vị trí. Hãy bấm Lấy lại vị trí, mở khóa bản đồ, hoặc dán link Google Maps để tiếp tục.'
}

export function getLocationPlaceholderCopy(phase = 'awaiting_input') {
  if (phase === 'bootstrapping') {
    return {
      title: 'Đang xác định vị trí hiện tại…',
      description: 'Bản đồ sẽ hiện ngay khi lấy được tọa độ GPS thực tế.',
    }
  }

  return {
    title: 'Chưa có vị trí để hiển thị trên bản đồ',
    description: 'Hãy bấm Lấy lại vị trí hoặc dán link Google Maps để tiếp tục.',
  }
}

export function getLocationRefreshSuccessMessage() {
  return 'Đã cập nhật vị trí GPS mới'
}

export function getLocationMapsLinkSuccessMessage(lat, lng) {
  return `Đã lấy vị trí: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`
}
