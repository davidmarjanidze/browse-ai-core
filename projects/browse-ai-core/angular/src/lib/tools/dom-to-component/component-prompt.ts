import {
  DOM_COMPONENT_FRAMEWORKS,
  DomToComponentFramework
} from '../tools.model'

export const FRAMEWORK_LABELS: Record<DomToComponentFramework, string> = {
  [DOM_COMPONENT_FRAMEWORKS.Angular]: 'Angular',
  [DOM_COMPONENT_FRAMEWORKS.React]: 'React',
  [DOM_COMPONENT_FRAMEWORKS.VueJs]: 'Vue.js',
  [DOM_COMPONENT_FRAMEWORKS.JavaScript]: 'JavaScript'
}

/**
 * Replaces custom elements (tags with a dash) with a `<button>` or `<div>`
 * so the model sees plain HTML.
 */
export function normalizeDomToNativeHtml(doc: Document, html: string): string {
  const template = doc.createElement('template')
  template.innerHTML = html.trim()

  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    if (!element.tagName.includes('-')) continue
    const role = (element.getAttribute('role') ?? '').toLowerCase()
    const className = (element.getAttribute('class') ?? '').toLowerCase()
    const isButton =
      ['button', 'radio', 'tab'].includes(role) || className.includes('button')
    const replacement = doc.createElement(isButton ? 'button' : 'div')

    for (const attribute of Array.from(element.attributes)) {
      replacement.setAttribute(attribute.name, attribute.value)
    }
    while (element.firstChild) replacement.appendChild(element.firstChild)
    element.replaceWith(replacement)
  }

  return template.innerHTML.trim() || html
}

function frameworkInstructions(framework: DomToComponentFramework): string {
  switch (framework) {
    case DOM_COMPONENT_FRAMEWORKS.Angular:
      return `- Target Angular v22.
    - Output exactly one Angular @Component class.
- Use standalone: true.
- Use inline template in the @Component metadata (template: \`...\`).
- Do not output separate HTML/CSS files.
    - Include necessary Angular imports only.
    - Prefer Angular v22 patterns and APIs.
    - Component should have \`input\`(s) and \`output\`(s) to configure the component if necessary.
    `
    case DOM_COMPONENT_FRAMEWORKS.React:
      return `- Target React v19.
    - Output exactly one React function component.
- Use modern function component syntax.
- Return JSX in the function body.
    - Include minimal imports required for a standalone snippet.
    - Prefer latest React v19 idioms.`
    case DOM_COMPONENT_FRAMEWORKS.VueJs:
      return `- Target Vue.js 3.
    - Output exactly one Vue Single File Component.
- Use <script setup lang="ts"> and a <template> block.
    - Keep the component self-contained and idiomatic for Vue 3.
    - Prefer latest Vue 3 composition patterns.`
    case DOM_COMPONENT_FRAMEWORKS.JavaScript:
      return `- Target ECMAScript 2025 (ES16).
    - Output exactly one JavaScript class component.
- Class must expose a render() method that returns DOM markup.
    - No frameworks or transpilation assumptions.
    - Use modern class fields and latest standard syntax supported by ES16.`
    default:
      return '- Output one reusable component implementation.'
  }
}

export function buildComponentPrompt(
  doc: Document,
  domNodeHtml: string,
  framework: DomToComponentFramework
): string {
  return `You are a senior frontend engineer.

Task: Convert the provided HTML DOM node into a reusable ${FRAMEWORK_LABELS[framework]} component.

DOM NODE (full node with children):
${normalizeDomToNativeHtml(doc, domNodeHtml)}

IMPORTANT:
- The DOM above is pre-normalized to native HTML intent. Keep that native structure.

STRICT OUTPUT RULES:
- Return only code, no markdown fences, no explanations.
- Preserve the visual structure and semantic meaning of the DOM.
- Replace inline event handlers with idiomatic component handlers.
- Keep generated code self-contained and production-ready.
- Keep class names and attributes where possible.
- Use only native HTML elements (for example: div, section, article, nav, header, footer, p, span, button, input, ul, li).
- Do NOT use custom/web/component tags from UI libraries (for example: mat-*, ion-*, app-*, v-*, x-*).
- If source tags are framework-specific, convert them into equivalent native HTML semantics.

FRAMEWORK-SPECIFIC RULES:
${frameworkInstructions(framework)}
`
}
