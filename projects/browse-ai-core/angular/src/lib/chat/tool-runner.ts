import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, inject, signal } from '@angular/core'
import { formatString } from 'browse-ai-core'
import { AiService } from '../ai/ai.service'
import {
  BuiltInAiService,
  isBuiltInTool
} from '../ai/built-in/built-in-ai.service'
import { ConfigStore } from '../core/config.store'
import { BAC_HOST_ELEMENT } from '../core/host-element'
import { ToastService } from '../core/toast.service'
import { buildComponentPrompt } from '../tools/dom-to-component/component-prompt'
import { DomElementSelection } from '../tools/dom-to-component/dom-inspector.service'
import { FormFieldData } from '../tools/form-filler/form-field.model'
import { FormFillerService } from '../tools/form-filler/form-filler.service'
import {
  IMAGES_ZIP_NAME,
  ImageDownloaderService,
  ImageSearchResult,
  MatchedImage
} from '../tools/image-downloader/image-downloader.service'
import { MAX_IMAGES } from '../tools/image-downloader/visible-images'
import { SubjectFinderService } from '../tools/subject-finder/subject-finder.service'
import { PanelStore } from '../core/panel.store'
import { FormSuggestionLayer } from '../tools/form-filler/form-suggestion-layer'
import {
  ExtractedTable,
  TablesDownloadFormat
} from '../tools/tables/table-formats'
import {
  TABLES_ZIP_NAME,
  TablesExtractorService
} from '../tools/tables/tables-extractor.service'
import { DomToComponentFramework, ToolId } from '../tools/tools.model'
import { ChatMessage } from './chat.model'
import { ExtraToolRunner } from './extra-tool-runner'
import { isExtraTool } from '../tools/extra-tools'

/** Width (px) below which the panel closes after Subject Finder scrolls. */
const SMALL_SCREEN = 640

export interface ToolRequest {
  text: string
  selection: DomElementSelection | null
  framework: DomToComponentFramework
  /** Recorded audio as a data URL (Dictation). */
  audio?: string
  signal: AbortSignal
  onChunk: (chunk: string) => void
  /** Replaces the answer text with a status, e.g. progress. */
  onStatus: (status: string) => void
}

export interface ToolResult {
  content: string
  extra?: Partial<ChatMessage>
}

