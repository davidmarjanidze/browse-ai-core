/** What is saved about a watched element so it can be found after a re-render. */
export interface ElementLocator {
  tag: string
  id: string
  testId: string
  /** CSS path from the nearest ancestor with an id, or from `body`. */
  path: string
  /** Stable-looking classes (no hashed names). */
  classes: string[]
  name: string
  ariaLabel: string
}

const TEST_ATTRIBUTES = ['data-testid', 'data-test', 'data-test-id', 'data-qa']

/** Class names made by CSS-in-JS tools look random; they change between builds. */
export function isStableClass(name: string): boolean {
  if (!/^[a-z][a-z0-9_-]{0,39}$/iu.test(name)) return false
  if (/^(css|sc|jsx|emotion|svelte)-/iu.test(name)) return false
  return !name
    .split(/[-_]+/u)
    .some(
      (part) => part.length >= 5 && /\d/u.test(part) && /[a-z]/iu.test(part)
    )
}

function step(element: Element): string {
  const tag = element.tagName.toLowerCase()
  const parent = element.parentElement
  if (!parent) return tag
  const same = [...parent.children].filter(
    (child) => child.tagName === element.tagName
  )
  return same.length > 1
    ? `${tag}:nth-of-type(${same.indexOf(element) + 1})`
    : tag
}

export function cssPath(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element
  while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML') {
    if (current !== element && current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`)
      return parts.join(' > ')
    }
    parts.unshift(step(current))
    current = current.parentElement
  }
  parts.unshift('body')
  return parts.join(' > ')
}

export function createLocator(element: Element): ElementLocator {
  const className =
    typeof (element as HTMLElement).className === 'string'
      ? (element as HTMLElement).className
      : ''
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id,
    testId:
      TEST_ATTRIBUTES.map((name) => element.getAttribute(name)).find(Boolean) ??
      '',
    path: cssPath(element),
    classes: className.split(/\s+/u).filter(isStableClass).slice(0, 3),
    name: element.getAttribute('name') ?? '',
    ariaLabel: element.getAttribute('aria-label') ?? ''
  }
}

function query(root: ParentNode, selector: string): Element | null {
  try {
    return root.querySelector(selector)
  } catch {
    return null
  }
}

/** Finds the element again: id, test id, CSS path, then tag with classes. */
export function findByLocator(
  doc: Document,
  locator: ElementLocator
): Element | null {
  const sameTag = (element: Element | null): Element | null =>
    element && element.tagName.toLowerCase() === locator.tag ? element : null
  if (locator.id) {
    const found = sameTag(doc.getElementById(locator.id))
    if (found) return found
  }
  if (locator.testId) {
    for (const name of TEST_ATTRIBUTES) {
      const found = sameTag(
        query(doc, `[${name}="${CSS.escape(locator.testId)}"]`)
      )
      if (found) return found
    }
  }
  const byPath = sameTag(query(doc, locator.path))
  if (byPath) return byPath
  const extra = [
    ...locator.classes.map((name) => `.${CSS.escape(name)}`),
    locator.name ? `[name="${CSS.escape(locator.name)}"]` : '',
    locator.ariaLabel ? `[aria-label="${CSS.escape(locator.ariaLabel)}"]` : ''
  ].join('')
  if (!extra) return null
  const matches = doc.querySelectorAll(`${locator.tag}${extra}`)
  return matches.length === 1 ? matches[0] : null
}
