import {
  ActionError,
  clickElement,
  hoverElement,
  pressKey,
  scrollPage,
  selectOption,
  setChecked,
  typeText
} from './page-actions'
import {
  RefMap,
  describeForModel,
  formatSnapshot,
  isOffLimits,
  takeSnapshot,
  walkElements
} from './page-snapshot'
import { sleep, waitFor, waitForIdle } from './page-waits'
import {
  AgentTool,
  AgentToolContext,
  DEFAULT_WAIT_FOR_MS,
  MAX_QUERY,
  MAX_READ,
  MAX_WAIT_FOR_MS,
  MAX_WAIT_MS,
  clamp,
  ref,
  target,
  text
} from './agent-tool-base'
import { EXTRA_AGENT_TOOLS } from './agent-tools-extra'
import { MORE_AGENT_TOOLS } from './agent-tools-more'

export type { AgentArg, AgentTool, AgentToolContext } from './agent-tool-base'
export { MAX_WAIT_FOR_MS, MAX_WAIT_MS, target } from './agent-tool-base'

function query(
  context: AgentToolContext,
  selector: string,
  limit: number
): string {
  let matches: Element[]
  try {
    matches = [...context.doc.querySelectorAll(selector)]
  } catch {
    throw new ActionError(`"${selector}" is not a valid CSS selector.`)
  }
  const lines = matches
    .filter((element) => !isOffLimits(element, context.host))
    .slice(0, limit)
    .map((element) => describeForModel(context.refs.add(element), element))
  return lines.length
    ? `${matches.length} match(es):\n${lines.join('\n')}`
    : 'No matches.'
}

function findText(context: AgentToolContext, wanted: string): string {
  const needle = wanted.toLowerCase()
  const hits: Element[] = []
  for (const element of walkElements(context.doc)) {
    if (hits.length >= MAX_QUERY) break
    if (isOffLimits(element, context.host)) continue
    const own = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
    const label = element.getAttribute('aria-label') ?? ''
    if (`${own} ${label}`.toLowerCase().includes(needle)) hits.push(element)
  }
  const lines = hits.map((element) =>
    describeForModel(context.refs.add(element), element)
  )
  return lines.length ? lines.join('\n') : `No element contains "${wanted}".`
}

function textOrSelectorCheck(
  context: AgentToolContext,
  args: Record<string, unknown>
): () => boolean {
  const selector = typeof args['selector'] === 'string' ? args['selector'] : ''
  const wanted =
    typeof args['text'] === 'string' ? args['text'].toLowerCase() : ''
  if (!selector && !wanted) throw new ActionError('Give "selector" or "text".')
  return () => {
    if (selector) {
      try {
        return context.doc.querySelector(selector) !== null
      } catch {
        throw new ActionError(`"${selector}" is not a valid CSS selector.`)
      }
    }
    return (context.doc.body?.innerText ?? context.doc.body?.textContent ?? '')
      .toLowerCase()
      .includes(wanted)
  }
}

