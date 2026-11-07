import { Component, signal } from '@angular/core'
import type { MessageSentEvent } from 'browse-ai-core'
import { BrowseAiCoreComponent } from 'browse-ai-core/angular'

@Component({
  selector: 'app-root',
  imports: [BrowseAiCoreComponent],
  templateUrl: './app.html'
})
export class App {
  readonly open = signal(false)

  onMessageSent(event: MessageSentEvent): void {
    console.log('User asked:', event.text)
  }
}
