import {
  AGENT_TOOL_NAMES,
  type AgentToolName,
  REQUIRED_AGENT_TOOLS
} from './agent-tool-names'
import type { AiPromptMessage, AiProvider } from './ai-provider'
import type { BuiltInToolsOptions } from './built-in-tools'
import { chromeLanguageModelProvider } from './ai-provider'
import type { PaletteName } from './palettes'
import { isPaletteName } from './palettes'
import type { ScreenCaptureAdapter } from './screen-capture'
import { defaultScreenCapture } from './screen-capture'
import type { StorageAdapter } from './storage'
import { defaultStorageAdapter } from './storage'
import type { BrowseAiCoreStrings } from './strings'
import { DEFAULT_STRINGS } from './strings'

export type ThemeMode = 'light' | 'dark' | 'system'

/** `page`: prompts include the page. `general`: no page context. */
export type ContextMode = 'page' | 'general'

export type ChatPosition =
  'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/**
 * - `floating`: a button in a corner that opens a chat panel next to it.
 * - `drawer`: the same button, but the panel takes the full height of the
 *   window on the left or right side.
 * - `inline`: no button. The chat fills the element it is placed in.
 */
export type ChatMode = 'floating' | 'drawer' | 'inline'

export interface BrowseAiCoreFeatures {
  /** "Page / General" switch. When off, prompts never include the page. */
  pageContext: boolean
  /** Upload an image from the attachment menu. */
  imageInput: boolean
  /** Upload an audio file from the attachment menu. */
  audioInput: boolean
  /** "Capture visible area" and "Snip and capture". */
  screenCapture: boolean
  /** Tool that fills forms on the page. */
  formFiller: boolean
  /** Tool that reads tables on the page and downloads them. */
  tablesExtractor: boolean
  /** Tool that turns a page element into component code. */
  domToComponent: boolean
  /** Tool that summarizes text with Chrome's Summarizer API. */
  summarizer: boolean
  /** Tool that translates text with Chrome's Translator API. */
  translator: boolean
  /** Tool that writes text for a task with Chrome's Writer API. */
  writer: boolean
  /** Tool that rewrites text with Chrome's Rewriter API. */
  rewriter: boolean
  /** Tool that corrects text with Chrome's Proofreader API. */
  proofreader: boolean
  /** Tool that finds images on the screen by subject and zips them. */
  imageDownloader: boolean
  /** Tool that finds the part of the page the user describes and scrolls to it. */
  subjectFinder: boolean
  /**
   * Summarize, Translate and other actions when the user selects page text.
   * Users can turn it off in settings.
   */
  selectionActions: boolean
  /** Saves every visited page into an AI-made category. */
  bookmarks: boolean
  /** Tool that lists the page's links in groups and finds a link you ask for. */
  linkInspector: boolean
  /** Tool that drafts a reply for a text box on the page. */
  replyDrafter: boolean
  /** AI notes and highlights for each page, and the Notes panel. */
  notes: boolean
  /** Tool that summarizes the reviews on the page. */
  reviewSummarizer: boolean
  /** Tool that saves pages into research topics and answers across them. */
  researchNotes: boolean
  /** Tool that shows the claim, points for and points against in a text. */
  argumentMapper: boolean
  /** Tool that checks a form before it is sent and explains problems. */
  formValidator: boolean
  /** Mic button in the composer that turns speech into the message text. */
  voiceInput: boolean
  /** Tool that types speech into a text box on the page. */
  dictation: boolean
  /** Tool that shows the page's speed numbers in live charts. */
  performanceExplainer: boolean
  /** Tool that looks for phishing and scam signs on the page. */
  phishingCheck: boolean
  /** Tool that finds dark patterns such as pre-checked boxes and fake timers. */
  darkPatternDetector: boolean
  /** Agent Mode: does a task on the page with clicks, typing and scrolling. */
  agentMode: boolean
  /** Watch Mode: watches a part of the page for a text change. */
  watchMode: boolean
  /** Settings panel (appearance and personalization). */
  settings: boolean
  /** Nickname and custom instructions in settings. */
  personalization: boolean
  /** Theme and palette pickers in settings. */
  appearance: boolean
  /** Renders responses as Markdown. When off, shows plain text. */
  markdown: boolean
  /** Chat memory badge in the header. */
  contextUsage: boolean
}

