import { parseJsonFromModelResponse } from '../../ai/json-response'
import { diffLines, extractNumbers } from './watched-text'

/** Characters of each text version in the prompt. */
export const TEXT_BUDGET = 1_500
/** Characters of the changed lines in the prompt. */
export const DIFF_BUDGET = 1_000

export interface WatchCheck {
  instruction: string
  baseline: string
  previous: string
  current: string
  lang?: string
}

export interface WatchVerdict {
  matches: boolean
  confidence: number
  message: string
}

export const WATCH_SYSTEM_PROMPT =
  'You watch part of a web page for the user. You get the text of that part at different times and decide if the change is what the user asked to be told about. Answer only with JSON.'

const cut = (text: string): string =>
  text.length > TEXT_BUDGET ? `${text.slice(0, TEXT_BUDGET)}…` : text

const numbers = (text: string, lang?: string): string =>
  extractNumbers(text, lang).join(', ') || '(none)'

export function buildWatchPrompt(check: WatchCheck): string {
  const { instruction, baseline, previous, current, lang } = check
  return [
    `USER'S INSTRUCTION: ${instruction}`,
    `TEXT WHEN WATCHING STARTED: ${cut(baseline)}`,
    `TEXT AT THE LAST CHECK: ${cut(previous)}`,
    `TEXT NOW: ${cut(current)}`,
    'CHANGED LINES (- removed, + added):',
    diffLines(previous, current, DIFF_BUDGET) || '(none)',
    `NUMBERS AT THE LAST CHECK: ${numbers(previous, lang)}`,
    `NUMBERS NOW: ${numbers(current, lang)}`,
    'Does the text now match what the user asked to be told about? Compare with the last check for "changes" and with the start for "goes up/down by".',
    'Answer only with JSON: {"matches": true or false, "confidence": <0 to 1>, "message": "<one short sentence for the user about what changed>"}'
  ].join('\n')
}

export const WATCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: { type: 'boolean' },
    confidence: { type: 'number' },
    message: { type: 'string' }
  },
  required: ['matches', 'confidence', 'message']
}

/** Reads the model's verdict. Returns null when it is not valid JSON. */
export function parseWatchVerdict(answer: string): WatchVerdict | null {
  const json = parseJsonFromModelResponse(answer) as Record<
    string,
    unknown
  > | null
  if (!json || typeof json !== 'object') return null
  const matches = json['matches'] === true || json['matches'] === 'true'
  let confidence = Number(json['confidence'])
  if (!Number.isFinite(confidence)) confidence = matches ? 1 : 0
  if (confidence > 1 && confidence <= 100) confidence /= 100
  return {
    matches,
    confidence: Math.min(1, Math.max(0, confidence)),
    message: typeof json['message'] === 'string' ? json['message'].trim() : ''
  }
}
