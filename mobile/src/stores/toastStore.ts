import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

interface ToastState {
  visible: boolean
  message: string
  type: ToastType
  duration: number
  toastId: number // Version tracking to prevent race conditions
}

interface ToastActions {
  showToast: (message: string, type: ToastType, duration?: number) => void
  hideToast: () => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  reset: () => void
}

export type ToastStore = ToastState & ToastActions

const DEFAULT_DURATION = 3000

const initialState: ToastState = {
  visible: false,
  message: '',
  type: 'info',
  duration: DEFAULT_DURATION,
  toastId: 0,
}

export const useToastStore = create<ToastStore>((set) => ({
  ...initialState,

  showToast: (message, type, duration = DEFAULT_DURATION) => {
    set((state) => ({ visible: true, message, type, duration, toastId: state.toastId + 1 }))
  },

  hideToast: () => {
    set({ visible: false })
  },

  success: (message, duration) => {
    set((state) => ({
      visible: true,
      message,
      type: 'success',
      duration: duration ?? DEFAULT_DURATION,
      toastId: state.toastId + 1,
    }))
  },

  error: (message, duration) => {
    set((state) => ({
      visible: true,
      message,
      type: 'error',
      duration: duration ?? DEFAULT_DURATION,
      toastId: state.toastId + 1,
    }))
  },

  info: (message, duration) => {
    set((state) => ({
      visible: true,
      message,
      type: 'info',
      duration: duration ?? DEFAULT_DURATION,
      toastId: state.toastId + 1,
    }))
  },

  reset: () => {
    set({ ...initialState })
  },
}))