export interface BrowseAiCoreAiOptions {
  /** Sent to the model before every conversation. */
  systemPrompt?: string
  temperature?: number
  topK?: number
  /** Example messages the conversation starts with. */
  initialPrompts?: AiPromptMessage[]
  /** Language of the answers. Default `en`. */
  outputLanguage?: string
  /** Options for the Summarizer, Translator, Writer, Rewriter and Proofreader tools. */
  builtInTools?: BuiltInToolsOptions
}

/** When Agent Mode asks before an action. */
export type AgentConfirmMode = 'risky' | 'always' | 'never'

export interface BrowseAiCoreAgentOptions {
  /** Most steps in one run. Default 25. */
  maxSteps?: number
  /** Longest run in milliseconds. Default 300000 (5 minutes). */
  maxDurationMs?: number
  /** Default `risky`: ask before pay, send, delete, submit and leaving the page. */
  confirm?: AgentConfirmMode
  /** Tools the agent may not use. Default `[]`. `done` and `fail` are always kept. */
  disabledTools?: readonly AgentToolName[]
}

export interface BrowseAiCoreWatchOptions {
  /** Time between checks in milliseconds. Default 15000, at least 5000. */
  intervalMs?: number
  /** How sure the model must be (0 to 1) before the chat reports a change. Default 0.7. */
  threshold?: number
}

export interface BrowseAiCoreConfig {
  theme?: ThemeMode
  palette?: PaletteName
  position?: ChatPosition
  mode?: ChatMode
  /** Where the "Page / General" switch starts. Default `page`. */
  defaultContextMode?: ContextMode
  features?: Partial<BrowseAiCoreFeatures>
  ai?: BrowseAiCoreAiOptions
  strings?: Partial<BrowseAiCoreStrings>
  aiProvider?: AiProvider
  storage?: StorageAdapter
  /** `null` turns screenshots off. */
  screenCapture?: ScreenCaptureAdapter | null
  /** Prefix of every key written to storage. Default `browse-ai-core`. */
  storageKey?: string
  /** Limits for Agent Mode. */
  agent?: BrowseAiCoreAgentOptions
  /** Timing for Watch Mode. */
  watch?: BrowseAiCoreWatchOptions
}

export interface ResolvedBrowseAiCoreConfig {
  theme: ThemeMode
  palette: PaletteName
  position: ChatPosition
  mode: ChatMode
  defaultContextMode: ContextMode
  features: BrowseAiCoreFeatures
  ai: Required<Pick<BrowseAiCoreAiOptions, 'outputLanguage'>> &
    BrowseAiCoreAiOptions
  strings: BrowseAiCoreStrings
  aiProvider: AiProvider
  storage: StorageAdapter
  screenCapture: ScreenCaptureAdapter | null
  storageKey: string
  agent: Required<BrowseAiCoreAgentOptions>
  watch: Required<BrowseAiCoreWatchOptions>
}

export const DEFAULT_FEATURES: BrowseAiCoreFeatures = {
  pageContext: true,
  imageInput: true,
  audioInput: true,
  screenCapture: true,
  formFiller: true,
  tablesExtractor: true,
  domToComponent: false,
  summarizer: true,
  translator: true,
  writer: true,
  rewriter: true,
  proofreader: true,
  imageDownloader: true,
  subjectFinder: true,
  selectionActions: true,
  bookmarks: false,
  linkInspector: true,
  replyDrafter: true,
  notes: true,
  reviewSummarizer: true,
  researchNotes: true,
  argumentMapper: true,
  formValidator: true,
  voiceInput: true,
  dictation: true,
  performanceExplainer: true,
  phishingCheck: true,
  darkPatternDetector: true,
  agentMode: true,
  watchMode: true,
  settings: true,
  personalization: true,
  appearance: true,
  markdown: true,
  contextUsage: true
}

const THEMES: readonly ThemeMode[] = ['light', 'dark', 'system']
const POSITIONS: readonly ChatPosition[] = [
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left'
]
const MODES: readonly ChatMode[] = ['floating', 'drawer', 'inline']
const CONTEXT_MODES: readonly ContextMode[] = ['page', 'general']
const CONFIRM_MODES: readonly AgentConfirmMode[] = ['risky', 'always', 'never']

