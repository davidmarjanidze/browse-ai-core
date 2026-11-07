import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ConfigStore } from '../../core/config.store'
import { PanelStore } from '../../core/panel.store'

/** The round button that opens the chat. */
@Component({
  selector: 'bac-launcher',
  templateUrl: './launcher.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class LauncherComponent {
  readonly panel = inject(PanelStore)
  readonly t = inject(ConfigStore).strings
}
