import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core'
import { BAC_HOST_ELEMENT } from '../core/host-element'
import { TextField, describeField, isTextField } from './insert-text'

/**
 * Remembers the text box and the form on the page that had focus last, so
 * tools can use them after the user clicks into the chat.
 */
@Injectable()
export class FieldTrackerService {
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)

  readonly field = signal<TextField | null>(null)
  readonly form = signal<HTMLFormElement | null>(null)
  /** "Pick field" was clicked; the next focused text box is used. */
  readonly isPicking = signal(false)
  readonly fieldLabel = computed(() => {
    const field = this.field()
    return field ? describeField(field) : ''
  })

  constructor() {
    const doc = this.#document
    doc.addEventListener('focusin', this.#onFocus, true)
    doc.addEventListener('keydown', this.#onKey, true)
    inject(DestroyRef).onDestroy(() => {
      doc.removeEventListener('focusin', this.#onFocus, true)
      doc.removeEventListener('keydown', this.#onKey, true)
    })
  }

  /** The tracked field, or null when it was removed from the page. */
  currentField(): TextField | null {
    const field = this.field()
    return field?.isConnected ? field : null
  }

  startPicking(): void {
    this.isPicking.set(true)
  }

  readonly #onFocus = (event: FocusEvent): void => {
    const target = event.composedPath()[0] ?? event.target
    if (!(target instanceof Element)) return
    if (target === this.#host || this.#host.contains(target)) return
    const form = target.closest('form')
    if (form && target.matches('input, select, textarea')) this.form.set(form)
    if (isTextField(target)) {
      this.field.set(target)
      this.isPicking.set(false)
    }
  }

  readonly #onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.isPicking.set(false)
  }
}
