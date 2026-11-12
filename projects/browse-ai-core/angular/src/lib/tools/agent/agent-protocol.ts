import { parseJsonFromModelResponse } from '../../ai/json-response'
import type { AgentTool } from './agent-tools'

export interface AgentCall {
  thought: string
  tool: string
  args: Record<string, unknown>
}

export interface AgentStepRecord {
  step: number
  tool: string
  args: Record<string, unknown>
  /** `ok`, `error` or `denied`. */
  status: 'ok' | 'error' | 'denied'
  result: string
}

/** Saved notes kept in each prompt. */
export const MAX_MEMORY = 10
/** User updates kept in each prompt. */
export const MAX_UPDATES = 5
/** Steps kept in full when the history is sent again. */
export const FULL_STEPS = 5
const MAX_RESULT_CHARS = 1_500
/** Longest `thought` kept from an answer. */
export const MAX_THOUGHT = 200

/** Argument list as in 0.7.1: names, types or enum values, descriptions. */
function describeArgs(tool: AgentTool): string {
  const entries = Object.entries(tool.args)
  if (!entries.length) return '{}'
  return `{${entries
    .map(
      ([name, arg]) =>
        `"${name}"${arg.optional ? '?' : ''}: ${arg.enum ? arg.enum.map((value) => `"${value}"`).join('|') : arg.type} (${arg.description})`
    )
    .join(', ')}}`
}

/** Short argument list: names, `?` when optional, type or enum values. */
function describeArgsShort(tool: AgentTool): string {
  const entries = Object.entries(tool.args)
  if (!entries.length) return ''
  return ` {${entries
    .map(
      ([name, arg]) =>
        `${name}${arg.optional ? '?' : ''}:${arg.enum ? arg.enum.join('|') : arg.type}`
    )
    .join(', ')}}`
}

/** The first sentence of a tool description. */
const firstSentence = (text: string): string =>
  text.match(/^.*?[.!?](?=\s|$)/u)?.[0] ?? text

export interface SystemPromptOptions {
  /** One short line per tool (`AGENT_TUNING.shortToolLines`). */
  short?: boolean
  /** PAGE may list only changes (`AGENT_TUNING.pageDiffs`). */
  diffs?: boolean
}

/** System prompt with the rules and the tool list. Built once per run. */
export function buildAgentSystemPrompt(
  tools: readonly AgentTool[],
  options: SystemPromptOptions = {}
): string {
  const page = options.diffs
    ? [
        'Each step you get the task, the result of your last step and the PAGE. Each element has a number (ref) that stays the same for the whole task.',
        'PAGE lists all elements, or only the ones that changed since your last step.'
      ]
    : [
        'Each step you get the task, the result of your last step and the current page ELEMENTS. Each element has a number (ref).'
      ]
  const refRules = options.diffs
    ? [
        '- Use refs you have seen. A ref listed as gone no longer works.',
        '- One action per step. After acting, check the PAGE to see if it worked.'
      ]
    : [
        '- Use refs from the latest ELEMENTS list only.',
        '- One action per step. After acting, check the new ELEMENTS to see if it worked.'
      ]
  return [
    'You are an agent that does tasks on a web page for the user, one step at a time.',
    ...page,
    'Answer with ONE JSON object and nothing else: {"thought": "<short reason>", "tool": "<tool name>", "args": {…}}.',
    'Rules:',
    ...refRules,
    '- If something you need is not listed, scroll, use find_text, or take a screenshot.',
    '- After an action that loads content, use wait_for or wait_for_idle.',
    '- Use ask_user only when you cannot go on without the user.',
    '- USER UPDATES are messages the user sent while you work. They correct or change the task, or tell you how to get unstuck. Follow the newest one when they disagree with the task.',
    '- Call done when the task is finished, or fail when it cannot be done.',
    '- Never type passwords or card numbers.',
    ...(options.short
      ? [
          'TOOLS: name {args}: what it does (? = optional)',
          ...tools.map(
            (tool) =>
              `- ${tool.name}${describeArgsShort(tool)}: ${firstSentence(tool.description)}`
          )
        ]
      : [
          'TOOLS:',
          ...tools.map(
            (tool) =>
              `- ${tool.name} ${describeArgs(tool)}: ${tool.description}`
          )
        ])
  ].join('\n')
}

/** Loose JSON schema for `responseConstraint`: any args. */
export function agentResponseSchema(tools: readonly AgentTool[]): object {
  return {
    type: 'object',
    properties: {
      thought: { type: 'string' },
      tool: { type: 'string', enum: tools.map((tool) => tool.name) },
      args: { type: 'object' }
    },
    required: ['tool', 'args']
  }
}

