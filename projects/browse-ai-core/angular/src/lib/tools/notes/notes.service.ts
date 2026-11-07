import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core'
import { formatString } from 'browse-ai-core'
import { AiService } from '../../ai/ai.service'
import {
  cleanModelText,
  parseJsonFromModelResponse
} from '../../ai/json-response'
import type { ToolRequest, ToolResult } from '../../chat/tool-runner'
import { ConfigStore } from '../../core/config.store'
import { downloadText, newId, splitText } from '../../core/download'
import { BAC_HOST_ELEMENT } from '../../core/host-element'
import {
  NoteRecord,
  NotesData,
  NotesPage,
  addNotes,
  deleteNote,
  deletePage,
  pageKey,
  pageLabel,
  pageToMarkdown,
  siteKey
} from '../../core/notes-data'
import { PanelStore } from '../../core/panel.store'
import { StorageService } from '../../core/storage.service'
import { ToastService } from '../../core/toast.service'
import { textAround } from '../../page/find-text-range'
import { revealOnPage } from '../../page/reveal-element'
import { slug } from '../tables/table-formats'
import { NotesHighlighter } from './notes-highlighter'

export const PART_SIZE = 12_000
export const MAX_PAGE_NOTES = 8
const QUOTE_MAX = 2000
const CONTEXT_SIZE = 750

export type NotesView =
  | { level: 'sites' }
  | { level: 'pages'; host: string }
  | { level: 'notes'; host: string; url: string }

