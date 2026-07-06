import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore, showToast } from '@/lib/toastStore'

beforeEach(() => {
  useToastStore.getState().clearToasts()
})

describe('useToastStore', () => {
  it('khởi tạo với toasts rỗng', () => {
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('addToast thêm toast vào danh sách', () => {
    useToastStore.getState().addToast({ message: 'Lưu thành công', type: 'success' })
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Lưu thành công')
    expect(toasts[0].type).toBe('success')
  })

  it('addToast sinh id tự động tăng', () => {
    useToastStore.getState().addToast({ message: 'A' })
    useToastStore.getState().addToast({ message: 'B' })
    const ids = useToastStore.getState().toasts.map((t) => t.id)
    expect(ids[1]).toBe(ids[0] + 1)
  })

  it('dismissToast xóa toast theo id', () => {
    const id = useToastStore.getState().addToast({ message: 'Test' })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    useToastStore.getState().dismissToast(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('clearToasts xóa tất cả', () => {
    useToastStore.getState().addToast({ message: 'A' })
    useToastStore.getState().addToast({ message: 'B' })
    useToastStore.getState().clearToasts()
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('addToast type mặc định là success', () => {
    useToastStore.getState().addToast({ message: 'OK' })
    expect(useToastStore.getState().toasts[0].type).toBe('success')
  })
})

describe('showToast', () => {
  it('gọi addToast và trả về id', () => {
    const id = showToast('Có lỗi', 'error', 5000)
    expect(typeof id).toBe('number')
    const toast = useToastStore.getState().toasts.find((t) => t.id === id)
    expect(toast).toBeDefined()
    expect(toast.message).toBe('Có lỗi')
    expect(toast.type).toBe('error')
    expect(toast.duration).toBe(5000)
  })
})
