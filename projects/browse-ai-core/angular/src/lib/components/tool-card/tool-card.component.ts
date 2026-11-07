import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal
} from '@angular/core'
import { BrowseAiCoreStrings, formatString } from 'browse-ai-core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { ChatMessage } from '../../chat/chat.model'
import { ExtraToolRunner } from '../../chat/extra-tool-runner'
import { ToolCard } from '../../chat/tool-card.model'
import { copyText } from '../../core/clipboard'
import { PanelStore } from '../../core/panel.store'
import { ToastService } from '../../core/toast.service'
import { PATTERN_STRINGS } from '../../tools/dark-patterns/dark-pattern-detector.service'
import {
  LINK_GROUPS,
  LinkGroup,
  LinkRow
} from '../../tools/link-inspector/link-scanner'
import { LEVEL_STRINGS } from '../../tools/phishing-check/phishing-check.service'
import { ButtonComponent } from '../../ui/button/button.component'
import { ArgumentMapComponent } from './argument-map.component'
import { PerfCardComponent } from './perf-card.component'

const GROUP_STRINGS: Record<LinkGroup, keyof BrowseAiCoreStrings> = {
  internal: 'linkGroupInternal',
  external: 'linkGroupExternal',
  download: 'linkGroupDownload',
  contact: 'linkGroupContact',
  suspicious: 'linkGroupSuspicious'
}

/** Extra content under an answer from the newer tools. */
@Component({
  selector: 'bac-tool-card',
  imports: [ButtonComponent, ArgumentMapComponent, PerfCardComponent],
  templateUrl: './tool-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full max-w-[88%] min-w-0' }
})
export class ToolCardComponent {
  readonly message = input.required<ChatMessage>()
  /** Only the newest performance card updates live. */
  readonly live = input(false)

  readonly session = inject(ChatSessionStore)
  readonly tools = inject(ExtraToolRunner)
  readonly #panel = inject(PanelStore)
  readonly #toast = inject(ToastService)
  readonly t = this.session.strings
  readonly format = formatString
  readonly levelStrings = LEVEL_STRINGS
  readonly patternStrings = PATTERN_STRINGS

  readonly card = computed<ToolCard | null>(() => this.message().card ?? null)
  /** Reply Drafter: waiting for Replace or Add to end. */
  readonly askingInsert = signal(false)
  readonly inserted = signal(false)
  readonly cleared = signal(false)

  readonly linkGroups = computed(() => {
    const card = this.card()
    if (card?.kind !== 'links' || card.matched) return []
    return LINK_GROUPS.map((group) => ({
      group,
      label: this.t()[GROUP_STRINGS[group]] as string,
      links: card.links.filter((link) => link.group === group)
    })).filter((entry) => entry.links.length)
  })

  readonly researchTopic = computed(() => {
    const card = this.card()
    return card?.kind === 'research-pages'
      ? (this.tools.research.data()[card.topicId] ?? null)
      : null
  })

  readonly maxStar = computed(() => {
    const card = this.card()
    return card?.kind === 'reviews' ? Math.max(1, ...card.stats.perStar) : 1
  })

  showLink(link: LinkRow): void {
    this.tools.links.reveal(link.id)
  }

  insertReply(mode?: 'replace' | 'append'): void {
    if (!mode && this.tools.reply.needsChoice()) {
      this.askingInsert.set(true)
      return
    }
    this.askingInsert.set(false)
    if (this.tools.reply.insert(this.message().content, mode))
      this.inserted.set(true)
  }

  redoReply(): void {
    void this.session.runTool(
      'reply-drafter',
      this.tools.reply.lastInstructions
    )
  }

  async copy(text: string): Promise<void> {
    if (await copyText(text)) this.#toast.success(this.t().copied)
  }

  openNotes(url: string): void {
    this.tools.notes.openPage(url)
    this.#panel.open('notes')
  }

  clearFormMarks(): void {
    this.tools.form.clear()
    this.cleared.set(true)
  }

  clearPatternMarks(): void {
    this.tools.darkPatterns.clear()
    this.cleared.set(true)
  }

  percent(count: number): number {
    return Math.round((count / this.maxStar()) * 100)
  }
}
