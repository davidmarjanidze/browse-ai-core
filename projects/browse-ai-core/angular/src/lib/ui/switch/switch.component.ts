import { ChangeDetectionStrategy, Component, input, model } from '@angular/core'
import { IconComponent } from '../icon/icon.component'

@Component({
  selector: 'bac-switch',
  imports: [IconComponent],
  templateUrl: './switch.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' }
})
export class SwitchComponent {
  readonly checked = model(false)
  readonly ariaLabel = input('')
  readonly disabled = input(false)

  toggle(): void {
    if (!this.disabled()) this.checked.update((checked) => !checked)
  }
}
