import { isTextField } from '../../page/insert-text'
import {
  AgentTool,
  AgentToolContext,
  DEFAULT_WAIT_FOR_MS,
  MAX_QUERY,
  MAX_READ,
  MAX_WAIT_FOR_MS,
  clamp,
  ref,
  target,
  text
} from './agent-tool-base'
import { clickElement, rightClickElement, setValue } from './page-actions'
import { listImages, matchImages } from './page-images'
import { findListItems, readItems, sortItems } from './page-lists'
import { closeButtonOf, findOverlay, isGone } from './page-overlays'
import { isOffLimits, nameOf } from './page-snapshot'
import { sleep, waitForUrl } from './page-waits'
import { riskOf } from './risk-check'

/** Characters of one `extract_list` answer. */
const MAX_LIST_CHARS = 2_500
/** Time for a pop-up to close after the click, in ms. */
const CLOSE_WAIT_MS = 300

function imagesResult(
  args: Record<string, unknown>,
  context: AgentToolContext
): string {
  const limit = clamp(args['limit'], 10, MAX_QUERY)
  const wanted = typeof args['text'] === 'string' ? args['text'] : ''
  const hits = matchImages(listImages(context.doc, context.host), wanted)
  if (!hits.length)
    return `${wanted ? `No image matches "${wanted}".` : 'No images found.'} Scroll and try again, or take a screenshot.`
  const lines = hits
    .slice(0, limit)
    .map(
      (hit) =>
        `[${context.refs.add(hit.element)}] image "${hit.label}" ${hit.width}x${hit.height} ${hit.place}`
    )
  return `${hits.length} image(s):\n${lines.join('\n')}`
}

function listResult(
  args: Record<string, unknown>,
  context: AgentToolContext
): string {
  const from = args['ref'] !== undefined ? target(args, context) : null
  const found = findListItems(context.doc, context.host, from)
  if (!found.length)
    return from
      ? 'No repeated items around this element. Give the ref of the list or of one item.'
      : 'No list of repeated items found on the page.'
  const by =
    args['sortBy'] === 'rating'
      ? 'rating'
      : args['sortBy'] === 'price'
        ? 'price'
        : null
  const order = args['order'] === 'desc' ? 'desc' : 'asc'
  const all = readItems(found)
  const items = by ? sortItems(all, by, order) : all
  const limit = clamp(args['limit'], 10, MAX_QUERY)
  const lines: string[] = []
  let size = 0
  for (const item of items.slice(0, limit)) {
    const line = [
      `[${context.refs.add(item.element)}] "${item.title}"`,
      item.price ? `${item.price.amount} ${item.price.currency}`.trim() : '',
      item.rating !== null ? `rating ${item.rating}` : '',
      item.href ? `href=${item.href}` : ''
    ]
      .filter(Boolean)
      .join(' ')
    if (size + line.length > MAX_LIST_CHARS) break
    lines.push(line)
    size += line.length + 1
  }
  const container = found[0].parentElement
  const height = context.doc.defaultView?.innerHeight ?? 800
  const tall = (container?.getBoundingClientRect().height ?? 0) > height
  const sorted = by
    ? `, by ${by} ${order === 'asc' ? 'low to high' : 'high to low'}`
    : ''
  return [
    `${found.length} items${sorted}, showing ${lines.length}:`,
    ...lines,
    ...(tall ? ['Scroll for more items.'] : [])
  ].join('\n')
}

function selectionResult(context: AgentToolContext): string {
  const nothing = 'Nothing is selected.'
  const active = context.doc.activeElement
  if (
    active &&
    isTextField(active) &&
    (active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement)
  ) {
    const start = active.selectionStart ?? 0
    const end = active.selectionEnd ?? 0
    if (end > start && !isOffLimits(active, context.host))
      return `Selected in [${context.refs.add(active)}]: "${active.value.slice(start, end).slice(0, MAX_READ)}"`
  }
  const selection = context.doc.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount)
    return nothing
  const node = selection.getRangeAt(0).commonAncestorContainer
  const element = node instanceof Element ? node : node.parentElement
  if (!element || isOffLimits(element, context.host)) return nothing
  const selected = selection.toString().trim()
  if (!selected) return nothing
  return `Selected in [${context.refs.add(element)}]: "${selected.slice(0, MAX_READ)}"`
}

