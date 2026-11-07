import { ChangeDetectionStrategy, Component } from '@angular/core'

@Component({
  selector: 'bac-sparkles-icon',
  templateUrl: './sparkles-icon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', 'aria-hidden': 'true' }
})
export class SparklesIconComponent {}
