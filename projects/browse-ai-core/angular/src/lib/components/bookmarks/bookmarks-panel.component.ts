import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core'
import { BookmarkService } from '../../bookmarks/bookmark.service'
import { ConfigStore } from '../../core/config.store'
import { ButtonComponent } from '../../ui/button/button.component'
import { AccordionComponent } from '../../ui/accordion/accordion.component'

const REFRESH_MS = 2000

@Component({
  selector: 'bac-bookmarks-panel',
  imports: [AccordionComponent, ButtonComponent],
  templateUrl: './bookmarks-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' }
})
export class BookmarksPanelComponent {
  readonly service = inject(BookmarkService)
  readonly t = inject(ConfigStore).strings
  readonly expanded = signal<ReadonlySet<string>>(new Set())
  readonly categories = computed(() =>
    Object.entries(this.service.bookmarks()).map(([name, entries]) => ({
      name,
      entries
    }))
  )

  constructor() {
    // Other tabs can add bookmarks while this panel is open.
    void this.service.refresh()
    const timer = setInterval(() => void this.service.refresh(), REFRESH_MS)
    inject(DestroyRef).onDestroy(() => clearInterval(timer))
  }

  setExpanded(category: string, expanded: boolean): void {
    this.expanded.update((current) => {
      const next = new Set(current)
      if (expanded) next.add(category)
      else next.delete(category)
      return next
    })
  }

  clearAll(): void {
    if (this.categories().length && confirm(this.t().clearAllConfirm)) {
      this.service.clearAll()
      this.expanded.set(new Set())
    }
  }
}
