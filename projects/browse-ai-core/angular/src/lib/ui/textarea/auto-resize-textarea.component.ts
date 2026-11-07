import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  model,
  output,
  viewChild
} from '@angular/core'

/** A textarea that grows with its text up to `maxRows`. Enter submits. */
@Component({
  selector: 'bac-auto-resize-textarea',
  templateUrl: './auto-resize-textarea.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex' }
})
export class AutoResizeTextareaComponent {
  readonly value = model.required<string>()
  readonly maxRows = input(4)
  readonly placeholder = input('')
  readonly ariaLabel = input('')
  readonly disabled = input(false)

  readonly focused = output<void>()
  readonly submitted = output<KeyboardEvent>()

  protected readonly textarea =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea')

  constructor() {
    afterRenderEffect(() => {
      this.value()
      this.#resize()
    })
  }

  onInput(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value)
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      this.submitted.emit(event)
    }
  }

  focus(): void {
    this.textarea().nativeElement.focus()
  }

  #resize(): void {
    const element = this.textarea().nativeElement
    const style = getComputedStyle(element)
    const lineHeight = Number.parseFloat(style.lineHeight) || 20
    const padding =
      (Number.parseFloat(style.paddingTop) || 0) +
      (Number.parseFloat(style.paddingBottom) || 0)
    const maxHeight = lineHeight * this.maxRows() + padding

    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`
    element.style.overflowY =
      element.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }
}
