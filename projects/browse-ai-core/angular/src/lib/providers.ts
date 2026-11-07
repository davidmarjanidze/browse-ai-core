import { Provider } from '@angular/core'
import { AiService } from './ai/ai.service'
import { BuiltInAiService } from './ai/built-in/built-in-ai.service'
import { BookmarkService } from './bookmarks/bookmark.service'
import { ChatEvents } from './chat/chat-events'
import { ChatSessionStore } from './chat/chat-session.store'
import { ToolRunner } from './chat/tool-runner'
import { ConfigStore } from './core/config.store'
import { provideHostElement } from './core/host-element'
import { PanelStore } from './core/panel.store'
import { StorageService } from './core/storage.service'
import { ThemeStore } from './core/theme.store'
import { ToastService } from './core/toast.service'
import { PageContextService } from './page/page-context.service'
import { SelectionActionsService } from './page/selection-actions.service'
import { SnipCaptureService } from './page/snip-capture.service'
import { DomInspectorService } from './tools/dom-to-component/dom-inspector.service'
import { FormFillerService } from './tools/form-filler/form-filler.service'
import { ImageDownloaderService } from './tools/image-downloader/image-downloader.service'
import { SubjectFinderService } from './tools/subject-finder/subject-finder.service'
import { TablesExtractorService } from './tools/tables/tables-extractor.service'

/**
 * Every service of one chat instance. Provided on the root component, so
 * two chats on a page don't share state.
 */
export const CHAT_INSTANCE_PROVIDERS: Provider[] = [
  provideHostElement(),
  ConfigStore,
  StorageService,
  ThemeStore,
  PanelStore,
  ToastService,
  AiService,
  BuiltInAiService,
  PageContextService,
  SnipCaptureService,
  SelectionActionsService,
  DomInspectorService,
  FormFillerService,
  TablesExtractorService,
  ImageDownloaderService,
  SubjectFinderService,
  ToolRunner,
  ChatEvents,
  ChatSessionStore,
  BookmarkService
]
