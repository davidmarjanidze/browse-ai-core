import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { FieldTrackerService } from '../../page/field-tracker.service'
import { ToastService } from '../../core/toast.service'
import {
  ReplyDrafterService,
  ReplyLength,
  ReplyTone
} from '../../tools/reply-drafter/reply-drafter.service'
import { ResearchService } from '../../tools/research/research.service'
import { ButtonComponent } from '../../ui/button/button.component'
import { MenuComponent, MenuItem } from '../../ui/menu/menu.component'
import { SelectComponent, SelectOption } from '../../ui/select/select.component'

const NEW_TOPIC = '__new__'
type TopicAction = 'rename' | 'delete' | 'pages' | 'export'

/** Options shown under the tool picker for Reply Drafter, Dictation and Research Notes. */
@Component({
  selector: 'bac-tool-options',
  imports: [SelectComponent, ButtonComponent, MenuComponent],
  templateUrl: './tool-options.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class ToolOptionsComponent {
  readonly session = inject(ChatSessionStore)
  readonly tracker = inject(FieldTrackerService)
  readonly reply = inject(ReplyDrafterService)
  readonly research = inject(ResearchService)
  readonly #toast = inject(ToastService)
  readonly t = this.session.strings
  readonly tool = this.session.selectedTool
  /** Inline name box for a new topic or a rename. */
  readonly naming = signal<'new' | 'rename' | null>(null)
  readonly name = signal('')

  readonly usesField = computed(
    () => this.tool() === 'reply-drafter' || this.tool() === 'dictation'
  )

  readonly toneOptions = computed<SelectOption<ReplyTone>[]>(() => [
    { label: this.t().toneFormal, value: 'formal' },
    { label: this.t().toneNeutral, value: 'neutral' },
    { label: this.t().toneCasual, value: 'casual' }
  ])
  readonly lengthOptions = computed<SelectOption<ReplyLength>[]>(() => [
    { label: this.t().lengthShort, value: 'short' },
    { label: this.t().lengthMedium, value: 'medium' },
    { label: this.t().lengthLong, value: 'long' }
  ])
  readonly topicOptions = computed<SelectOption<string>[]>(() => [
    ...this.research.topics().map((topic) => ({
      label: `${topic.name} (${topic.pages.length})`,
      value: topic.id
    })),
    { label: this.t().newTopic, value: NEW_TOPIC }
  ])
  readonly topicActions = computed<MenuItem<TopicAction>[]>(() => [
    { label: this.t().showPages, value: 'pages' },
    { label: this.t().exportMarkdown, value: 'export' },
    { label: this.t().renameTopic, value: 'rename' },
    { label: this.t().deleteTopic, value: 'delete' }
  ])

  constructor() {
    effect(() => {
      if (this.tool() === 'research-notes')
        untracked(() => void this.research.refresh())
    })
  }

  pickField(): void {
    this.tracker.startPicking()
    this.#toast.show(this.t().fieldPickerActive)
  }

  setTone(value: ReplyTone | null): void {
    if (value) this.reply.tone.set(value)
  }

  setLength(value: ReplyLength | null): void {
    if (value) this.reply.length.set(value)
  }

  setTopic(value: string | null): void {
    if (value === NEW_TOPIC) {
      this.name.set('')
      this.naming.set('new')
      return
    }
    this.research.select(value)
  }

  onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value)
  }

  async saveName(): Promise<void> {
    const name = this.name().trim()
    const id = this.research.topicId()
    if (!name) return
    if (this.naming() === 'rename' && id)
      await this.research.renameTopic(id, name)
    else await this.research.createTopic(name)
    this.naming.set(null)
  }

  onTopicAction(action: TopicAction): void {
    const topic = this.research.topic()
    if (!topic) return
    if (action === 'rename') {
      this.name.set(topic.name)
      this.naming.set('rename')
    } else if (action === 'delete') {
      if (confirm(this.t().deleteTopicConfirm))
        void this.research.deleteTopic(topic.id)
    } else if (action === 'export') {
      this.research.exportTopic(topic.id)
    } else {
      void this.session.runTool('research-notes', 'list')
    }
  }
}
