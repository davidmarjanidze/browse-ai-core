# Architecture

One Angular 22 workspace with one source tree for the chat. Several builds turn
it into the package's entry points.

## Entry points

| Import                   | Built with                   | Contents                                                                                                              |
| ------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `browse-ai-core`         | ng-packagr (primary entry)   | Framework-free core: config types and defaults, palettes, strings, AI/storage/capture adapters, event types.          |
| `browse-ai-core/angular` | ng-packagr (secondary entry) | `BrowseAiCoreComponent` and `provideBrowseAiCore()`, in Angular Package Format.                                       |
| `browse-ai-core/element` | Angular application builder  | `<browse-ai-core>` custom element. One self-contained ES module with the Angular runtime inside. Also served by CDNs. |
| `browse-ai-core/react`   | `tsc`                        | `<BrowseAiCore>` React 19 component around the element.                                                               |
| `browse-ai-core/vue`     | `tsc`                        | `BrowseAiCore` Vue 3.5 component around the element, with `v-model:open`.                                             |

Angular, React and Vue are optional peer dependencies; each app installs only
the one it uses. Runtime dependencies are `marked` (Markdown) and the Font
Awesome icon sets.

`scripts/build.mjs` runs the four builds in order and writes everything to
`dist/browse-ai-core`, which is the folder that gets published.

## Workspace layout

```text
projects/
├── browse-ai-core/
│   ├── src/lib/            core entry (no framework code)
│   └── angular/src/lib/    Angular entry
├── element/src/main.ts     registers <browse-ai-core>
├── react/src/index.ts      React wrapper
├── vue/src/index.ts        Vue wrapper
└── demo/                   demo app for `npm start`
examples/                   Angular, React, Vue and HTML apps
scripts/                    build, element smoke test, example builds
```

### Core entry (`projects/browse-ai-core/src/lib`)

| File                | Contents                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.ts`         | `BrowseAiCoreConfig`, `DEFAULT_FEATURES`, `resolveConfig()`.                                                                                                                 |
| `palettes.ts`       | The 10 palettes, `getThemeTokens()`, `buildThemeCss()`, `contrastRatio()`.                                                                                                   |
| `strings.ts`        | `DEFAULT_STRINGS` (every UI text) and `formatString()`. Tool texts added later live in `strings-tools.ts` and `strings-tools-page.ts` and are spread into `DEFAULT_STRINGS`. |
| `ai-provider.ts`    | `AiProvider` / `AiSession` interfaces and the Prompt API provider.                                                                                                           |
| `ai-support.ts`     | `isAiSupported()`, `getAiAvailability()`, `getSessionOptions()`: the same support check the chat runs.                                                                       |
| `built-in-tools.ts` | Types and defaults for the Summarizer, Translator, Writer, Rewriter and Proofreader options (`ai.builtInTools`), Translator languages.                                       |
| `storage.ts`        | `StorageAdapter` and the chrome.storage, localStorage and memory adapters.                                                                                                   |
| `screen-capture.ts` | `ScreenCaptureAdapter`, the extension and `getDisplayMedia` adapters.                                                                                                        |
| `events.ts`         | Event payload types.                                                                                                                                                         |
| `element.ts`        | The element tag name and the element's TypeScript type.                                                                                                                      |

### Angular entry (`projects/browse-ai-core/angular/src/lib`)

| Folder         | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`        | Config, storage, theme, panel and toast stores; shadow root styles; Markdown and format pipes; clipboard; saved data for notes (`notes-data.ts`) and research topics (`research-data.ts`); file download helper.                                                                                                                                                                                                                              |
| `ai/`          | `AiService` (sessions, streaming, model download, context usage), prompt builder, JSON answer parsing and `cleanModelText()`, request status. `ai/built-in/`: `BuiltInAiService` for Chrome's task APIs (availability, download, run).                                                                                                                                                                                                        |
| `chat/`        | `ChatSessionStore` (messages and sending), `ToolRunner`, `ExtraToolRunner` (the tools from specs T-002 to T-012), `VoiceInputStore` (mic button), `tool-card.model.ts` (data a tool attaches to its answer), chat events.                                                                                                                                                                                                                     |
| `page/`        | Page text and selection reading, snip region selector and capture, selection actions (watches page selections), `FieldTrackerService` (last focused text box and form), `MarkerLayer` (numbered marks on the page), text search (`find-text-range.ts`), scroll and highlight (`reveal-element.ts`), typing into fields (`insert-text.ts`).                                                                                                    |
| `tools/`       | One folder per tool: Form Filler, Form Validator, Tables Extractor, DOM Element to Component, Image Downloader, Subject Finder, Link Inspector, Reply Drafter, Notes, Review Summarizer, Research Notes, Argument Mapper, Dictation, Performance Explainer, Scam Check, Dark Pattern Detector. `tools.model.ts` builds the tool list, `extra-tools.ts` lists the newer tools, `tool-groups.ts` sets the groups and order in the Tools select. |
| `bookmarks/`   | AI bookmarks: categorizing pages and merging categories.                                                                                                                                                                                                                                                                                                                                                                                      |
| `components/`  | Launcher, header, message list, composer (with tool options and the recording bar), empty state, model download, selection actions bar, settings, bookmarks and notes panels, tool cards under answers (links, reply, rating bars, argument map, performance charts, scam level, dark patterns).                                                                                                                                              |
| `ui/`          | Generic controls: button, menu, select (with option groups), switch, toggle group, accordion, textarea, icon, toasts, the green help box, and an SVG line and bar chart.                                                                                                                                                                                                                                                                      |
| `styles/`      | Tailwind entry, layout, Markdown and effects CSS.                                                                                                                                                                                                                                                                                                                                                                                             |
| `providers.ts` | `provideBrowseAiCore()` and the list of per-chat services.                                                                                                                                                                                                                                                                                                                                                                                    |

