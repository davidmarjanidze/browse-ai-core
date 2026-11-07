import { Injectable, computed, signal } from '@angular/core'

export type Panel = 'closed' | 'chat' | 'settings' | 'bookmarks' | 'notes'

/** Which panel is visible. Replaces a router inside the widget. */
@Injectable()
export class PanelStore {
  readonly panel = signal<Panel>('closed')
  readonly isOpen = computed(() => this.panel() !== 'closed')
  readonly isSubPanel = computed(
    () =>
      this.panel() === 'settings' ||
      this.panel() === 'bookmarks' ||
      this.panel() === 'notes'
  )

  open(panel: Exclude<Panel, 'closed'> = 'chat'): void {
    this.panel.set(panel)
  }

  close(): void {
    this.panel.set('closed')
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close()
    } else {
      this.open('chat')
    }
  }
}
