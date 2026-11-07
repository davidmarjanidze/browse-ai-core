import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/** The green "How to use" box with numbered steps, as shown for tools. */
@Component({
  selector: 'bac-help-box',
  templateUrl: './help-box.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class HelpBoxComponent {
  readonly heading = input.required<string>()
  readonly notes = input.required<string[]>()
}