## Component and services

`BrowseAiCoreComponent` (`<browse-ai-core>`) is the only public component. It
uses `ViewEncapsulation.ShadowDom`, `OnPush` change detection and signals.

Every service of a chat is listed in `CHAT_INSTANCE_PROVIDERS` and provided on
the root component, not in the root injector. Two chats on one page don't
share state. Services are `@Injectable()` without `providedIn` and are
injected with `inject()`.

## Config

The config is resolved in this order, later wins:

1. Package defaults (`DEFAULT_FEATURES`, `DEFAULT_STRINGS`, default adapters).
2. `provideBrowseAiCore(config)` in the app's providers.
3. The component's `config` input (the element's `config` property).
4. The `theme`, `palette`, `position` and `mode` inputs (element attributes).

`features`, `ai` and `strings` are merged key by key. `undefined` values don't
hide defaults. Unknown theme, palette, position or mode values fall back to
the default. The default adapters are created once and shared.

## Styling and theming

- Styles are Tailwind CSS v4, compiled into the root component and placed in
  its shadow root. Templates use only `bac-*` color tokens, which map to
  `--bac-*` CSS variables.
- `ThemeStore` picks the palette and the color mode (light, dark, or the OS
  setting for `system`; saved settings win when the appearance feature is on)
  and writes `buildThemeCss(palette, mode)` as `:host { --bac-…: … }` into the
  shadow root.
- Each palette defines text, surface, primary, accent, status and "thinking"
  glow colors for light and dark mode. Users can override any `--bac-*`
  variable from outside the element.
- Browsers ignore `@property` rules inside a shadow root, and Tailwind v4
  needs them. `core/shadow-styles.ts` copies them to the document once.
- Parts (`part="header"`, `part="messages"`, `part="menu"`, …) can be styled
  with `::part()`.
- `prefers-reduced-motion` turns animations off.
- Tool cards set their columns with container queries (`@container`), so they
  follow the chat panel's width, not the window's.
- The launcher's opacity comes from `--bac-launcher-opacity` and goes to 1 on
  hover and focus.

## Adapters

The chat talks to the outside world only through three adapters, so each can
be replaced in the config:

| Adapter         | Default                                                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiProvider`    | Chrome Prompt API (`LanguageModel`). Reports availability, downloads the model, creates sessions with streaming.                                                                                                                  |
| `storage`       | `chrome.storage.local` in an extension, then `localStorage`, then memory. All data is one JSON value under `storageKey`: settings, bookmarks, `notes` (site, then page URL, then notes) and `research` (topics with their pages). |
| `screenCapture` | In an extension: message `{ type: 'CAPTURE_VISIBLE_TAB' }` to the background worker. On a web page: `getDisplayMedia`. `null` hides screenshots.                                                                                  |

## Prompts

`ai/prompt-builder.ts` builds each prompt from the user's text, the page
context (title, URL, main text) in page mode, the selected text, and the
personalization (nickname and custom instructions). When an image or audio
file is attached, page context and selection are left out so the model looks
at the attachment. If the prompt is larger than the model's input quota, the
page text is cut and the chat tells the user how much was cut. Tool prompts
are sent as they are.

Answers stream through `ai/stream-reader.ts`. Tools that need structured data
ask for JSON and read it with `ai/json-response.ts`, with or without code
fences. Text from the model that is saved or listed (notes, key points,
review lists) goes through `cleanModelText()`, which removes wrapper tags such
as `<note>…</note>` that Gemini Nano sometimes adds.

Newer tools follow the rules in
[decision 16](decisions.md#16-shared-rules-for-new-tools): page work is done in
code, and the model gets a short summary of what the code found, within a
fixed size per tool. Long input is split into parts and the answers are
combined.

## Events

The component has `opened`, `closed`, `open` (two-way), `messageSent`,
`responseReceived`, `errorOccurred` and `themeChange`. On the element they are
DOM events with the payload in `event.detail`; the React and Vue wrappers map
them to their own event names (see the README).

## Page interaction

- Page text and selection: `PageContextService` reads the page and keeps the
  last selection, so it's still known after focus moves into the chat.
- Overlays that must sit on the page (snip rectangle, form suggestions,
  element highlight) are created in the page document with inline styles and
  the highest z-index, and are removed when done. Form Validator and Dark
  Pattern Detector use `MarkerLayer`: one shadow root on `<body>` with an
  outline, a numbered badge and a popover per mark. Marks are removed on new
  chat and when the tool is cleared.
- Highlights (Subject Finder, Show on page, saved notes) use the CSS Custom
  Highlight API, so the page's elements are not changed.
- Reply Drafter and Dictation type into page fields with the native value
  setter plus `input` and `change` events, so React, Vue and Angular forms see
  the change. Password and card fields are never read or filled.
- Clicks and keys inside the chat are checked against the host element so the
  page tools ignore them.
