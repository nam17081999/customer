import { afterEach, describe, expect, it, vi } from 'vitest'

import { createUserHeadingFanImage } from '@/helper/mapMarkerImages'

function createMockCanvas() {
  const canvas = {
    _width: 0,
    _height: 0,
    get width() {
      return this._width
    },
    set width(value) {
      this._width = Math.max(0, Math.floor(Number(value) || 0))
    },
    get height() {
      return this._height
    },
    set height(value) {
      this._height = Math.max(0, Math.floor(Number(value) || 0))
    },
  }

  const ctx = {
    beginPath() {},
    moveTo() {},
    arc() {},
    closePath() {},
    fill() {},
    stroke() {},
    getImageData(x, y, width, height) {
      return {
        data: new Uint8ClampedArray(Math.max(0, Math.floor(width)) * Math.max(0, Math.floor(height)) * 4),
      }
    },
  }

  canvas.getContext = vi.fn(() => ctx)
  return canvas
}

describe('mapMarkerImages helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('createUserHeadingFanImage trả width/height nguyên khớp với buffer ảnh khi DPR là số lẻ', () => {
    vi.stubGlobal('window', { devicePixelRatio: 0.9 })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => createMockCanvas()),
    })

    const image = createUserHeadingFanImage()

    expect(Number.isInteger(image.width)).toBe(true)
    expect(Number.isInteger(image.height)).toBe(true)
    expect(image.data).toHaveLength(image.width * image.height * 4)
    expect(image.dpr).toBe(0.9)
  })
})
