import { ref } from 'vue'

export type ToastType = 'success' | 'info' | 'error' | 'warning'

export interface Toast {
  id: number
  msg: string
  type: ToastType
}

const toasts = ref<Toast[]>([])
let toastId = 0

export function useToast() {
  const showToast = (msg: string, type: ToastType = 'info') => {
    const id = toastId++
    toasts.value.push({ id, msg, type })
    setTimeout(() => {
      removeToast(id)
    }, 3000)
  }

  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    showToast,
    removeToast
  }
}