async function closeOverlay(context: AgentToolContext): Promise<string> {
  const words = context.riskWords ?? []
  const overlay = findOverlay(context.doc, context.host, words)
  if (!overlay) return 'No pop-up found.'
  const safe = (button: Element): boolean =>
    riskOf('click', button, context.doc, 'risky', words) === null
  const button = closeButtonOf(overlay, words, safe)
  let did: string
  if (button) {
    clickElement(button)
    did = `Clicked "${text(nameOf(button), 60)}"`
  } else {
    const View = (context.doc.defaultView ??
      window) as unknown as typeof globalThis
    const init = {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    }
    overlay.dispatchEvent(new View.KeyboardEvent('keydown', init))
    overlay.dispatchEvent(new View.KeyboardEvent('keyup', init))
    if (overlay instanceof HTMLDialogElement && overlay.open) {
      const cancel = new Event('cancel', { cancelable: true })
      if (overlay.dispatchEvent(cancel)) overlay.close()
    }
    did = 'Pressed Escape (no close button)'
  }
  await sleep(CLOSE_WAIT_MS, context.signal)
  return isGone(overlay)
    ? `${did}. The pop-up is gone.`
    : `${did}. The pop-up is still there; look for its close button in ELEMENTS.`
}

/** Tools added in T-018: images, lists, special inputs, pop-ups, addresses. */
export const EXTRA_AGENT_TOOLS: readonly AgentTool[] = [
  {
    name: 'find_images',
    description: 'Find images by alt text, caption or file name.',
    args: {
      text: {
        type: 'string',
        description: 'what it shows',
        optional: true
      },
      limit: { type: 'number', description: `max ${MAX_QUERY}`, optional: true }
    },
    run: imagesResult
  },
  {
    name: 'extract_list',
    description: 'Read a product or result list: title, price, rating, link.',
    args: {
      ref: {
        ...ref,
        description: 'list or item',
        optional: true
      },
      sortBy: {
        type: 'string',
        description: 'sort',
        enum: ['price', 'rating'],
        optional: true
      },
      order: {
        type: 'string',
        description: 'asc: low first',
        enum: ['asc', 'desc'],
        optional: true
      },
      limit: { type: 'number', description: `max ${MAX_QUERY}`, optional: true }
    },
    run: listResult
  },
  {
    name: 'read_selection',
    description: 'Read the text the user selected on the page.',
    args: {},
    run: (_, context) => selectionResult(context)
  },
  {
    name: 'set_value',
    description: 'Set a date, time, range or color input.',
    args: {
      ref,
      value: {
        type: 'string',
        description: 'e.g. 2026-03-31'
      }
    },
    changesPage: true,
    run: (args, context) =>
      `Set to ${setValue(target(args, context), String(args['value'] ?? ''))}.`
  },
  {
    name: 'close_overlay',
    description: 'Close the top pop-up or cookie banner. Never accepts.',
    args: {},
    changesPage: true,
    run: (_, context) => closeOverlay(context)
  },
  {
    name: 'right_click',
    description: 'Right-click to open a page menu.',
    args: { ref },
    changesPage: true,
    run: (args, context) => {
      rightClickElement(target(args, context))
      return 'Right-clicked. Look for the menu in ELEMENTS.'
    }
  },
  {
    name: 'wait_for_url',
    description: 'Wait for the address to change.',
    args: {
      contains: {
        type: 'string',
        description: 'part of it',
        optional: true
      },
      timeoutMs: {
        type: 'number',
        description: `default ${DEFAULT_WAIT_FOR_MS}`,
        optional: true
      }
    },
    run: async (args, context) => {
      const result = await waitForUrl(
        context.doc,
        typeof args['contains'] === 'string' ? args['contains'] : '',
        clamp(args['timeoutMs'], DEFAULT_WAIT_FOR_MS, MAX_WAIT_FOR_MS),
        context.signal
      )
      return result === 'timeout' ? 'timeout' : `Address is now ${result}`
    }
  }
]
