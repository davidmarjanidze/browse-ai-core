import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output
} from '@angular/core'
import { IconComponent } from '../icon/icon.component'

@Component({
  selector: 'bac-accordion',
  imports: [IconComponent],
  templateUrl: './accordion.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class AccordionComponent {
  readonly title = input.required<string>()
  readonly count = input<number | null>(null)
  readonly deleteLabel = input<string | null>(null)
  readonly expanded = model(false)

  readonly deleted = output<void>()
}
