import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import { AiService } from '../../ai/ai.service'
import { ChatSessionStore } from '../../chat/chat-session.store'
import { ConfigStore } from '../../core/config.store'
import { FormatPipe } from '../../core/format.pipe'
import { PanelStore } from '../../core/panel.store'
import { ButtonComponent } from '../../ui/button/button.component'
import { MenuComponent, MenuItem } from '../../ui/menu/menu.component'
import { NotesService } from '../../tools/notes/notes.service'

type HeaderMenuAction = 'settings' | 'bookmarks' | 'notes'

@Component({
  selector: 'bac-chat-header',
  imports: [ButtonComponent, MenuComponent, FormatPipe],
  templateUrl: './chat-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block shrink-0' }
})
export class ChatHeaderComponent {
  readonly ai = inject(AiService)
  readonly panel = inject(PanelStore)
  readonly #session = inject(ChatSessionStore)
  readonly #notes = inject(NotesService)
  readonly #configStore = inject(ConfigStore)
  readonly t = this.#configStore.strings
  readonly features = this.#configStore.features
  readonly isInline = computed(
    () => this.#configStore.config().mode === 'inline'
  )

  readonly title = computed(() => {
    const strings = this.t()
    switch (this.panel.panel()) {
      case 'settings':
        return strings.settings
      case 'bookmarks':
        return strings.bookmarks
      case 'notes':
        return strings.notes
      default:
        return strings.title
    }
  })

  readonly menuItems = computed<MenuItem<HeaderMenuAction>[]>(() => {
    const strings = this.t()
    const features = this.features()
    return [
      ...(features.settings
        ? [{ label: strings.settings, value: 'settings' as const }]
        : []),
      ...(features.bookmarks
        ? [{ label: strings.bookmarks, value: 'bookmarks' as const }]
        : []),
      ...(features.notes
        ? [{ label: strings.notes, value: 'notes' as const }]
        : [])
    ]
  })

  readonly usageColor = computed(() => {
    const percentage = this.ai.contextUsage().percentage
    if (percentage < 50) return 'var(--bac-success)'
    if (percentage < 75) return 'var(--bac-warning)'
    return 'var(--bac-danger)'
  })

  newChat(): void {
    this.#session.clear()
  }

  onMenu(action: HeaderMenuAction): void {
    if (action === 'notes') this.#notes.view.set({ level: 'sites' })
    this.panel.open(action)
  }

  /** Back arrow: Notes goes up one level first, then back to the chat. */
  back(): void {
    if (this.panel.panel() === 'notes' && this.#notes.goUp()) return
    this.panel.open('chat')
  }
}
