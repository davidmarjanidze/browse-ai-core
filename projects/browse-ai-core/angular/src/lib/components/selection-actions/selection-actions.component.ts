import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import { BUILT_IN_TOOL_IDS, BuiltInToolId } from 'browse-ai-core'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { PanelStore } from '../../core/panel.store'
import { SelectionActionsService } from '../../page/selection-actions.service'
import { NotesService } from '../../tools/notes/notes.service'

const BAR_HEIGHT = 40
const GAP = 8

/** Bar with Summarize, Translate, ... shown next to selected page text. */
@Component({
  selector: 'bac-selection-actions',
  templateUrl: './selection-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectionActionsComponent {
  readonly session = inject(ChatSessionStore)
  readonly #panel = inject(PanelStore)
  readonly #selection = inject(SelectionActionsService)
  readonly #notes = inject(NotesService)
  readonly t = this.session.strings

  /** Tools turned on whose model is downloaded. */
  readonly actions = computed(() => {
    this.session.builtIn.states()
    const features = this.session.features()
    const strings = this.t()
    return BUILT_IN_TOOL_IDS.filter(
      (tool) => features[tool] && this.session.builtIn.isReady(tool)
    ).map((tool) => ({ tool, label: strings[`${tool}Action`] }))
  })

  readonly showSaveNote = computed(() => this.session.features().notes)

  readonly position = computed(() => {
    const selection = this.#selection.selection()
    const hasActions = this.actions().length > 0 || this.showSaveNote()
    if (!selection || !this.#selection.isActive() || !hasActions) return null
    const { rect } = selection
    const above = rect.top - BAR_HEIGHT - GAP
    const top = above >= GAP ? above : rect.bottom + GAP
    const left = Math.max(GAP, Math.min(rect.left, window.innerWidth - 320))
    return { top: Math.min(top, window.innerHeight - BAR_HEIGHT - GAP), left }
  })

  saveNote(): void {
    void this.#notes.saveSelection()
    this.#selection.hide()
  }

  run(tool: BuiltInToolId): void {
    const selection = this.#selection.selection()
    if (!selection || this.session.isBusy()) return
    this.#selection.hide()
    if (this.#panel.panel() !== 'chat') this.#panel.open('chat')
    void this.session.runTool(tool, selection.text)
  }
}
