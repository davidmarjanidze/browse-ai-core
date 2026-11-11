import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { FormatPipe } from '../../core/format.pipe'
import { WatchRunnerService } from '../../tools/watch/watch-runner.service'
import { ButtonComponent } from '../../ui/button/button.component'

/** Watch Mode: element picker before start, status and Stop while watching. */
@Component({
  selector: 'bac-watch-panel',
  imports: [ButtonComponent, FormatPipe],
  templateUrl: './watch-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class WatchPanelComponent {
  readonly session = inject(ChatSessionStore)
  readonly watch = inject(WatchRunnerService)
  readonly t = this.session.strings
}
