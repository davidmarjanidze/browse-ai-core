import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
  viewChild
} from '@angular/core'
import {
  outputFromObservable,
  takeUntilDestroyed,
  toObservable
} from '@angular/core/rxjs-interop'
import {
  BrowseAiCoreConfig,
  ChatMode,
  ChatPosition,
  PaletteName,
  ThemeChangeEvent,
  ThemeMode
} from 'browse-ai-core'
import { distinctUntilChanged, map, skip } from 'rxjs'
import { BookmarkService } from './bookmarks/bookmark.service'
import { ChatEvents } from './chat/chat-events'
import { ChatSessionStore } from './chat/chat-session.store'
import { BookmarksPanelComponent } from './components/bookmarks/bookmarks-panel.component'
import { NotesPanelComponent } from './components/notes/notes-panel.component'
import { ComposerComponent } from './components/composer/composer.component'
import { EmptyStateComponent } from './components/empty-state/empty-state.component'
import { ChatHeaderComponent } from './components/header/chat-header.component'
import { LauncherComponent } from './components/launcher/launcher.component'
import { MessageListComponent } from './components/message-list/message-list.component'
import { SettingsPanelComponent } from './components/settings/settings-panel.component'
import { ConfigStore } from './core/config.store'
import { PanelStore } from './core/panel.store'
import {
  applyThemeCss,
  hoistPropertyRules,
  trapFocus
} from './core/shadow-styles'
import { ThemeStore } from './core/theme.store'
import { CHAT_INSTANCE_PROVIDERS } from './providers'
import { SparklesIconComponent } from './ui/sparkles/sparkles-icon.component'
import { SelectionActionsComponent } from './components/selection-actions/selection-actions.component'
import { ToastOutletComponent } from './ui/toast-outlet/toast-outlet.component'

const PHONE_QUERY = '(max-width: 639.98px)'

/**
 * The chat assistant. Slots: `launcher-icon`, `header`, `empty-state` and
 * `footer` (put `slot="…"` on the element you pass in).
 */
@Component({
  selector: 'browse-ai-core',
  imports: [
    LauncherComponent,
    SparklesIconComponent,
    ChatHeaderComponent,
    MessageListComponent,
    EmptyStateComponent,
    ComposerComponent,
    SettingsPanelComponent,
    BookmarksPanelComponent,
    NotesPanelComponent,
    ToastOutletComponent,
    SelectionActionsComponent
  ],
  templateUrl: './browse-ai-core.component.html',
  styleUrls: [
    './styles/tailwind.css',
    './styles/layout.css',
    './styles/effects.css',
    './styles/markdown.css'
  ],
  encapsulation: ViewEncapsulation.ShadowDom,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: CHAT_INSTANCE_PROVIDERS,
  host: { '[attr.data-layout]': 'layout()' }
})
export class BrowseAiCoreComponent {
  readonly config = input<BrowseAiCoreConfig>({})
  readonly theme = input<ThemeMode | undefined>(undefined)
  readonly palette = input<PaletteName | undefined>(undefined)
  readonly position = input<ChatPosition | undefined>(undefined)
  readonly mode = input<ChatMode | undefined>(undefined)
  /** Whether the panel is open. Works with `[(open)]`. */
  readonly open = model(false)

  readonly #configStore = inject(ConfigStore)
  readonly #events = inject(ChatEvents)
  readonly #host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement
  readonly panel = inject(PanelStore)
  readonly themeStore = inject(ThemeStore)
  readonly t = this.#configStore.strings
  readonly layout = computed(() => this.#configStore.config().mode)
  readonly resolvedPosition = this.themeStore.position

  readonly opened = output<void>()
  readonly closed = output<void>()
  readonly messageSent = outputFromObservable(this.#events.messageSent)
  readonly responseReceived = outputFromObservable(
    this.#events.responseReceived
  )
  readonly errorOccurred = outputFromObservable(this.#events.errorOccurred)
  readonly agentStep = outputFromObservable(this.#events.agentStep)
  readonly agentFinished = outputFromObservable(this.#events.agentFinished)
  readonly watchMatched = outputFromObservable(this.#events.watchMatched)
  readonly themeChange = outputFromObservable(
    toObservable(
      computed<ThemeChangeEvent>(() => ({
        theme: this.themeStore.theme(),
        mode: this.themeStore.mode()
      }))
    ).pipe(
      distinctUntilChanged((a, b) => a.theme === b.theme && a.mode === b.mode),
      skip(1)
    )
  )

  protected readonly composer = viewChild(ComposerComponent)
  protected readonly panelElement =
    viewChild<ElementRef<HTMLElement>>('panelElement')

  constructor() {
    this.#configStore.connect(
      computed(() => {
        const overrides = {
          theme: this.theme(),
          palette: this.palette(),
          position: this.position(),
          mode: this.mode()
        }
        return {
          ...this.config(),
          ...Object.fromEntries(
            Object.entries(overrides).filter(([, value]) => value !== undefined)
          )
        }
      })
    )

    const session = inject(ChatSessionStore)
    const bookmarks = inject(BookmarkService)
    void this.themeStore.init()
    void bookmarks.init()
    session.init()

    effect(() => {
      const shouldOpen = this.open() || this.layout() === 'inline'
      untracked(() => {
        if (shouldOpen && !this.panel.isOpen()) this.panel.open('chat')
        if (!shouldOpen && this.panel.isOpen()) this.panel.close()
      })
    })

    toObservable(this.panel.isOpen)
      .pipe(skip(1), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((isOpen) => {
        this.open.set(isOpen)
        if (isOpen) {
          this.opened.emit()
          this.#focusComposer()
        } else {
          this.closed.emit()
          this.#focusLauncher()
        }
      })

    effect(() => {
      const css = this.themeStore.css()
      const root = this.#host.shadowRoot
      if (root) applyThemeCss(root, css)
    })

    afterNextRender(() => {
      if (this.#host.shadowRoot) hoistPropertyRules(this.#host.shadowRoot)
    })
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (this.layout() === 'inline') return
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault()
      this.panel.close()
      return
    }
    const panel = this.panelElement()?.nativeElement
    if (panel && globalThis.matchMedia?.(PHONE_QUERY).matches)
      trapFocus(event, panel)
  }

  #focusComposer(): void {
    const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches
    if (coarse) return
    setTimeout(() => this.composer()?.focus())
  }

  #focusLauncher(): void {
    setTimeout(() =>
      this.#host.shadowRoot
        ?.querySelector<HTMLButtonElement>('[part="launcher"]')
        ?.focus()
    )
  }
}
