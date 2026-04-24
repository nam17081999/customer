const STORE_MARKER_IMAGE_CACHE = new Map()

export function getBaseMarkerImageId(storeId, routeOrder = '') {
  return routeOrder ? `smr-${storeId}-${routeOrder}` : `sm-${storeId}`
}

export function getHighlightedMarkerImageId(storeId, routeOrder = '') {
  return routeOrder ? `smrh-${storeId}-${routeOrder}` : `smh-${storeId}`
}

function createStoreMarker(text, fontSize = 13, maxWidthEm = 9, highlighted = false, routeOrder = '') {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 2
  const iconSize = Math.round(38 * dpr)
  const iconPad = Math.round(2 * dpr)
  const hlPad = highlighted ? Math.round(5 * dpr) : 0
  const gap = Math.round(1 * dpr)

  const scaledFont = Math.round(fontSize * dpr)
  const maxPxWidth = Math.round(maxWidthEm * fontSize * dpr)
  const paddingX = Math.round(7 * dpr)
  const paddingY = Math.round(3 * dpr)
  const lineHeight = Math.round(scaledFont * 1.3)
  const radius = Math.round(5 * dpr)

  const measure = document.createElement('canvas').getContext('2d')
  measure.font = `bold ${scaledFont}px "Open Sans", system-ui, sans-serif`
  const words = text.split(/\s+/)
  const lines = []
  let currentLine = ''

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (measure.measureText(nextLine).width > maxPxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = nextLine
    }
  }
  if (currentLine) lines.push(currentLine)

  const textWidth = Math.max(...lines.map((line) => Math.ceil(measure.measureText(line).width)))
  const labelWidth = textWidth + paddingX * 2
  const labelHeight = lines.length * lineHeight + paddingY * 2

  const totalWidth = Math.max(iconSize + iconPad * 2 + hlPad * 2, labelWidth)
  const iconBottom = iconSize + hlPad * 2
  const totalHeight = iconBottom + gap + labelHeight
  const canvas = document.createElement('canvas')
  canvas.width = totalWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')

  const iconCenterX = totalWidth / 2
  const iconCenterY = hlPad + iconPad + iconSize / 2
  const radiusOuter = iconSize / 2 - iconPad

  if (highlighted) {
    ctx.beginPath()
    ctx.arc(iconCenterX, iconCenterY, radiusOuter + hlPad, 0, Math.PI * 2)
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3 * dpr
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(iconCenterX, iconCenterY, radiusOuter, 0, Math.PI * 2)
  ctx.fillStyle = routeOrder ? '#f97316' : '#1f2937'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5 * dpr
  ctx.stroke()

  if (routeOrder) {
    ctx.font = `bold ${Math.round(16 * dpr)}px "Open Sans", system-ui, sans-serif`
    ctx.fillStyle = '#fff7ed'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(routeOrder), iconCenterX, iconCenterY + dpr * 0.25)
  } else {
    const shapeSize = radiusOuter * 0.52
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 0.8 * dpr
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(iconCenterX, iconCenterY - shapeSize * 0.9)
    ctx.lineTo(iconCenterX - shapeSize, iconCenterY - shapeSize * 0.05)
    ctx.lineTo(iconCenterX + shapeSize, iconCenterY - shapeSize * 0.05)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(iconCenterX - shapeSize * 0.72, iconCenterY - shapeSize * 0.05, shapeSize * 1.44, shapeSize * 1.0)
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(iconCenterX - shapeSize * 0.2, iconCenterY + shapeSize * 0.3, shapeSize * 0.4, shapeSize * 0.65)
  }

  const labelX = (totalWidth - labelWidth) / 2
  const labelY = iconBottom + gap
  ctx.beginPath()
  ctx.roundRect(labelX, labelY, labelWidth, labelHeight, radius)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'
  ctx.lineWidth = dpr
  ctx.stroke()

  ctx.font = `bold ${scaledFont}px "Open Sans", system-ui, sans-serif`
  ctx.fillStyle = '#f1f5f9'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let index = 0; index < lines.length; index += 1) {
    ctx.fillText(lines[index], totalWidth / 2, labelY + paddingY + index * lineHeight)
  }

  return {
    width: totalWidth,
    height: totalHeight,
    data: ctx.getImageData(0, 0, totalWidth, totalHeight).data,
    dpr,
  }
}

function getStoreMarkerCacheKey(text, fontSize, maxWidthEm, highlighted, routeOrder) {
  return [text, fontSize, maxWidthEm, highlighted ? '1' : '0', routeOrder || ''].join('::')
}

function getOrCreateStoreMarkerImage(text, fontSize = 13, maxWidthEm = 9, highlighted = false, routeOrder = '') {
  const cacheKey = getStoreMarkerCacheKey(text, fontSize, maxWidthEm, highlighted, routeOrder)
  const cached = STORE_MARKER_IMAGE_CACHE.get(cacheKey)
  if (cached) return cached

  const nextImage = createStoreMarker(text, fontSize, maxWidthEm, highlighted, routeOrder)
  STORE_MARKER_IMAGE_CACHE.set(cacheKey, nextImage)
  return nextImage
}

export function ensureStoreMarkerImage(map, {
  storeId,
  text,
  routeOrder = '',
  highlighted = false,
}) {
  const imageId = highlighted
    ? getHighlightedMarkerImageId(storeId, routeOrder)
    : getBaseMarkerImageId(storeId, routeOrder)

  if (map.hasImage(imageId)) return imageId

  const image = getOrCreateStoreMarkerImage(text, 13, 9, highlighted, routeOrder)
  map.addImage(imageId, {
    width: image.width,
    height: image.height,
    data: image.data,
  }, {
    pixelRatio: image.dpr,
  })

  return imageId
}

export function removeMarkerImages(map, imageIds) {
  for (const imageId of imageIds) {
    if (map.hasImage(imageId)) {
      map.removeImage(imageId)
    }
  }
}

export function createUserHeadingFanImage() {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 2
  const size = Math.max(1, Math.round(132 * dpr))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const center = size / 2
  const innerRadius = 7 * dpr
  const outerRadius = 58 * dpr
  const outerSpread = (32 * Math.PI) / 180
  const innerSpread = (16 * Math.PI) / 180
  const startOuter = -Math.PI / 2 - outerSpread
  const endOuter = -Math.PI / 2 + outerSpread
  const startInner = -Math.PI / 2 - innerSpread
  const endInner = -Math.PI / 2 + innerSpread

  ctx.beginPath()
  ctx.moveTo(center, center)
  ctx.arc(center, center, outerRadius, startOuter, endOuter)
  ctx.closePath()
  ctx.fillStyle = 'rgba(59, 130, 246, 0.42)'
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(center, center)
  ctx.arc(center, center, outerRadius, startOuter, endOuter)
  ctx.closePath()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)'
  ctx.lineWidth = 2.2 * dpr
  ctx.stroke()


  ctx.beginPath()
  ctx.arc(center, center, innerRadius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(37, 99, 235, 0.18)'
  ctx.fill()

  return {
    width: canvas.width,
    height: canvas.height,
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    dpr,
  }
}
