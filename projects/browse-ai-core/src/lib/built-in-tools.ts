/**
 * Options for the tools that use Chrome's task APIs: Summarizer, Translator,
 * Writer, Rewriter and Proofreader. Each option is passed to the API's
 * `create()` call. Values left out use `DEFAULT_BUILT_IN_TOOLS`.
 */

export type BuiltInToolId =
  'summarizer' | 'translator' | 'writer' | 'rewriter' | 'proofreader'

export const BUILT_IN_TOOL_IDS: readonly BuiltInToolId[] = [
  'summarizer',
  'translator',
  'writer',
  'rewriter',
  'proofreader'
]

export interface SummarizerOptions {
  type?: 'tldr' | 'key-points' | 'teaser' | 'headline'
  format?: 'markdown' | 'plain-text'
  length?: 'short' | 'medium' | 'long'
  sharedContext?: string
}

export interface TranslatorOptions {
  /** Language the text is translated to. Default: `ai.outputLanguage`. */
  targetLanguage?: string
  /**
   * Language of the text. Default: detected with `LanguageDetector` when it
   * is ready, otherwise `en`.
   */
  sourceLanguage?: string
}

export interface WriterOptions {
  tone?: 'formal' | 'neutral' | 'casual'
  format?: 'markdown' | 'plain-text'
  length?: 'short' | 'medium' | 'long'
  sharedContext?: string
}

export interface RewriterOptions {
  tone?: 'more-formal' | 'as-is' | 'more-casual'
  format?: 'as-is' | 'markdown' | 'plain-text'
  length?: 'shorter' | 'as-is' | 'longer'
  sharedContext?: string
}

export interface ProofreaderOptions {
  expectedInputLanguages?: string[]
}

export interface BuiltInToolsOptions {
  summarizer?: SummarizerOptions
  translator?: TranslatorOptions
  writer?: WriterOptions
  rewriter?: RewriterOptions
  proofreader?: ProofreaderOptions
}

export const DEFAULT_BUILT_IN_TOOLS = {
  summarizer: { type: 'tldr', format: 'markdown', length: 'medium' },
  translator: {},
  writer: { tone: 'neutral', format: 'markdown', length: 'medium' },
  rewriter: { tone: 'as-is', format: 'as-is', length: 'as-is' },
  proofreader: { expectedInputLanguages: ['en'] }
} as const satisfies Required<BuiltInToolsOptions>

/** Target languages offered in the Translator picker (BCP 47 codes). */
export const TRANSLATOR_LANGUAGES: readonly string[] = [
  'ar',
  'bg',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'kn',
  'ko',
  'lt',
  'mr',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'vi',
  'zh',
  'zh-Hant'
]
