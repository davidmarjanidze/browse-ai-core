// Loads the built element bundle in jsdom and checks that <browse-ai-core>
// registers, renders its launcher, opens, and applies a palette.
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const bundle = readFileSync(
  process.argv[2] ?? 'dist/browse-ai-core/element/browse-ai-core.js',
  'utf8'
)
const dom = new JSDOM(
  '<!doctype html><html><head></head><body></body></html>',
  {
    url: 'https://example.com/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  }
)
const { window } = dom
window.matchMedia ??= () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {}
})

const fail = (message) => {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

window.eval(bundle)
await Promise.race([
  window.customElements.whenDefined('browse-ai-core'),
  wait(5000)
])
if (!window.customElements.get('browse-ai-core'))
  fail('element was not defined')

const element = window.document.createElement('browse-ai-core')
element.setAttribute('palette', 'forest')
element.config = { theme: 'dark', strings: { openChat: 'Talk to us' } }
window.document.body.appendChild(element)
await wait(100)

const root = element.shadowRoot
if (!root) fail('no shadow root')
const launcher = root.querySelector('[part="launcher"]')
if (!launcher) fail('launcher not rendered')
if (launcher.getAttribute('aria-label') !== 'Talk to us')
  fail('strings not applied')
if (!root.getElementById('bac-theme')?.textContent.includes('#4ade80')) {
  fail('dark forest palette not applied')
}

let opened = false
element.addEventListener('opened', () => (opened = true))
launcher.click()
await wait(100)
if (!root.querySelector('[part="panel"]')) fail('panel did not open')
if (!opened) fail('opened event not fired')
if (element.open !== true) fail('open property not updated')

console.log(
  'OK: <browse-ai-core> registers, renders, opens and applies the theme'
)
window.close()
process.exit(0)
