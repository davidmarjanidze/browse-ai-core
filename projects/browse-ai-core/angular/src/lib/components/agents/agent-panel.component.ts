import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { AgentRunnerService } from '../../tools/agent/agent-runner.service'
import { ButtonComponent } from '../../ui/button/button.component'

/** Most recent steps shown while Agent Mode runs. */
const VISIBLE_STEPS = 8

/** Agent Mode's live step list and the Allow / Deny prompt. */
@Component({
  selector: 'bac-agent-panel',
  imports: [ButtonComponent],
  templateUrl: './agent-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class AgentPanelComponent {
  readonly agent = inject(AgentRunnerService)
  readonly t = inject(ChatSessionStore).strings
  readonly recentSteps = computed(() =>
    this.agent.steps().slice(-VISIBLE_STEPS)
  )
  readonly statusLabel = computed(() => {
    const strings = this.t()
    return {
      ok: strings.agentResultOk,
      error: strings.agentResultError,
      denied: strings.agentResultDenied
    }
  })
}
