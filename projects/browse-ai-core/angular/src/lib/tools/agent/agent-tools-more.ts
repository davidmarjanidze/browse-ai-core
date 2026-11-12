import { isOpenableUrl } from 'browse-ai-core'
import { flashElement } from './agent-screen'
import {
  AgentTool,
  AgentToolContext,
  clamp,
  ref,
  target,
  text
} from './agent-tool-base'
import {
  ActionError,
  bringIntoView,
  clickElement,
  selectOption,
  setChecked,
  typeText
} from './page-actions'
import { nameOf } from './page-snapshot'

/** Characters of page text returned by one `read_page_text` call. */
export const PAGE_TEXT_CHUNK = 3_000
const MAX_TABLE_ROWS = 30
const MAX_FORM_FIELDS = 15

/** An object argument, also when the model sent it as a JSON string. */
/**
 * The ref for a `fill_form` key. Small models often use the field's label
 * instead of its number, so a label that matches one listed field works too.
 */
export function refFor(key: string, context: AgentToolContext): number {
  const number = Number(key.replace(/^\[|\]$/gu, ''))
  if (Number.isFinite(number) && key.trim() !== '') return number
  const wanted = key.trim().toLowerCase()
  const entries = context.refs.entries()
  const exact = entries.find(
    ([, element]) => nameOf(element).toLowerCase() === wanted
  )
  const partial = entries.filter(([, element]) =>
    nameOf(element).toLowerCase().includes(wanted)
  )
  const found = exact ?? (partial.length === 1 ? partial[0] : undefined)
  if (!found)
    throw new ActionError(
      `No single listed field is called "${key}". Use its ref number.`
    )
  return found[0]
}

export function objectArg(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, unknown>
    } catch {
      // Falls through to the error below.
    }
  }
  throw new ActionError('Expected a JSON object.')
}

/** The link URL of an element (or its closest link), or the `url` argument. */
function linkUrl(
  args: Record<string, unknown>,
  context: AgentToolContext
): string {
  if (typeof args['url'] === 'string' && args['url'].trim()) {
    try {
      return new URL(args['url'].trim(), context.doc.baseURI).href
    } catch {
      throw new ActionError(`"${args['url']}" is not a valid address.`)
    }
  }
  if (args['ref'] === undefined) throw new ActionError('Give "ref" or "url".')
  const link = target(args, context).closest('a[href]')
  if (!(link instanceof HTMLAnchorElement))
    throw new ActionError('The element is not a link. Give "url" instead.')
  return link.href
}

/** The element itself or the closest ancestor that can scroll. */
function scrollableFrom(element: Element): Element | null {
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const style = current.ownerDocument.defaultView?.getComputedStyle(current)
    const scrollsY =
      /(auto|scroll)/u.test(style?.overflowY ?? '') &&
      current.scrollHeight > current.clientHeight
    const scrollsX =
      /(auto|scroll)/u.test(style?.overflowX ?? '') &&
      current.scrollWidth > current.clientWidth
    if (scrollsY || scrollsX) return current
  }
  return null
}

function tableText(table: HTMLTableElement): string {
  const rows = [...table.rows].slice(0, MAX_TABLE_ROWS)
  const lines = rows.map((row) =>
    [...row.cells].map((cell) => text(cell.textContent, 60)).join(' | ')
  )
  const more = table.rows.length - rows.length
  return `${lines.join('\n')}${more > 0 ? `\n(${more} more rows)` : ''}`
}

