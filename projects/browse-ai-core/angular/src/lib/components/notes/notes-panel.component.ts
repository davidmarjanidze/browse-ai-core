import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core'
import { formatString } from 'browse-ai-core'
import { copyText } from '../../core/clipboard'
import { ConfigStore } from '../../core/config.store'
import {
  NotesPage,
  listPages,
  listSites,
  pageLabel,
  searchPages
} from '../../core/notes-data'
import { ToastService } from '../../core/toast.service'
import { NotesService } from '../../tools/notes/notes.service'
import { ButtonComponent } from '../../ui/button/button.component'
import { HelpBoxComponent } from '../../ui/help-box/help-box.component'

/**
 * Notes by level: websites, then the pages of one website, then the notes
 * of one page.
 */
@Component({
  selector: 'bac-notes-panel',
  imports: [ButtonComponent, HelpBoxComponent],
  templateUrl: './notes-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' }
})
export class NotesPanelComponent {
  readonly service = inject(NotesService)
  readonly #toast = inject(ToastService)
  readonly t = inject(ConfigStore).strings
  readonly label = pageLabel
  readonly format = formatString

  readonly view = this.service.view
  readonly sites = computed(() => listSites(this.service.data()))
  readonly isEmpty = computed(() => this.sites().length === 0)
  readonly results = computed(() =>
    searchPages(this.service.data(), this.service.query())
  )
  readonly pages = computed(() => {
    const view = this.view()
    return view.level === 'sites'
      ? []
      : listPages(this.service.data(), view.host)
  })
  /** Titles used by more than one page on this site. */
  readonly repeatedTitles = computed(() => {
    const counts = new Map<string, number>()
    for (const page of this.pages()) {
      const title = pageLabel(page)
      counts.set(title, (counts.get(title) ?? 0) + 1)
    }
    return new Set([...counts].filter(([, n]) => n > 1).map(([title]) => title))
  })
  readonly page = computed<NotesPage | null>(() => {
    const view = this.view()
    if (view.level !== 'notes') return null
    return this.service.data()[view.host]?.[view.url] ?? null
  })

  constructor() {
    void this.service.refresh()
  }

  path(url: string): string {
    try {
      const parsed = new URL(url)
      return parsed.pathname + parsed.search
    } catch {
      return url
    }
  }

  openSite(host: string): void {
    this.service.query.set('')
    this.view.set({ level: 'pages', host })
  }

  openPage(page: NotesPage): void {
    this.service.openPage(page.url)
  }

  onSearch(event: Event): void {
    this.service.query.set((event.target as HTMLInputElement).value)
  }

  /** Same page: close the panel and scroll to the first highlight. */
  onUrlClick(event: MouseEvent, url: string): void {
    if (!this.service.isCurrentPage(url)) return
    event.preventDefault()
    this.service.revealFirstHighlight()
  }

  async copy(text: string): Promise<void> {
    if (await copyText(text)) this.#toast.success(this.t().copied)
  }

  deletePage(page: NotesPage): void {
    if (confirm(this.t().deletePageConfirm))
      void this.service.deletePage(page.url)
  }
}
