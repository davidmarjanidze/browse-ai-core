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
import { ExtraToolRunner } from './chat/extra-tool-runner'
import { VoiceInputStore } from './chat/voice-input.store'
import { FieldTrackerService } from './page/field-tracker.service'
import { ArgumentMapperService } from './tools/argument-mapper/argument-mapper.service'
import { DarkPatternDetectorService } from './tools/dark-patterns/dark-pattern-detector.service'
import { DictationService } from './tools/dictation/dictation.service'
import { FormValidatorService } from './tools/form-validator/form-validator.service'
import { LinkInspectorService } from './tools/link-inspector/link-inspector.service'
import { NotesService } from './tools/notes/notes.service'
import { PerformanceCollectorService } from './tools/performance/performance-collector.service'
import { PerformanceExplainerService } from './tools/performance/performance-explainer.service'
import { PhishingCheckService } from './tools/phishing-check/phishing-check.service'
import { ReplyDrafterService } from './tools/reply-drafter/reply-drafter.service'
import { ResearchService } from './tools/research/research.service'
import { ReviewSummarizerService } from './tools/review-summarizer/review-summarizer.service'
import { ToolNotices } from './chat/tool-notices'
import { AgentRunnerService } from './tools/agent/agent-runner.service'
import { WatchRunnerService } from './tools/watch/watch-runner.service'

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
  FieldTrackerService,
  LinkInspectorService,
  ReplyDrafterService,
  NotesService,
  ReviewSummarizerService,
  ResearchService,
  ArgumentMapperService,
  FormValidatorService,
  DictationService,
  PerformanceCollectorService,
  PerformanceExplainerService,
  PhishingCheckService,
  DarkPatternDetectorService,
  ToolNotices,
  AgentRunnerService,
  WatchRunnerService,
  ExtraToolRunner,
  ToolRunner,
  ChatEvents,
  ChatSessionStore,
  VoiceInputStore,
  BookmarkService
]
