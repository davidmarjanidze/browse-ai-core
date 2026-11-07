import { bootstrapApplication } from '@angular/platform-browser'
import { provideBrowseAiCore } from 'browse-ai-core/angular'
import { DemoComponent } from './demo.component'

bootstrapApplication(DemoComponent, {
  providers: [provideBrowseAiCore({ features: { bookmarks: false } })]
}).catch((error: unknown) => console.error(error))