/** Strict JSON schema: the args must match the chosen tool. */
export function agentToolSchema(tools: readonly AgentTool[]): object {
  return {
    anyOf: tools.map((tool) => {
      const args = Object.entries(tool.args)
      return {
        type: 'object',
        properties: {
          thought: { type: 'string', maxLength: MAX_THOUGHT },
          tool: { type: 'string', enum: [tool.name] },
          args: {
            type: 'object',
            properties: Object.fromEntries(
              args.map(([name, arg]) => [
                name,
                arg.enum
                  ? { type: 'string', enum: [...arg.enum] }
                  : { type: arg.type }
              ])
            ),
            required: args
              .filter(([, arg]) => !arg.optional)
              .map(([name]) => name)
          }
        },
        required: ['tool', 'args']
      }
    })
  }
}

const cut = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max)}…` : value

export function formatStep(record: AgentStepRecord, full: boolean): string {
  const args = JSON.stringify(record.args)
  const result = full
    ? cut(record.result, MAX_RESULT_CHARS)
    : cut(record.result.split('\n')[0] ?? '', 120)
  return `#${record.step} ${record.tool} ${cut(args, full ? 300 : 80)} -> ${record.status}: ${result}`
}

/**
 * The prompt of one step. With a fresh session (`recap`), earlier steps are
 * listed: the last `FULL_STEPS` in full, older ones on one line each.
 */
export function buildStepPrompt(options: {
  task: string
  page: string
  steps: AgentStepRecord[]
  recap: boolean
  note?: string
  hasImage?: boolean
  /** Instructions the user sent during the run, oldest first. */
  updates?: string[]
  /** The newest update was not sent to the model yet. */
  newUpdate?: boolean
  /** Notes the agent saved with `remember`. */
  memory?: string[]
}): string {
  const { task, page, steps, recap, note, hasImage } = options
  const updates = (options.updates ?? []).slice(-MAX_UPDATES)
  const last = steps[steps.length - 1]
  const history = recap
    ? steps.map((record, index) =>
        formatStep(record, index >= steps.length - FULL_STEPS)
      )
    : last
      ? [formatStep(last, true)]
      : []
  return [
    `TASK: ${task}`,
    ...(history.length
      ? [recap ? 'STEPS SO FAR:' : 'LAST STEP:', ...history]
      : ['This is the first step.']),
    ...(updates.length
      ? [
          'USER UPDATES (newest last):',
          ...updates.map((update) => `- ${cut(update, 500)}`),
          ...(options.newUpdate
            ? ['The newest update is new. Change your plan to follow it now.']
            : [])
        ]
      : []),
    ...(options.memory?.length
      ? [
          'YOUR SAVED NOTES:',
          ...options.memory.slice(-MAX_MEMORY).map((entry) => `- ${entry}`)
        ]
      : []),
    ...(note ? [`NOTE: ${note}`] : []),
    ...(hasImage
      ? [
          'A screenshot of the screen is attached. Numbers on it are element refs.'
        ]
      : []),
    'PAGE:',
    page,
    'Answer with one JSON object for the next step.'
  ].join('\n')
}

function checkType(value: unknown, type: string): boolean {
  if (type === 'number')
    return (
      typeof value === 'number' ||
      (typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isFinite(Number(value)))
    )
  if (type === 'object')
    return (
      (typeof value === 'object' && !Array.isArray(value)) ||
      (typeof value === 'string' && value.trim().startsWith('{'))
    )
  return typeof value === type
}

/** Reads one tool call and checks it against the tool list. */
export function parseAgentCall(
  answer: string,
  tools: readonly AgentTool[]
): AgentCall | { error: string } {
  const json =
    parseJsonFromModelResponse(answer) ??
    parseJsonFromModelResponse(
      answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1)
    )
  if (!json || typeof json !== 'object' || Array.isArray(json))
    return { error: 'The answer was not one JSON object.' }
  const record = json as Record<string, unknown>
  const name = typeof record['tool'] === 'string' ? record['tool'].trim() : ''
  const tool = tools.find((entry) => entry.name === name)
  if (!tool)
    return {
      error: `Unknown tool "${name}". Use one of: ${tools.map((entry) => entry.name).join(', ')}.`
    }
  const args =
    record['args'] &&
    typeof record['args'] === 'object' &&
    !Array.isArray(record['args'])
      ? (record['args'] as Record<string, unknown>)
      : {}
  for (const [key, arg] of Object.entries(tool.args)) {
    const value = args[key]
    if (value === undefined || value === null || value === '') {
      if (!arg.optional) return { error: `${name} needs "${key}".` }
      continue
    }
    if (!checkType(value, arg.type))
      return { error: `"${key}" of ${name} must be a ${arg.type}.` }
    if (arg.enum && !arg.enum.includes(String(value)))
      return { error: `"${key}" must be one of ${arg.enum.join(', ')}.` }
  }
  return {
    thought:
      typeof record['thought'] === 'string'
        ? record['thought'].slice(0, MAX_THOUGHT)
        : '',
    tool: name,
    args
  }
}
