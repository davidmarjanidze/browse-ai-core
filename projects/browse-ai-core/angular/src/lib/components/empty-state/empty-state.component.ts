import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { IconComponent } from '../../ui/icon/icon.component'

/** Shown before the first message. Replace it with the `empty-state` slot. */
@Component({
  selector: 'bac-empty-state',
  imports: [IconComponent],
  templateUrl: './empty-state.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex h-full flex-col items-center justify-center gap-3 p-6 text-center'
  }
})
export class EmptyStateComponent {
  readonly session = inject(ChatSessionStore)
}
