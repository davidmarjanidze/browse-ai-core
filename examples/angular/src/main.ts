import { bootstrapApplication } from '@angular/platform-browser'
import { provideBrowseAiCore } from 'browse-ai-core/angular'
import { App } from './app'

bootstrapApplication(App, {
  providers: [
    // Defaults for every <browse-ai-core> in the app
    provideBrowseAiCore({
      palette: 'ocean',
      ai: { systemPrompt: 'Answer in short sentences.' }
    })
  ]
}).catch((error: unknown) => console.error(error))