export const DEFAULT_AGENT_OPTIONS: Required<BrowseAiCoreAgentOptions> = {
  maxSteps: 25,
  maxDurationMs: 300_000,
  confirm: 'risky',
  disabledTools: []
}

export const DEFAULT_WATCH_OPTIONS: Required<BrowseAiCoreWatchOptions> = {
  intervalMs: 15_000,
  threshold: 0.7
}

/** Shortest time between Watch Mode checks. */
export const MIN_WATCH_INTERVAL_MS = 5_000

const positive = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback

const pick = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/** Removes keys whose value is `undefined`, so they don't hide defaults. */
function defined<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>
}

let defaultAdapters:
  | {
      aiProvider: AiProvider
      storage: StorageAdapter
      screenCapture: ScreenCaptureAdapter | null
    }
  | undefined

/** Created once, so every resolved config shares the same default objects. */
function getDefaultAdapters(): NonNullable<typeof defaultAdapters> {
  defaultAdapters ??= {
    aiProvider: chromeLanguageModelProvider(),
    storage: defaultStorageAdapter(),
    screenCapture: defaultScreenCapture()
  }
  return defaultAdapters
}

/**
 * Merges configs from left to right over the defaults. Later configs win.
 * Nested `features`, `ai` and `strings` are merged key by key.
 */
export function resolveConfig(
  ...configs: (BrowseAiCoreConfig | undefined)[]
): ResolvedBrowseAiCoreConfig {
  const merged: BrowseAiCoreConfig = {}
  const features: Partial<BrowseAiCoreFeatures> = {}
  const ai: BrowseAiCoreAiOptions = {}
  const strings: Partial<BrowseAiCoreStrings> = {}
  const agent: BrowseAiCoreAgentOptions = {}
  const watch: BrowseAiCoreWatchOptions = {}

  for (const config of configs) {
    if (!config) continue
    Object.assign(merged, defined(config))
    Object.assign(features, defined(config.features))
    Object.assign(ai, defined(config.ai))
    Object.assign(strings, defined(config.strings))
    Object.assign(agent, defined(config.agent))
    Object.assign(watch, defined(config.watch))
  }

  return {
    theme: pick(THEMES, merged.theme, 'system'),
    palette: isPaletteName(merged.palette) ? merged.palette : 'indigo',
    position: pick(POSITIONS, merged.position, 'bottom-right'),
    mode: pick(MODES, merged.mode, 'floating'),
    defaultContextMode: pick(CONTEXT_MODES, merged.defaultContextMode, 'page'),
    features: { ...DEFAULT_FEATURES, ...features },
    ai: { outputLanguage: 'en', ...ai },
    strings: { ...DEFAULT_STRINGS, ...strings },
    aiProvider: merged.aiProvider ?? getDefaultAdapters().aiProvider,
    storage: merged.storage ?? getDefaultAdapters().storage,
    screenCapture:
      merged.screenCapture === undefined
        ? getDefaultAdapters().screenCapture
        : merged.screenCapture,
    storageKey: merged.storageKey ?? 'browse-ai-core',
    agent: {
      maxSteps: Math.round(
        positive(agent.maxSteps, DEFAULT_AGENT_OPTIONS.maxSteps)
      ),
      maxDurationMs: positive(
        agent.maxDurationMs,
        DEFAULT_AGENT_OPTIONS.maxDurationMs
      ),
      confirm: pick(
        CONFIRM_MODES,
        agent.confirm,
        DEFAULT_AGENT_OPTIONS.confirm
      ),
      disabledTools: Array.isArray(agent.disabledTools)
        ? agent.disabledTools.filter(
            (name) =>
              AGENT_TOOL_NAMES.includes(name) &&
              !REQUIRED_AGENT_TOOLS.includes(name)
          )
        : DEFAULT_AGENT_OPTIONS.disabledTools
    },
    watch: {
      intervalMs: Math.max(
        MIN_WATCH_INTERVAL_MS,
        positive(watch.intervalMs, DEFAULT_WATCH_OPTIONS.intervalMs)
      ),
      threshold:
        typeof watch.threshold === 'number' &&
        watch.threshold >= 0 &&
        watch.threshold <= 1
          ? watch.threshold
          : DEFAULT_WATCH_OPTIONS.threshold
    }
  }
}
