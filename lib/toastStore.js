import { create } from 'zustand'

let nextId = 1

const DEFAULT_DURATION = 3000

export const useToastStore = create((set) => ({
  toasts: [],

  addToast({ message, type = 'success', duration = DEFAULT_DURATION }) {
    const id = nextId++
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }))
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
    return id
  },

  dismissToast(id) {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearToasts() {
    set({ toasts: [] })
  },
}))

export function showToast(message, type = 'success', duration = DEFAULT_DURATION) {
  return useToastStore.getState().addToast({ message, type, duration })
}