/** Every tool the model can call, in the order shown in the prompt. */
export const AGENT_TOOLS: readonly AgentTool[] = [
  {
    name: 'get_page_state',
    description:
      'List the visible elements again (sent automatically each step).',
    args: {},
    run: (_, context) =>
      formatSnapshot(takeSnapshot(context.doc, context.host, context.refs))
  },
  {
    name: 'screenshot',
    description:
      'See the screen. The image comes with the next step, with element numbers drawn on it.',
    args: {},
    run: async (_, context) => {
      await context.screenshot()
      return 'Screenshot taken. It is attached to the next step.'
    }
  },
  {
    name: 'query_selector',
    description: 'Find elements by CSS selector.',
    args: {
      selector: { type: 'string', description: 'CSS selector' },
      limit: {
        type: 'number',
        description: `max results, up to ${MAX_QUERY}`,
        optional: true
      }
    },
    run: (args, context) =>
      query(
        context,
        text(args['selector'], 300),
        clamp(args['limit'], 10, MAX_QUERY)
      )
  },
  {
    name: 'find_text',
    description: 'Find elements that contain some text.',
    args: { text: { type: 'string', description: 'text to look for' } },
    run: (args, context) => findText(context, text(args['text'], 200))
  },
  {
    name: 'read_element',
    description: 'Read the text of an element.',
    args: {
      ref,
      maxChars: {
        type: 'number',
        description: `up to ${MAX_READ}`,
        optional: true
      }
    },
    run: (args, context) => {
      const element = target(args, context)
      const content = (
        (element as HTMLElement).innerText ||
        element.textContent ||
        ''
      )
        .replace(/\s+/gu, ' ')
        .trim()
      return (
        content.slice(0, clamp(args['maxChars'], 800, MAX_READ)) || '(no text)'
      )
    }
  },
  {
    name: 'click',
    description: 'Click an element.',
    args: { ref },
    changesPage: true,
    run: (args, context) => {
      clickElement(target(args, context))
      return 'Clicked.'
    }
  },
  {
    name: 'type_text',
    description:
      'Type into a text field. Replaces the value unless clear is false. submit presses Enter.',
    args: {
      ref,
      text: { type: 'string', description: 'text to type' },
      clear: {
        type: 'boolean',
        description: 'replace the current value (default true)',
        optional: true
      },
      submit: {
        type: 'boolean',
        description: 'press Enter after typing',
        optional: true
      }
    },
    changesPage: true,
    run: (args, context) => {
      const element = target(args, context)
      const submit = args['submit'] === true
      const value = typeText(element, String(args['text'] ?? ''), {
        clear: args['clear'] !== false,
        submit
      })
      // Small models stop here and expect the search to run.
      const notSent =
        !submit && element instanceof HTMLInputElement
          ? ' Nothing is sent yet. To search or send it, call press_key with key Enter, or click the search or submit button.'
          : ''
      return `Field value is now "${text(value, 80)}".${notSent}`
    }
  },
  {
    name: 'select_option',
    description: 'Choose an option in a select by its value or label.',
    args: {
      ref,
      value: { type: 'string', description: 'option value or label' }
    },
    changesPage: true,
    run: (args, context) =>
      `Selected "${selectOption(target(args, context), String(args['value'] ?? ''))}".`
  },
  {
    name: 'set_checked',
    description: 'Check or uncheck a checkbox, radio or switch.',
    args: { ref, checked: { type: 'boolean', description: 'true to check' } },
    changesPage: true,
    run: (args, context) =>
      setChecked(target(args, context), args['checked'] !== false)
        ? 'Now checked.'
        : 'Now unchecked.'
  },
  {
    name: 'press_key',
    description:
      'Press a key (Enter, Escape, Tab, ArrowDown, PageDown…) on an element or the focused element.',
    args: {
      key: { type: 'string', description: 'key name' },
      ref: { ...ref, optional: true }
    },
    changesPage: true,
    run: (args, context) => {
      const element =
        args['ref'] !== undefined
          ? target(args, context)
          : (context.doc.activeElement ?? context.doc.body)
      if (isOffLimits(element, context.host))
        throw new ActionError('The focus is in the chat. Give a ref.')
      pressKey(element, text(args['key'], 20) || 'Enter')
      return 'Key pressed.'
    }
  },
  {
    name: 'hover',
    description: 'Move the mouse over an element, for example to open a menu.',
    args: { ref },
    changesPage: true,
    run: (args, context) => {
      hoverElement(target(args, context))
      return 'Hovering.'
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page, or scroll an element into view with ref.',
    args: {
      direction: {
        type: 'string',
        description: 'up, down, top or bottom',
        enum: ['up', 'down', 'top', 'bottom']
      },
      amount: {
        type: 'number',
        description: 'screens to scroll, default 0.8',
        optional: true
      },
      ref: { ...ref, optional: true }
    },
    changesPage: true,
    run: (args, context) => {
      const element = args['ref'] !== undefined ? target(args, context) : null
      const direction =
        (['up', 'down', 'top', 'bottom'] as const).find(
          (entry) => entry === args['direction']
        ) ?? 'down'
      const result = scrollPage(
        context.doc,
        direction,
        Number(args['amount']) || 0.8,
        element
      )
      return `Scrolled to ${result.scrollY}.${result.atEnd ? ' This is the end of the page.' : ''}`
    }
  },
  {
    name: 'go_back',
    description:
      'Go to the previous page in history. Ends the task when the page reloads.',
    args: {},
    changesPage: true,
    run: (_, context) => {
      context.doc.defaultView?.history.back()
      return 'Went back.'
    }
  },
  {
    name: 'go_forward',
    description: 'Go forward in history.',
    args: {},
    changesPage: true,
    run: (_, context) => {
      context.doc.defaultView?.history.forward()
      return 'Went forward.'
    }
  },
  ...MORE_AGENT_TOOLS,
  ...EXTRA_AGENT_TOOLS,
  {
    name: 'wait',
    description: `Wait some milliseconds (up to ${MAX_WAIT_MS}).`,
    args: { ms: { type: 'number', description: 'milliseconds' } },
    run: async (args, context) => {
      const ms = clamp(args['ms'], 1000, MAX_WAIT_MS)
      await sleep(ms, context.signal)
      return `Waited ${ms} ms.`
    }
  },
  {
    name: 'wait_for',
    description:
      'Wait until a selector or text appears (state visible) or disappears (state hidden).',
    args: {
      selector: { type: 'string', description: 'CSS selector', optional: true },
      text: { type: 'string', description: 'text on the page', optional: true },
      state: {
        type: 'string',
        description: 'visible or hidden',
        enum: ['visible', 'hidden'],
        optional: true
      },
      timeoutMs: {
        type: 'number',
        description: `default ${DEFAULT_WAIT_FOR_MS}, up to ${MAX_WAIT_FOR_MS}`,
        optional: true
      }
    },
    run: async (args, context) =>
      waitFor({
        doc: context.doc,
        check: textOrSelectorCheck(context, args),
        state: args['state'] === 'hidden' ? 'hidden' : 'visible',
        timeoutMs: clamp(
          args['timeoutMs'],
          DEFAULT_WAIT_FOR_MS,
          MAX_WAIT_FOR_MS
        ),
        signal: context.signal
      })
  },
  {
    name: 'wait_for_idle',
    description: 'Wait until the page stops changing and loading.',
    args: {
      timeoutMs: {
        type: 'number',
        description: `default ${DEFAULT_WAIT_FOR_MS}, up to ${MAX_WAIT_FOR_MS}`,
        optional: true
      }
    },
    run: (args, context) =>
      waitForIdle(
        context.doc,
        clamp(args['timeoutMs'], DEFAULT_WAIT_FOR_MS, MAX_WAIT_FOR_MS),
        context.signal
      )
  },
  {
    name: 'ask_user',
    description:
      'Ask the user a question when the task is unclear or needs their choice.',
    args: { question: { type: 'string', description: 'the question' } },
    run: (args, context) => context.askUser(text(args['question'], 300))
  },
  {
    name: 'done',
    description: 'The task is finished. Say what was done.',
    args: {
      summary: { type: 'string', description: 'short summary for the user' }
    },
    run: (args) => text(args['summary'], 600)
  },
  {
    name: 'fail',
    description: 'The task cannot be done. Say why.',
    args: { reason: { type: 'string', description: 'short reason' } },
    run: (args) => text(args['reason'], 600)
  }
]

/**
 * Tools for this run. `screenshot` is left out without screen capture, and
 * `disabled` tools are left out (`done` and `fail` always stay).
 */
export function agentTools(
  withScreenshots: boolean,
  disabled: readonly string[] = []
): readonly AgentTool[] {
  return AGENT_TOOLS.filter(
    (tool) =>
      (withScreenshots || tool.name !== 'screenshot') &&
      (tool.name === 'done' ||
        tool.name === 'fail' ||
        !disabled.includes(tool.name))
  )
}