export function buildPageNotesPrompt(
  text: string,
  count: number,
  focus: string
): string {
  return [
    `Make ${count} short notes about the main points of the web page text below. Each note is one or two sentences.`,
    focus ? `FOCUS ONLY ON: ${focus}` : '',
    `TEXT:\n${text}`,
    'Answer only with JSON: {"notes":["<note>", "<note>"]}'
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function parseNotes(answer: string): string[] {
  const json = parseJsonFromModelResponse(answer) as { notes?: unknown } | null
  return Array.isArray(json?.notes)
    ? json.notes
        .filter(
          (note): note is string =>
            typeof note === 'string' && Boolean(note.trim())
        )
        .map(cleanModelText)
        .filter(Boolean)
    : []
}

export function buildQuoteNotePrompt(quote: string, context: string): string {
  return [
    'Write a note of 1 to 3 sentences that explains the quote below, using the text around it. Output only the note.',
    `QUOTE:\n${quote}`,
    `TEXT AROUND IT:\n${context}`
  ].join('\n\n')
}

/** AI notes and highlights for each page, and the Notes panel state. */
@Injectable()
export class NotesService {
  readonly #storage = inject(StorageService)
  readonly #ai = inject(AiService)
  readonly #panel = inject(PanelStore)
  readonly #toast = inject(ToastService)
  readonly #document = inject(DOCUMENT)
  readonly #host = inject(BAC_HOST_ELEMENT)
  readonly #configStore = inject(ConfigStore)
  readonly #strings = this.#configStore.strings
  #highlighter: NotesHighlighter | null = null

  readonly data = signal<NotesData>({})
  readonly view = signal<NotesView>({ level: 'sites' })
  readonly query = signal('')
  readonly isActive = computed(() => this.#configStore.features().notes)

  constructor() {
    const view = this.#document.defaultView
    const onNavigate = (): void => this.applyHighlights()
    const navigation = (view as { navigation?: EventTarget } | null)?.navigation
    navigation?.addEventListener('navigatesuccess', onNavigate)
    view?.addEventListener('popstate', onNavigate)
    inject(DestroyRef).onDestroy(() => {
      navigation?.removeEventListener('navigatesuccess', onNavigate)
      view?.removeEventListener('popstate', onNavigate)
      this.#highlighter?.destroy()
    })
    if (this.isActive()) void this.refresh().then(() => this.applyHighlights())
  }

  async refresh(): Promise<void> {
    this.data.set((await this.#storage.load()).notes)
  }

  /** The current page's saved notes. */
  currentPage(): NotesPage | null {
    const url = this.#document.location?.href ?? ''
    return this.data()[siteKey(url)]?.[pageKey(url)] ?? null
  }

  applyHighlights(): void {
    if (!this.isActive()) return
    this.#highlighter ??= new NotesHighlighter({
      doc: this.#document,
      host: this.#host,
      openLabel: this.#strings().openInNotes,
      onOpen: () => this.openPage(this.#document.location?.href ?? '')
    })
    this.#highlighter.apply(this.currentPage()?.notes ?? [])
  }

  /** Saves the selected page text with an AI note ("Save note" action). */
  async saveSelection(): Promise<void> {
    const strings = this.#strings()
    const selection = this.#document.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    const quote = selection.toString().trim().slice(0, QUOTE_MAX)
    if (!quote) return
    const { before, after } = textAround(range, 32)
    const context = textAround(range, CONTEXT_SIZE)

    let note = ''
    try {
      if (this.#ai.isModelReady()) {
        note = cleanModelText(
          await this.#ai.prompt({
            userPrompt: buildQuoteNotePrompt(
              quote,
              `${context.before} ${quote} ${context.after}`
            ),
            agentMode: true,
            track: false
          })
        )
      }
    } catch {
      note = ''
    }
    await this.#save([
      {
        id: newId(),
        quote,
        note,
        before,
        after,
        createdAt: new Date().toISOString()
      }
    ])
    selection.removeAllRanges()
    this.applyHighlights()
    if (note) this.#toast.success(strings.noteSaved)
    else this.#toast.show(strings.noteSavedWithoutAi)
  }

  /** The Notes tool: notes for the whole page. */
  async run(request: ToolRequest): Promise<ToolResult> {
    const strings = this.#strings()
    const text = (
      this.#document.body?.innerText ??
      this.#document.body?.textContent ??
      ''
    ).trim()
    const parts = splitText(text, PART_SIZE)
    if (parts.length === 0) return { content: strings.noNotesMade }
    const perPart = Math.max(1, Math.ceil(MAX_PAGE_NOTES / parts.length))
    const notes: string[] = []
    for (const part of parts) {
      const answer = await this.#ai.prompt({
        userPrompt: buildPageNotesPrompt(
          part,
          Math.min(Math.max(perPart, 3), MAX_PAGE_NOTES),
          request.text
        ),
        agentMode: true,
        signal: request.signal
      })
      notes.push(...parseNotes(answer))
      if (notes.length >= MAX_PAGE_NOTES * 2) break
    }
    const kept = notes.slice(0, MAX_PAGE_NOTES)
    if (kept.length === 0) return { content: strings.noNotesMade }
    const now = new Date().toISOString()
    const saved = await this.#save(
      kept.map((note) => ({
        id: newId(),
        quote: '',
        note,
        before: '',
        after: '',
        createdAt: now
      }))
    )
    const url = pageKey(this.#document.location?.href ?? '')
    return {
      content: [
        formatString(strings.notesSaved, { count: kept.length }),
        '',
        ...kept.map((note) => `- ${note}`),
        ...(saved ? [] : ['', strings.notesSaveFailed])
      ].join('\n'),
      extra: { card: { kind: 'notes', url } }
    }
  }

  openPage(url: string): void {
    const key = pageKey(url)
    this.query.set('')
    this.view.set({ level: 'notes', host: siteKey(key), url: key })
    this.#panel.open('notes')
  }

  /** Goes up one level. False when already at the websites level. */
  goUp(): boolean {
    const view = this.view()
    if (view.level === 'notes') {
      this.view.set({ level: 'pages', host: view.host })
      return true
    }
    if (view.level === 'pages') {
      this.view.set({ level: 'sites' })
      return true
    }
    return false
  }

  /** True when `url` is the page that is open now. */
  isCurrentPage(url: string): boolean {
    return pageKey(this.#document.location?.href ?? '') === url
  }

  /** Closes the panel and scrolls to the first highlight on this page. */
  revealFirstHighlight(): void {
    this.#panel.close()
    const range = this.#highlighter?.ranges[0]
    if (range) revealOnPage(this.#document, this.#host, range)
  }

  async deleteNote(url: string, id: string): Promise<void> {
    await this.#update((data) => deleteNote(data, url, id))
  }

  async deletePage(url: string): Promise<void> {
    await this.#update((data) => deletePage(data, url))
    const view = this.view()
    if (view.level === 'notes' && view.url === url) this.goUp()
  }

  exportPage(page: NotesPage): void {
    downloadText(
      this.#document,
      `${slug(pageLabel(page)) || 'notes'}.md`,
      pageToMarkdown(page)
    )
  }

  async #save(notes: NoteRecord[]): Promise<boolean> {
    const doc = this.#document
    const icon = doc.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href
    const page = {
      url: doc.location?.href ?? '',
      title: doc.title,
      favicon: icon
    }
    return this.#update((data) => addNotes(data, page, notes))
  }

  /** Changes the notes in memory and in storage. False when saving failed. */
  async #update(change: (data: NotesData) => NotesData): Promise<boolean> {
    this.data.update(change)
    let ok = true
    try {
      await this.#storage.updateStrict((stored) => ({
        ...stored,
        notes: change(stored.notes)
      }))
    } catch {
      ok = false
      this.#toast.error(this.#strings().notesSaveFailed)
    }
    this.applyHighlights()
    return ok
  }
}
