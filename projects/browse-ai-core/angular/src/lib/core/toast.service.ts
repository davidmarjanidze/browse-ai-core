import { DestroyRef, Injectable, inject, signal } from '@angular/core'

export type ToastVariant = 'default' | 'success' | 'error'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

/** Short messages shown at the bottom of the chat panel. */
@Injectable()
export class ToastService {
  readonly toasts = signal<Toast[]>([])
  readonly #timers = new Set<ReturnType<typeof setTimeout>>()
  #nextId = 0

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#timers.forEach((timer) => clearTimeout(timer))
      this.#timers.clear()
    })
  }

  show(
    message: string,
    variant: ToastVariant = 'default',
    duration = 2500
  ): void {
    const toast: Toast = { id: ++this.#nextId, message, variant }
    this.toasts.update((toasts) => [...toasts.slice(-2), toast])

    const timer = setTimeout(() => {
      this.#timers.delete(timer)
      this.dismiss(toast.id)
    }, duration)
    this.#timers.add(timer)
  }

  success(message: string): void {
    this.show(message, 'success')
  }

  error(message: string): void {
    this.show(message, 'error', 4000)
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id))
  }
}
