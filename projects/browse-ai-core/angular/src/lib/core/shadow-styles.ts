const THEME_STYLE_ID = 'bac-theme'
const PROPERTY_STYLE_ID = 'browse-ai-core-properties'

/** Puts the palette CSS (`:host { --bac-…: … }`) into the shadow root. */
export function applyThemeCss(root: ShadowRoot, css: string): void {
  let style = root.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = root.ownerDocument.createElement('style')
    style.id = THEME_STYLE_ID
    root.prepend(style)
  }
  if (style.textContent !== css) style.textContent = css
}

function collectPropertyRules(rules: CSSRuleList, output: string[]): void {
  const PropertyRule = (
    globalThis as { CSSPropertyRule?: abstract new () => CSSRule }
  ).CSSPropertyRule
  for (const rule of Array.from(rules)) {
    if (PropertyRule && rule instanceof PropertyRule) {
      output.push(rule.cssText)
    } else if ('cssRules' in rule) {
      collectPropertyRules((rule as CSSGroupingRule).cssRules, output)
    }
  }
}

/**
 * Browsers ignore `@property` rules inside a shadow root, and Tailwind v4
 * needs them for shadows, rings and transforms. This copies them to the
 * document once, where they apply to every shadow root too.
 */
export function hoistPropertyRules(root: ShadowRoot): void {
  const doc = root.ownerDocument
  if (doc.getElementById(PROPERTY_STYLE_ID)) return

  const rules: string[] = []
  const sheets = [
    ...Array.from(root.styleSheets ?? []),
    ...(root.adoptedStyleSheets ?? [])
  ]
  for (const sheet of sheets) {
    try {
      collectPropertyRules(sheet.cssRules, rules)
    } catch {
      // Stylesheets from another origin can't be read. Ours are inline.
    }
  }
  if (rules.length === 0) return

  const style = doc.createElement('style')
  style.id = PROPERTY_STYLE_ID
  style.textContent = [...new Set(rules)].join('\n')
  doc.head.appendChild(style)
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab and Shift+Tab inside `container`. */
export function trapFocus(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE)
  ).filter((element) => element.getClientRects().length > 0)
  if (focusable.length === 0) return

  const root = container.getRootNode() as ShadowRoot | Document
  const active = root.activeElement
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
