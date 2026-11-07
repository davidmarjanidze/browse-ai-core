import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild
} from '@angular/core'
import { IconComponent } from '../icon/icon.component'
import { OpenDirection, resolveDirection } from '../menu/popover-position'

export interface SelectOption<T> {
  label: string
  value: T
}

@Component({
  selector: 'bac-select',
  imports: [IconComponent],
  templateUrl: './select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'onEscape($event)'
  }
})
export class SelectComponent<T> {
  readonly options = input.required<SelectOption<T>[]>()
  readonly value = model<T | null>(null)
  readonly placeholder = input('')
  readonly ariaLabel = input('')
  readonly disabled = input(false)
  readonly openDirection = input<OpenDirection>('auto')

  readonly isOpen = signal(false)
  readonly direction = signal<'up' | 'down'>('down')
  readonly selectedLabel = computed(
    () =>
      this.options().find((option) => option.value === this.value())?.label ??
      this.placeholder()
  )

  protected readonly root = viewChild.required<ElementRef<HTMLElement>>('root')
  protected readonly trigger =
    viewChild.required<ElementRef<HTMLElement>>('trigger')

  toggle(): void {
    if (this.disabled()) return
    if (this.isOpen()) {
      this.close()
      return
    }
    this.direction.set(
      resolveDirection(
        this.openDirection(),
        this.trigger().nativeElement,
        Math.min(240, this.options().length * 40 + 8)
      )
    )
    this.isOpen.set(true)
  }

  close(): void {
    this.isOpen.set(false)
  }

  onEscape(event: Event): void {
    if (!this.isOpen()) return
    event.preventDefault()
    this.close()
  }

  choose(value: T): void {
    this.value.set(value)
    this.close()
    this.trigger().nativeElement.focus()
  }

  onDocumentClick(event: MouseEvent): void {
    if (
      this.isOpen() &&
      !event.composedPath().includes(this.root().nativeElement)
    ) {
      this.close()
    }
  }
}