/** Tools added in T-009: tabs, reading, scrolling inside, forms, notes. */
export const MORE_AGENT_TOOLS: readonly AgentTool[] = [
  {
    name: 'open_in_new_tab',
    description:
      'Open a link (ref) or an address (url) in a new tab. This page stays open and you keep working here.',
    args: {
      ref: { ...ref, optional: true },
      url: {
        type: 'string',
        description: 'http or https address',
        optional: true
      },
      switchTo: {
        type: 'boolean',
        description: 'show the new tab to the user (default false)',
        optional: true
      }
    },
    run: async (args, context) => {
      const url = linkUrl(args, context)
      if (!isOpenableUrl(url))
        throw new ActionError('Only http and https links can be opened.')
      const result = await context.openTab(url, args['switchTo'] === true)
      if (result === 'opened') return `Opened ${url} in a new tab.`
      context.notify(`[${url}](${url})`)
      return 'The browser blocked the new tab. The link was posted in the chat for the user.'
    }
  },
  {
    name: 'read_page_text',
    description: `Read the visible text of the whole page, ${PAGE_TEXT_CHUNK} characters at a time. Use offset to read further.`,
    args: {
      offset: {
        type: 'number',
        description: 'start position, default 0',
        optional: true
      }
    },
    run: (args, context) => {
      const all = (
        context.doc.body?.innerText ||
        context.doc.body?.textContent ||
        ''
      )
        .replace(/\s+/gu, ' ')
        .trim()
      const offset = Math.max(0, Math.floor(Number(args['offset']) || 0))
      const part = all.slice(offset, offset + PAGE_TEXT_CHUNK)
      if (!part)
        return `(no text at offset ${offset}; the page has ${all.length} characters)`
      const end = offset + part.length
      return `${part}\n(${end} of ${all.length} characters${end < all.length ? `; next offset ${end}` : ''})`
    }
  },
  {
    name: 'read_table',
    description:
      'Read a table as rows. Give ref (any element in the table) or index (0 = first table on the page).',
    args: {
      ref: { ...ref, optional: true },
      index: {
        type: 'number',
        description: 'table number on the page, from 0',
        optional: true
      }
    },
    run: (args, context) => {
      const tables = [...context.doc.querySelectorAll('table')]
      const table =
        args['ref'] !== undefined
          ? target(args, context).closest('table')
          : (tables[Math.max(0, Math.floor(Number(args['index']) || 0))] ??
            null)
      if (!table)
        return tables.length
          ? `No such table. The page has ${tables.length} table(s).`
          : 'The page has no tables.'
      return tableText(table)
    }
  },
  {
    name: 'scroll_inside',
    description:
      'Scroll inside a scrollable box (a list, a menu, a dialog) that contains the element.',
    args: {
      ref,
      direction: {
        type: 'string',
        description: 'up, down, left or right',
        enum: ['up', 'down', 'left', 'right']
      },
      amount: {
        type: 'number',
        description: 'boxes to scroll, default 0.8',
        optional: true
      }
    },
    changesPage: true,
    run: (args, context) => {
      const box = scrollableFrom(target(args, context))
      if (!box)
        throw new ActionError(
          'No scrollable box around this element. Use scroll for the page.'
        )
      const amount = clamp(args['amount'], 0.8, 3)
      const direction = String(args['direction'])
      const vertical = direction === 'up' || direction === 'down'
      const sign = direction === 'up' || direction === 'left' ? -1 : 1
      const by =
        Math.round((vertical ? box.clientHeight : box.clientWidth) * amount) *
        sign
      box.scrollBy?.(vertical ? { top: by } : { left: by })
      const atEnd = vertical
        ? sign > 0
          ? box.scrollTop + box.clientHeight >= box.scrollHeight - 2
          : box.scrollTop <= 0
        : sign > 0
          ? box.scrollLeft + box.clientWidth >= box.scrollWidth - 2
          : box.scrollLeft <= 0
      return `Scrolled inside the box.${atEnd ? ' This is the end of the box.' : ''}`
    }
  },
  {
    name: 'double_click',
    description: 'Double-click an element.',
    args: { ref },
    changesPage: true,
    run: (args, context) => {
      const element = target(args, context)
      clickElement(element)
      clickElement(element)
      const View = (context.doc.defaultView ??
        window) as unknown as typeof globalThis
      element.dispatchEvent(
        new View.MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          detail: 2
        })
      )
      return 'Double-clicked.'
    }
  },
  {
    name: 'fill_form',
    description: `Fill several fields in one step: {"fields": {"<ref>": "<value>", …}} (up to ${MAX_FORM_FIELDS}). Text fields get the text, selects pick the option, checkboxes take true or false. Does not submit.`,
    args: { fields: { type: 'object', description: 'ref to value' } },
    changesPage: true,
    run: (args, context) => {
      const entries = Object.entries(objectArg(args['fields'])).slice(
        0,
        MAX_FORM_FIELDS
      )
      if (!entries.length) throw new ActionError('"fields" is empty.')
      const results = entries.map(([key, value]) => {
        try {
          const element = target({ ref: refFor(key, context) }, context)
          const label = nameOf(element) || `[${key}]`
          if (element instanceof HTMLSelectElement)
            return {
              ok: true,
              text: `${label}: selected "${selectOption(element, String(value))}"`
            }
          if (
            element instanceof HTMLInputElement &&
            (element.type === 'checkbox' || element.type === 'radio')
          ) {
            const on =
              value === true ||
              /^(true|yes|on|1|checked)$/iu.test(String(value))
            return {
              ok: true,
              text: `${label}: ${setChecked(element, on) ? 'checked' : 'unchecked'}`
            }
          }
          typeText(element, String(value ?? ''))
          return { ok: true, text: `${label}: filled` }
        } catch (error) {
          return {
            ok: false,
            text: `[${key}]: error: ${error instanceof Error ? error.message : String(error)}`
          }
        }
      })
      const report = results.map((result) => result.text).join('\n')
      if (!results.some((result) => result.ok))
        throw new ActionError(
          `No field was filled. Use ref numbers from ELEMENTS as keys, e.g. {"fields": {"12": "Ana"}}.\n${report}`
        )
      return report
    }
  },
  {
    name: 'show_user',
    description:
      'Point out an element to the user: scroll to it, outline it, and post a short message in the chat.',
    args: {
      ref,
      message: { type: 'string', description: 'what to tell the user about it' }
    },
    run: (args, context) => {
      const element = target(args, context)
      bringIntoView(element)
      const color = context.host
        ? getComputedStyle(context.host)
            .getPropertyValue('--bac-primary')
            .trim()
        : ''
      flashElement(context.doc, element, color || '#2563eb', 4000)
      context.notify(text(args['message'], 500))
      return 'Shown to the user.'
    }
  },
  {
    name: 'remember',
    description:
      'Save a short note (a price, a name, what is left to do). Saved notes are shown with every later step.',
    args: { note: { type: 'string', description: 'the note' } },
    run: (args, context) => {
      context.remember(text(args['note'], 300))
      return 'Saved.'
    }
  }
]
