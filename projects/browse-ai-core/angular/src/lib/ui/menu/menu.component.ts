import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild
} from '@angular/core'
import { IconComponent } from '../icon/icon.component'
import { IconName } from '../icon/icons'
import { OpenDirection, resolveDirection } from './popover-position'

export interface MenuItem<T = string> {
  label: string
  value: T
  icon?: IconName
}

/**
 * A dropdown menu. Put the trigger inside with the `menuTrigger` attribute.
 */
@Component({
  selector: 'bac-menu',
  imports: [IconComponent],
  templateUrl: './menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-flex',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'onEscape($event)'
  }
})
export class MenuComponent<T = string> {
  readonly items = input.required<MenuItem<T>[]>()
  readonly openDirection = input<OpenDirection>('auto')
  readonly align = input<'start' | 'end'>('end')
  readonly label = input('')

  readonly itemSelected = output<T>()

  readonly isOpen = signal(false)
  readonly direction = signal<'up' | 'down'>('down')

  protected readonly host = viewChild.required<ElementRef<HTMLElement>>('root')
  protected readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger')

  toggle(): void {
    if (this.isOpen()) {
      this.close()
      return
    }
    this.direction.set(
      resolveDirection(
        this.openDirection(),
        this.trigger()?.nativeElement,
        this.items().length * 40 + 8
      )
    )
    this.isOpen.set(true)
    queueMicrotask(() =>
      this.host()
        .nativeElement.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus()
    )
  }

  close(): void {
    this.isOpen.set(false)
  }

  onEscape(event: Event): void {
    if (!this.isOpen()) return
    event.preventDefault()
    this.close()
  }

  select(value: T): void {
    this.itemSelected.emit(value)
    this.close()
  }

  onItemKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(
      this.host().nativeElement.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]'
      )
    )
    const index = items.indexOf(event.target as HTMLButtonElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    items[(index + step + items.length) % items.length]?.focus()
  }

  onDocumentClick(event: MouseEvent): void {
    if (
      this.isOpen() &&
      !event.composedPath().includes(this.host().nativeElement)
    ) {
      this.close()
    }
  }
}
