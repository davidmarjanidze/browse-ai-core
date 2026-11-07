# Decisions

Each entry records a decision that shapes the package, the reason for it and
what it costs.

## 1. Native Angular library plus a custom element build

**Decision:** One Angular workspace and one source tree, built into several
entry points: the framework-free core, the Angular library (ng-packagr), the
`<browse-ai-core>` custom element (Angular Elements, one self-contained
module), and thin React and Vue wrappers around the element (`tsc`).

**Why:** The chat must work in Angular, React, Vue and plain HTML, and in a
Chrome extension. One UI codebase keeps them the same. Angular apps get a
native standalone component without a second copy of Angular. Chrome content
scripts can't define custom elements, so the extension needs the native
component too.

**Alternatives:** A rewrite in Lit or plain TypeScript (smaller bundle, but a
rewrite of working code and tests). Separate native libraries per framework
(four UIs to keep in sync). Custom element only (Angular apps would load
Angular twice, and it doesn't work in content scripts).

**Cost:** Two build pipelines. The element bundle includes the Angular runtime,
so it is larger than a Lit component would be. Complex options are set with
the `config` property, not attributes.

## 2. Shadow DOM

**Decision:** The root component uses `ViewEncapsulation.ShadowDom`.

**Why:** The chat is dropped into pages it doesn't control. Page CSS must not
break the chat and the chat's CSS must not leak into the page.

**Cost:** Styling from outside goes through `--bac-*` variables and
`::part()`. `@property` rules have to be copied to the document (decision 4).
Page overlays (snip, form suggestions, element highlight) live outside the
shadow root and use inline styles.

## 3. Tailwind CSS v4 with `bac-*` tokens

**Decision:** Templates use Tailwind v4 utilities. Colors only come from
`bac-*` tokens defined with `@theme inline` as `var(--bac-*)`. Preflight and
utilities are compiled into the component's styles.

**Why:** Fast to build with, and every color goes through one set of
variables, so palettes, dark mode and user overrides work everywhere.

**Cost:** Raw colors in templates are not allowed. Base rules that Tailwind v4
dropped, like the pointer cursor on buttons, are added in `tailwind.css` with
`:where()` so utilities still win.

## 4. Copy `@property` rules to the document

**Decision:** `core/shadow-styles.ts` copies Tailwind's `@property` rules into
a style element in the document head, once per page.

**Why:** Browsers ignore `@property` inside shadow roots, and Tailwind v4 needs
them for shadows, rings and transforms. Rules in the document apply to every
shadow root.

## 5. Palettes built at runtime, checked for contrast

**Decision:** Palettes are TypeScript data (`palettes.ts`). `buildThemeCss()`
turns a palette and mode into `:host { --bac-…: … }` CSS that the
`ThemeStore` writes into the shadow root. A unit test checks WCAG AA (4.5:1)
for every text and background pair in every palette and mode.

**Why:** Palette and mode change at runtime (settings, system mode) without
shipping CSS for every combination. The test keeps new palettes readable.

**Cost:** Adding a color means adding it to `ThemeTokens` and to every
palette.

## 6. Services per chat instance

**Decision:** All services are provided on the root component
(`CHAT_INSTANCE_PROVIDERS`), not in the root injector.

**Why:** A page can have more than one chat (for example an inline chat and a
floating one). Each needs its own session, messages, settings and tools.

## 7. Adapters for AI, storage and screenshots

**Decision:** The chat uses the model, storage and screen capture only through
the `AiProvider`, `StorageAdapter` and `ScreenCaptureAdapter` interfaces.
Defaults: Chrome Prompt API; `chrome.storage.local`, `localStorage`, memory;
extension message or `getDisplayMedia`.

**Why:** Apps can use another model, save settings on their server, or turn
screenshots off, without forking the package. It also makes the chat easy to
test with fakes.

## 8. All UI text in `strings`

**Decision:** Every visible text is in `DEFAULT_STRINGS` and can be replaced
with `strings` in the config. Placeholders use `{name}`.

**Why:** Apps can translate or reword the chat without changing its markup.

## 9. Signals, zoneless-friendly components

**Decision:** Components use `input()`, `model()`, `output()`, `viewChild()`,
`signal()`, `computed()` and `effect()`, `inject()`, `#private` fields, `OnPush`
and separate `.html` templates. View queries are `protected` because Angular
can't query ES private fields.

**Why:** It works with and without Zone.js, which matters because the element
and the extension create a bare application.

## 10. Runs on the device by default

**Decision:** The default provider is Chrome's built-in model. The package has
no analytics and makes no network requests of its own.

**Why:** Page content and prompts can be private. Apps that want a server model
can pass their own provider.

## 11. Chrome's task APIs behind one internal service

**Decision:** Summarizer, Translator, Writer, Rewriter and Proofreader are
called directly through `BuiltInAiService`, not through a public adapter like
`aiProvider`. Each tool is listed only when its API exists and is not
`unavailable` (Translator: when the API exists, because its availability
depends on the language pair). Each model has its own download button in the
composer. Options come from `ai.builtInTools`.

**Why:** These APIs differ from each other and from the Prompt API (options,
streaming, Proofreader's result object). A public adapter would freeze an
interface while the APIs are still changing.

**Cost:** Apps can't swap these tools for another model. That can be added
later as an adapter.

## 12. Tool answers are fixed texts or raw results

**Decision:** The task API tools answer with only the API result. Image
Downloader and Subject Finder answer with fixed texts from `strings` (for
example "I scrolled to what you were looking for."), never with model text.
Answers from the model are asked for as JSON and parsed with
`parseJsonFromModelResponse`, like Form Filler.

**Why:** The answer must be exactly what the user asked for, translated with
the rest of the UI, and not depend on how the model phrases things.

## 13. Image input is checked separately

**Decision:** The chat's model check uses only the inputs the chat needs.
Image Downloader checks image input with a separate `availability()` call,
is hidden when the model has no image input, and creates its own sessions
with image input.

**Why:** Asking for image input in the main check would make the whole chat
report "not supported" on devices whose model has text only.

## 14. Subject Finder ranks text before asking the model

**Decision:** The page is split into text blocks. Small pages (up to 6,000
characters) are sent whole; on bigger pages the 40 blocks that share the most
words with the request are sent. The model picks one block by number. The
match is highlighted with the CSS Custom Highlight API, with colors copied
from the chat's theme.

**Why:** One model call per search keeps it fast, and the page doesn't fit in
the model's input. A highlight doesn't change the page's own elements or
styles.

**Alternatives:** Asking the model to quote the match and searching for the
quote (breaks when the model rephrases). Embeddings (no on-device embedding
API in Chrome).

## 15. Selection actions only for downloaded models

**Decision:** The bar on selected page text shows only tools whose model is
already downloaded. A click runs the same path as picking the tool and
pressing Send. Users turn it off in settings; the choice is saved with the
other settings.

**Why:** A click must give an answer right away, not start a large download.
