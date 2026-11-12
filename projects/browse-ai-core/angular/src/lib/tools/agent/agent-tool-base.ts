import { ActionError } from './page-actions'
import { RefMap, isOffLimits } from './page-snapshot'

export interface AgentToolContext {
  doc: Document
  host: HTMLElement | null
  refs: RefMap
  signal: AbortSignal
  /** Takes a screenshot that is sent with the next step. */
  screenshot: () => Promise<void>
  /** Shows a question and resolves with the user's answer. */
  askUser: (question: string) => Promise<string>
  /** Posts a message in the chat. */
  notify: (text: string) => void
  /** Saves a note that is sent with every later step. */
  remember: (note: string) => void
  /** Opens a URL in a new tab. `blocked` when the browser stopped it. */
  openTab: (url: string, active: boolean) => Promise<'opened' | 'blocked'>
  /** Words that make a button risky (`agentRiskWords`). */
  riskWords?: readonly string[]
}

/** `object` is a JSON object; a JSON string is accepted too. */
export type ArgType = 'string' | 'number' | 'boolean' | 'object'

export interface AgentArg {
  type: ArgType
  description: string
  optional?: boolean
  enum?: readonly string[]
}

export interface AgentTool {
  name: string
  description: string
  args: Record<string, AgentArg>
  /** Acts on the page; the runner waits for the page to settle after it. */
  changesPage?: boolean
  run: (
    args: Record<string, unknown>,
    context: AgentToolContext
  ) => Promise<string> | string
}

export const MAX_WAIT_MS = 10_000
export const MAX_WAIT_FOR_MS = 30_000
export const DEFAULT_WAIT_FOR_MS = 5_000
export const MAX_QUERY = 20
export const MAX_READ = 2_000

export const ref: AgentArg = {
  type: 'number',
  description: 'element number from ELEMENTS'
}

/** The element for `args.ref`, or an error the model can act on. */
export function target(
  args: Record<string, unknown>,
  context: AgentToolContext
): Element {
  const element = context.refs.get(Number(args['ref']))
  if (!element)
    throw new ActionError(
      `Element ${String(args['ref'])} is gone or unknown. Use the latest ELEMENTS list.`
    )
  if (isOffLimits(element, context.host))
    throw new ActionError(
      'This element is off limits (password, card or the chat).'
    )
  return element
}

export const text = (value: unknown, max = 120): string =>
  String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, max)

export const clamp = (
  value: unknown,
  fallback: number,
  max: number
): number => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0
    ? Math.min(number, max)
    : fallback
}
