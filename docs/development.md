# Development

## Requirements

- Node.js and npm.
- Desktop Chrome with the built-in AI model available, to try the chat with
  the real model. Tests don't need it.

## Setup

```console
npm install
./claude/scripts/install.sh   # once per clone: git hooks
```

## Commands

| Command                                     | What it does                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm start`                                 | Serves the demo app (`projects/demo`) with live reload.                                                |
| `npm test`                                  | Library tests (`ng test browse-ai-core`) and wrapper tests (Vitest).                                   |
| `npm run build`                             | Builds every entry point into `dist/browse-ai-core`.                                                   |
| `npm run test:element`                      | Loads the built element bundle in jsdom and checks it registers, renders, opens and applies a palette. |
| `npm run check`                             | `test`, `build` and `test:element` in a row.                                                           |
| `npm run npm-publish`                       | `check`, then `npm publish ./dist/browse-ai-core`.                                                     |
| `npm run prettier`                          | Formats every file.                                                                                    |
| `node scripts/examples.mjs <package> <dir>` | Installs a package version or tarball into copies of the example apps and builds them.                 |

## Tests

- **Library** (`projects/browse-ai-core/**/*.spec.ts`): Vitest through
  `@angular/build:unit-test` with jsdom. Covers config resolving, palettes and
  contrast, strings, storage and capture adapters, the AI service, prompt
  building, the chat session, every tool, bookmarks and the components.
  `testing/fake-ai.ts` is a fake `AiProvider` for these tests.
- **Wrappers** (`projects/react`, `projects/vue`): Vitest with
  `vitest.wrappers.config.ts`. They check that props become element
  properties, element events reach the React and Vue handlers (including
  `v-model:open`), and children render inside the element.
- **Element bundle**: `scripts/smoke-element.mjs`, run after a build.
- **Examples**: `scripts/examples.mjs` builds the Angular, React, Vue and HTML
  examples against a packed package, which catches broken exports or types.

## Demo app

`npm start` serves `projects/demo`. It shows the chat with pickers for palette
and theme. Add `?open` to the URL to start with the chat open. It uses the
real model, so check answers in Chrome with the built-in model.

## Examples

`examples/` has one small app per framework, the same code the README shows:

- `examples/angular`: standalone component and `provideBrowseAiCore()`.
- `examples/react`: Vite app with `browse-ai-core/react`.
- `examples/vue`: Vite app with `browse-ai-core/vue`.
- `examples/html`: the element from a CDN, no build.

## Trying a change in the extension

```console
npm run build
cd ../browse-ai && npm install ../browse-ai-core/dist/browse-ai-core && npm start
```

Reload the extension in `chrome://extensions` after the build. Switch the
extension back to an npm version once the change is published.

## Code style

- Angular rules: signals APIs (`input()`, `model()`, `output()`,
  `viewChild()`, `signal()`, `computed()`), `inject()`, `#private` fields
  (view queries are `protected`), `OnPush`, separate `.html` templates.
- Selectors start with `bac-`. Services are `@Injectable()` without
  `providedIn` and are added to `CHAT_INSTANCE_PROVIDERS`.
- Colors only through `bac-*` Tailwind tokens. No raw colors in templates.
- All UI text comes from `strings`.
- README and docs: short plain sentences.
- Each source file stays under about 5,000 tokens (~20 KB). A pre-commit hook
  checks this.
- Commits use Conventional Commits.

## Adding things

- **A feature switch:** add it to `BrowseAiCoreFeatures` and
  `DEFAULT_FEATURES` in `config.ts`, read it from `ConfigStore`, document it
  in the README options table and in [features.md](features.md).
- **A UI text:** add it to `DEFAULT_STRINGS` and use it through the config
  store's strings.
- **A color:** add it to `ThemeTokens`, give every palette a value for light
  and dark mode, map it in `tailwind.css` if templates need it, and add a
  contrast pair to `palettes.spec.ts` if it's a text color.
- **A palette:** add the name to `PALETTE_NAMES` and its colors to
  `PALETTE_COLORS` and `THINKING_HUES`. The contrast test runs for it
  automatically.
- **A tool:** add a service under `tools/`, register it in
  `CHAT_INSTANCE_PROVIDERS`, add it to `ToolRunner` and the Tools select, add
  its strings and a feature switch.
