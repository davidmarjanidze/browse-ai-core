import {
  ChangeDetectionStrategy,
  Component,
  input,
  output
} from '@angular/core'
import { IconComponent } from '../icon/icon.component'
import { IconName } from '../icon/icons'

export type ButtonVariant = 'icon' | 'primary' | 'secondary' | 'ghost'

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bac-primary'

export const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  icon: `inline-flex size-8 pointer-coarse:size-11 shrink-0 items-center justify-center rounded-bac border border-bac-border bg-bac-surface text-bac-text transition-colors hover:bg-bac-surface-hover disabled:opacity-50 ${FOCUS}`,
  primary: `inline-flex min-h-9 pointer-coarse:min-h-11 items-center justify-center gap-2 rounded-bac bg-bac-primary px-4 py-2 text-sm font-semibold text-bac-on-primary transition-colors hover:bg-bac-primary-hover disabled:opacity-50 ${FOCUS}`,
  secondary: `inline-flex min-h-9 pointer-coarse:min-h-11 items-center justify-center gap-2 rounded-bac border border-bac-border bg-bac-bg px-3 py-2 text-sm font-semibold text-bac-text transition-colors hover:bg-bac-surface-hover disabled:opacity-50 ${FOCUS}`,
  ghost: `inline-flex min-h-8 min-w-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11 items-center justify-center gap-2 rounded-bac px-2 py-1 text-sm text-bac-text transition-colors hover:bg-bac-surface-hover disabled:opacity-50 ${FOCUS}`
}

@Component({
  selector: 'bac-button',
  imports: [IconComponent],
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex', '[class.w-full]': 'fullWidth()' }
})
export class ButtonComponent {
  readonly label = input<string | null>(null)
  readonly type = input<'button' | 'submit'>('button')
  readonly variant = input<ButtonVariant>('secondary')
  readonly icon = input<IconName | null>(null)
  readonly ariaLabel = input<string | null>(null)
  readonly disabled = input(false)
  readonly fullWidth = input(false)

  readonly buttonClick = output<MouseEvent>()

  readonly classes = BUTTON_CLASSES

  onClick(event: MouseEvent): void {
    if (!this.disabled()) this.buttonClick.emit(event)
  }
}