/** Runs the composer tools and keeps their results (suggestions, tables). */
@Injectable()
export class ToolRunner {
  readonly #ai = inject(AiService)
  readonly #builtIn = inject(BuiltInAiService)
  readonly #formFiller = inject(FormFillerService)
  readonly #tables = inject(TablesExtractorService)
  readonly #images = inject(ImageDownloaderService)
  readonly #finder = inject(SubjectFinderService)
  readonly #extra = inject(ExtraToolRunner)
  readonly #panel = inject(PanelStore)
  readonly #config = inject(ConfigStore).config
  readonly #toast = inject(ToastService)
  readonly #strings = inject(ConfigStore).strings
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)

  readonly formSuggestionCount = signal(0)
  readonly extractedTables = signal<ExtractedTable[] | null>(null)
  readonly matchedImages = signal<MatchedImage[]>([])
  #layer: FormSuggestionLayer | null = null
  #suggestions: FormFieldData[] = []

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reset())
  }

  async run(tool: ToolId, request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()

    if (isExtraTool(tool)) return this.#extra.run(tool, request)

    if (isBuiltInTool(tool)) {
      const content = await this.#builtIn.run(
        tool,
        request.text,
        request.signal,
        request.onChunk
      )
      return { content }
    }

    if (tool === 'subject-finder') {
      const found = await this.#finder.find(request.text, request.signal)
      if (found) this.#closePanelOnSmallScreen()
      return {
        content: found ? strings.subjectFound : strings.subjectNotFound
      }
    }

    if (tool === 'image-downloader') {
      const result = await this.#images.find(
        request.text,
        request.signal,
        (current, total) =>
          request.onStatus(
            formatString(strings.checkingImage, { current, total })
          )
      )
      this.matchedImages.set(result.matches)
      return { content: this.#imagesSummary(result) }
    }

    if (tool === 'tables-extractor') {
      const tables = await this.#tables.extract(request.text, request.signal)
      this.extractedTables.set(tables)
      return {
        content: tables.length ? strings.tablesExtracted : strings.noTables,
        extra: { tablesExtractorData: tables }
      }
    }

    if (tool === 'form-filler') {
      const suggestions = await this.#formFiller.suggest(
        request.text,
        request.signal
      )
      this.#showSuggestions(suggestions)
      return {
        content: suggestions.length
          ? strings.formSuggestionsReady
          : strings.noFormFields,
        extra: { formFillerData: suggestions }
      }
    }

    if (!request.selection) return { content: '' }
    const base = buildComponentPrompt(
      this.#document,
      request.selection.outerHtml,
      request.framework
    )
    const content = await this.#ai.prompt({
      userPrompt: request.text
        ? `${base}\n\nADDITIONAL USER REQUIREMENTS:\n${request.text}`
        : base,
      agentMode: true,
      useSharedSession: true,
      signal: request.signal,
      onChunk: request.onChunk
    })
    return { content }
  }

  acceptAllSuggestions(): void {
    const values = this.#suggestions.map((field) => ({
      fieldId: field.id,
      value: field.value ?? ''
    }))
    const filled = this.#formFiller.apply(values)
    if (filled > 0) {
      this.#toast.success(this.#strings().formFilled)
    } else {
      this.#toast.error(this.#strings().formFillFailed)
    }
    this.#closeSuggestions()
  }

  dismissAllSuggestions(): void {
    this.#closeSuggestions()
    this.#toast.show(this.#strings().suggestionsDismissed)
  }

  downloadTables(format: TablesDownloadFormat): void {
    const tables = this.extractedTables()
    if (!tables?.length) {
      this.#toast.error(this.#strings().noTables)
      return
    }
    this.#tables.download(tables, format)
    this.#toast.success(
      formatString(this.#strings().downloaded, { file: TABLES_ZIP_NAME })
    )
  }

  async downloadImages(): Promise<void> {
    const matches = this.matchedImages()
    if (!matches.length) return
    await this.#images.download(matches)
    this.#toast.success(
      formatString(this.#strings().downloaded, { file: IMAGES_ZIP_NAME })
    )
  }

  reset(): void {
    this.#closeSuggestions()
    this.extractedTables.set(null)
    this.matchedImages.set([])
    this.#extra.reset()
  }

  /** On small screens the floating panel would cover the match. */
  #closePanelOnSmallScreen(): void {
    const width = this.#document.defaultView?.innerWidth ?? Infinity
    if (width < SMALL_SCREEN && this.#config().mode !== 'inline') {
      this.#panel.close()
    }
  }

  #imagesSummary(result: ImageSearchResult): string {
    const strings = this.#strings()
    if (result.total === 0) return strings.noVisibleImages
    const lines = [
      ...(result.stopped ? [strings.generationStopped] : []),
      result.matches.length
        ? formatString(strings.imagesReady, { count: result.matches.length })
        : strings.noMatchingImages
    ]
    if (result.skipped)
      lines.push(
        formatString(strings.imagesSkipped, { skipped: result.skipped })
      )
    if (result.limited)
      lines.push(formatString(strings.imagesLimited, { max: MAX_IMAGES }))
    return lines.join('\n\n')
  }

  #showSuggestions(suggestions: FormFieldData[]): void {
    this.#closeSuggestions()
    if (suggestions.length === 0) return

    const strings = this.#strings()
    this.#suggestions = suggestions
    this.#layer = new FormSuggestionLayer({
      doc: this.#document,
      themeSource: this.#host,
      labels: { accept: strings.accept, dismiss: strings.dismiss },
      resolveElement: (fieldId) =>
        this.#formFiller.scan().find((field) => field.id === fieldId)?.element,
      onAccept: (field) => {
        this.#formFiller.apply([
          { fieldId: field.id, value: field.value ?? '' }
        ])
        this.#removeSuggestion(field.id)
      },
      onDismiss: (field) => this.#removeSuggestion(field.id)
    })
    this.#layer.show(suggestions)
    this.formSuggestionCount.set(suggestions.length)
  }

  #removeSuggestion(fieldId: string): void {
    this.#suggestions = this.#suggestions.filter(
      (field) => field.id !== fieldId
    )
    this.formSuggestionCount.set(this.#suggestions.length)
    if (this.#suggestions.length === 0) this.#closeSuggestions()
  }

  #closeSuggestions(): void {
    this.#layer?.destroy()
    this.#layer = null
    this.#suggestions = []
    this.formSuggestionCount.set(0)
  }
}
