import { formatString } from 'browse-ai-core'
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild
} from '@angular/core'
import { AiService } from '../../ai/ai.service'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { copyText } from '../../core/clipboard'
import { ConfigStore } from '../../core/config.store'
import { MarkdownPipe } from '../../core/markdown.pipe'
import { ToastService } from '../../core/toast.service'
import { IconComponent } from '../../ui/icon/icon.component'
import { FormatPipe } from '../../core/format.pipe'
import { ModelDownloadComponent } from '../model-download/model-download.component'

@Component({
  selector: 'bac-message-list',
  imports: [IconComponent, MarkdownPipe, ModelDownloadComponent, FormatPipe],
  templateUrl: './message-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bac-thinking-surface bac-thinking-top flex min-h-0 flex-1 flex-col',
    '[class.is-thinking]': 'ai.isThinking()'
  }
})
export class MessageListComponent {
  readonly ai = inject(AiService)
  readonly session = inject(ChatSessionStore)
  readonly #toast = inject(ToastService)
  readonly #configStore = inject(ConfigStore)
  readonly t = this.#configStore.strings
  readonly features = this.#configStore.features
  readonly downloadNote = computed(() => {
    const size = this.ai.downloadSize()
    return size
      ? formatString(this.t().downloadSize, {
          model: this.ai.providerName(),
          size
        })
      : null
  })

  readonly showSpinner = computed(() => {
    if (this.session.isToolRunning()) return true
    if (!this.ai.isAwaitingFirstChunk()) return false
    return this.session.messages().at(-1)?.sender === 'user'
  })

  protected readonly scroller =
    viewChild.required<ElementRef<HTMLElement>>('scroller')

  constructor() {
    afterRenderEffect(() => {
      const request = this.session.scrollRequest()
      const scroller = this.scroller().nativeElement
      if (!request) return

      if (request.target === 'bottom') {
        scroller.scrollTop = scroller.scrollHeight
        return
      }
      const message = scroller.querySelector<HTMLElement>(
        `[data-message-id="${request.id}"]`
      )
      if (message) {
        scroller.scrollTop +=
          message.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          8
      }
    })
  }

  async copy(content: string): Promise<void> {
    if (await copyText(content)) this.#toast.success(this.t().copied)
  }
}
