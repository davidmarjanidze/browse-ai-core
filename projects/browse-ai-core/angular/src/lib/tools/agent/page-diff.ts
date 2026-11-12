import { PageSnapshot, formatSnapshot } from './page-snapshot'

export interface PageChanges {
  added: string[]
  removed: number[]
  changed: string[]
}

/**
 * What changed between two snapshots of the same page. Positions (`@x,y`)
 * alone are not a change, so scrolling does not resend every element.
 */
export function diffSnapshots(
  before: PageSnapshot,
  after: PageSnapshot
): PageChanges {
  const old = new Map(before.items.map((item) => [item.ref, item.text]))
  const now = new Set(after.items.map((item) => item.ref))
  const added: string[] = []
  const changed: string[] = []
  for (const item of after.items) {
    const text = old.get(item.ref)
    if (text === undefined) added.push(`+ ${item.text} ${item.at}`)
    else if (text !== item.text) changed.push(`~ ${item.text} ${item.at}`)
  }
  const removed = before.items
    .map((item) => item.ref)
    .filter((ref) => !now.has(ref))
  return { added, removed, changed }
}

export const hasChanges = (changes: PageChanges): boolean =>
  changes.added.length + changes.removed.length + changes.changed.length > 0

const scrollLine = (snapshot: PageSnapshot): string =>
  `SCROLL: ${snapshot.scrollY} of ${snapshot.scrollHeight}, viewport ${snapshot.viewport.width}x${snapshot.viewport.height}`

/** The page part of a step prompt as changes since the last step. */
export function formatChanges(
  before: PageSnapshot,
  after: PageSnapshot,
  changes: PageChanges
): string {
  const same =
    after.items.length - changes.added.length - changes.changed.length
  if (
    !hasChanges(changes) &&
    before.title === after.title &&
    before.scrollY === after.scrollY &&
    before.scrollHeight === after.scrollHeight
  )
    return 'Unchanged since the last step. All refs you saw still apply.'
  return [
    ...(before.title === after.title ? [] : [`TITLE: ${after.title}`]),
    scrollLine(after),
    hasChanges(changes)
      ? `ELEMENTS CHANGED since the last step (${same} others are the same):`
      : 'No element changed.',
    ...changes.added,
    ...changes.changed,
    ...(changes.removed.length
      ? [`- gone: ${changes.removed.map((ref) => `[${ref}]`).join(' ')}`]
      : []),
    ...(after.omitted
      ? [`(${after.omitted} more not listed; scroll or use find_text)`]
      : [])
  ].join('\n')
}

/**
 * The page text for a step: the full list, or only the changes when that is
 * shorter and the model already has the earlier list.
 */
export function describePage(
  before: PageSnapshot | null,
  after: PageSnapshot,
  options: { full: boolean }
): { text: string; changed: boolean } {
  const full = formatSnapshot(after)
  if (!before || before.url !== after.url) return { text: full, changed: true }
  const changes = diffSnapshots(before, after)
  const changed =
    hasChanges(changes) ||
    before.title !== after.title ||
    before.scrollY !== after.scrollY
  if (options.full) return { text: full, changed }
  const text = formatChanges(before, after, changes)
  return { text: text.length < full.length ? text : full, changed }
}
