# Features

Each feature can be turned on or off with `features.<name>` in the config.
The table shows the default and where the code is (paths under
`projects/browse-ai-core/angular/src/lib/`).

| Feature                   | Option             | Default | Code                                                                 |
| ------------------------- | ------------------ | ------- | -------------------------------------------------------------------- |
| Page / General switch     | `pageContext`      | on      | `page/`, `components/composer/`                                      |
| Image upload              | `imageInput`       | on      | `components/composer/`                                               |
| Audio upload              | `audioInput`       | on      | `components/composer/`                                               |
| Screenshots               | `screenCapture`    | on      | `page/snip-capture.service.ts`, `page/region-selector.ts`            |
| Form Filler               | `formFiller`       | on      | `tools/form-filler/`                                                 |
| Tables Extractor          | `tablesExtractor`  | on      | `tools/tables/`                                                      |
| DOM Element to Component  | `domToComponent`   | off     | `tools/dom-to-component/`                                            |
| Summarizer                | `summarizer`       | on      | `ai/built-in/`                                                       |
| Translator                | `translator`       | on      | `ai/built-in/`, `components/composer/`                               |
| Writer                    | `writer`           | on      | `ai/built-in/`                                                       |
| Rewriter                  | `rewriter`         | on      | `ai/built-in/`                                                       |
| Proofreader               | `proofreader`      | on      | `ai/built-in/`                                                       |
| Selection actions         | `selectionActions` | on      | `page/selection-actions.service.ts`, `components/selection-actions/` |
| Image Downloader          | `imageDownloader`  | on      | `tools/image-downloader/`                                            |
| Subject Finder            | `subjectFinder`    | on      | `tools/subject-finder/`                                              |
| AI bookmarks              | `bookmarks`        | off     | `bookmarks/`, `components/bookmarks/`                                |
| Settings panel            | `settings`         | on      | `components/settings/`                                               |
| Personalization           | `personalization`  | on      | `components/settings/`, `ai/prompt-builder.ts`                       |
| Theme and palette pickers | `appearance`       | on      | `components/settings/`, `core/theme.store.ts`                        |
| Markdown answers          | `markdown`         | on      | `core/markdown.pipe.ts`, `styles/markdown.css`                       |
| Chat memory badge         | `contextUsage`     | on      | `components/header/`, `ai/ai.service.ts`                             |

## Always on

- **Chat.** Messages stream in while the model writes. Answers can be copied.
  A running answer can be stopped. **New chat** clears the conversation.
- **Model download.** When the model can be downloaded, the chat shows its
  size and a download button with progress. When AI isn't available it says
  so.
- **Thinking glow.** A moving gradient in the palette's colors behind the
  header and the top of the messages while the model works on an answer.
- **Layouts.** `floating` (button in a corner and a panel next to it),
  `drawer` (button and a full-height side panel) or `inline` (fills its
  container, no button). Four corner positions. On screens narrower than
  640 px the floating and drawer panels cover the whole screen.
- **Light, dark and system mode** and **10 palettes**: indigo, ocean, forest,
  sunset, rose, violet, amber, slate, teal, crimson. Every palette passes WCAG
  AA (4.5:1) for text in both modes; a unit test checks it.
- **Accessibility.** The panel is a dialog (a region when inline) with a
  focus trap, Esc to close, labelled controls, `aria-live` messages, a
  44 px touch target on coarse pointers and reduced motion support.
- **Texts and language.** Every text comes from `strings`; `ai.outputLanguage`
  sets the answer language.

## Page context

In page mode each prompt includes the page title, URL and main text, plus the
text the user selected. The switch label shows the site's host name. If the
page doesn't fit in the model's input quota, the text is cut and the chat
says how much was cut. In general mode nothing from the page is sent.
`defaultContextMode` sets where the switch starts; a new chat goes back to it.

## Attachments

- **Image** and **audio** files from the attachment menu. Only one of each is
  attached at a time and they can be removed before sending.
- **Capture visible area** attaches a screenshot of the visible page.
- **Snip and capture** covers the page with an overlay; the user drags a
  rectangle and only that part is attached. Esc cancels.
- With an attachment, the page context and selection are left out of the
  prompt.

## Tools

Picked from the Tools select under the input. Each tool shows a short "How to
use" note.

- **Form Filler.** Scans the labelled fields of the form on the page (inputs,
  selects, checkboxes, radios, text areas), asks the model for values based on
  the user's message, and makes each value fit its field: a select gets one of
  its options, a checkbox gets checked or not, a number gets a number. Every
  suggestion appears next to its field on the page with Accept and Dismiss;
  the chat has Accept all and Dismiss all. Accepted values are written to the
  fields with input and change events.
- **Tables Extractor.** Reads every HTML table on the page and offers a
  download menu: CSV, Excel, JSON or Markdown, packed in one zip.
- **DOM Element to Component.** The user hovers the page (elements are
  highlighted) and clicks one. Its DOM, including children, is sent to the
  model, which returns component code for Angular, React, Vue or plain
  JavaScript.
- **Summarizer, Translator, Writer, Rewriter, Proofreader.** Use Chrome's
  task APIs, each with its own model. A tool is listed when its API exists
  and is not `unavailable` (Translator: when the API exists). When the model
  is not downloaded, the composer shows a download button with progress, and
  Send stays off until it is done. The answer is only the API's result:
  the summary, the translation, the written or rewritten text, or the
  corrected text. Translator has a language picker. Options come from
  `ai.builtInTools`.
- **Image Downloader.** Takes the loaded `<img>` elements on the screen (at
  least 48×48 px, at most 50), and asks the model about each one: does it
  match the user's request? The answer shows progress ("Checking image 3 of
  12"). Matching images are offered as one zip file. Images that can't be
  read (for example blocked by CORS) are skipped and counted. Stop keeps the
  matches found so far.
- **Subject Finder.** Splits the page text into blocks, sends them (or the 40
  that share the most words with the request, on long pages) to the model,
  and scrolls to the block it picks, opening closed `<details>` on the way.
  The block is highlighted for a moment. The answer is a fixed text: found or
  not found. On screens narrower than 640 px the panel closes after
  scrolling.

While a response or tool runs, only Stop is enabled in the composer.

## Selection actions

When the user selects text on the page (not in the chat or in a field), a
small bar shows one button per downloaded Summarizer, Translator, Writer,
Rewriter or Proofreader model. A click opens the chat, picks the tool, puts
the text in the prompt and sends it. The bar hides on Escape, scroll or when
the selection is cleared. Users turn it off in settings.

## AI bookmarks

When on, every page the user opens is sent to the model with the list of
existing categories, and saved into the category the model picks (newest
first). From time to time the model is asked to merge similar categories; the
answer is checked so only real categories are merged and no bookmark is lost.
The Bookmarks panel lists categories with their pages, and lets the user open
or delete a page, delete a category, or clear everything. Bookmarks are saved
through the storage adapter and re-read before every save, so several tabs
don't overwrite each other.

## Settings

- Appearance: theme (light, dark, system) and palette.
- Personalization: nickname and custom instructions, added to every
  conversation.
- AI bookmarks switch (when the feature is on).
- Actions on selected text switch (when the feature is on). On by default.

Saved settings win over the theme and palette from the config.
