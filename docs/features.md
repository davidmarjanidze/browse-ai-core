# Features

Each feature can be turned on or off with `features.<name>` in the config.
The table shows the default and where the code is (paths under
`projects/browse-ai-core/angular/src/lib/`).

| Feature                   | Option                 | Default | Code                                                                      |
| ------------------------- | ---------------------- | ------- | ------------------------------------------------------------------------- |
| Page / General switch     | `pageContext`          | on      | `page/`, `components/composer/`                                           |
| Image upload              | `imageInput`           | on      | `components/composer/`                                                    |
| Audio upload              | `audioInput`           | on      | `components/composer/`                                                    |
| Screenshots               | `screenCapture`        | on      | `page/snip-capture.service.ts`, `page/region-selector.ts`                 |
| Form Filler               | `formFiller`           | on      | `tools/form-filler/`                                                      |
| Tables Extractor          | `tablesExtractor`      | on      | `tools/tables/`                                                           |
| DOM Element to Component  | `domToComponent`       | off     | `tools/dom-to-component/`                                                 |
| Summarizer                | `summarizer`           | on      | `ai/built-in/`                                                            |
| Translator                | `translator`           | on      | `ai/built-in/`, `components/composer/`                                    |
| Writer                    | `writer`               | on      | `ai/built-in/`                                                            |
| Rewriter                  | `rewriter`             | on      | `ai/built-in/`                                                            |
| Proofreader               | `proofreader`          | on      | `ai/built-in/`                                                            |
| Selection actions         | `selectionActions`     | on      | `page/selection-actions.service.ts`, `components/selection-actions/`      |
| Image Downloader          | `imageDownloader`      | on      | `tools/image-downloader/`                                                 |
| Subject Finder            | `subjectFinder`        | on      | `tools/subject-finder/`                                                   |
| AI bookmarks              | `bookmarks`            | off     | `bookmarks/`, `components/bookmarks/`                                     |
| Link Inspector            | `linkInspector`        | on      | `tools/link-inspector/`                                                   |
| Reply Drafter             | `replyDrafter`         | on      | `tools/reply-drafter/`, `page/field-tracker.service.ts`                   |
| Notes and Notes panel     | `notes`                | on      | `tools/notes/`, `components/notes/`, `core/notes-data.ts`                 |
| Review Summarizer         | `reviewSummarizer`     | on      | `tools/review-summarizer/`                                                |
| Research Notes            | `researchNotes`        | on      | `tools/research/`, `core/research-data.ts`                                |
| Argument Mapper           | `argumentMapper`       | on      | `tools/argument-mapper/`                                                  |
| Form Validator            | `formValidator`        | on      | `tools/form-validator/`, `page/marker-layer.ts`                           |
| Mic button                | `voiceInput`           | on      | `chat/voice-input.store.ts`, `components/composer/voice-bar.component.ts` |
| Dictation                 | `dictation`            | on      | `tools/dictation/`                                                        |
| Performance Explainer     | `performanceExplainer` | on      | `tools/performance/`, `ui/charts/`                                        |
| Scam Check                | `phishingCheck`        | on      | `tools/phishing-check/`                                                   |
| Dark Pattern Detector     | `darkPatternDetector`  | on      | `tools/dark-patterns/`, `page/marker-layer.ts`                            |
| Settings panel            | `settings`             | on      | `components/settings/`                                                    |
| Personalization           | `personalization`      | on      | `components/settings/`, `ai/prompt-builder.ts`                            |
| Theme and palette pickers | `appearance`           | on      | `components/settings/`, `core/theme.store.ts`                             |
| Markdown answers          | `markdown`             | on      | `core/markdown.pipe.ts`, `styles/markdown.css`                            |
| Chat memory badge         | `contextUsage`         | on      | `components/header/`, `ai/ai.service.ts`                                  |

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
- **Launcher.** The round button is 50% see-through (`--bac-launcher-opacity`)
  and fades to fully opaque on hover or keyboard focus.

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

Picked from the Tools select under the input. The select groups tools under
headings, in this order: Forms, Read & understand, Write, Save & extract,
Safety, Developer (`tools/tool-groups.ts`). A heading is hidden when none of
its tools are on. Each tool shows a green "How to use" box with its steps
(`<tool>Notes` strings). Shared rules for tools are in
[decision 16](decisions.md#16-shared-rules-for-new-tools).

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

- **Form Validator.** Checks the form that had focus last (or the largest
  one) with the browser's validity rules plus a few more: email-like fields,
  confirm fields, extra spaces, past expiry dates. Each problem gets a
  numbered marker on the page and a plain explanation in the chat. A marker
  goes away when its field is fixed. Password and card values are never sent
  to the model.
- **Link Inspector.** Lists the page's links in groups (internal, external,
  downloads, email and phone, suspicious), or answers with the links that
  match the user's request. Show on page scrolls to a link.
- **Argument Mapper.** Asks the model for the main claim, the points for and
  against it, and the evidence for each. Points with a quote found on the page
  get Show on page. Copy as Markdown copies the map.
- **Review Summarizer.** Finds reviews (JSON-LD, microdata, then repeated
  review-like blocks), counts ratings in code and asks the model for pros,
  cons, complaints and a verdict. Long review lists are summed up in parts.
- **Reply Drafter.** Uses the text box that had focus last (or Pick field),
  drafts a reply from the text near it with the chosen tone and length
  (Writer API when ready, otherwise the chat model). Insert puts it in the box
  after asking whether to replace existing text.
- **Dictation.** Records speech with the mic, turns it into text with the
  chat model and types it at the cursor in the picked text box. Text in the
  prompt is used as an instruction, for example "make it formal".
- **Notes.** Makes 3 to 8 notes for the whole page and saves them (see Notes
  below).
- **Research Notes.** Topics of saved pages. Sending without text adds the
  current page with its key points. A question is answered from the saved
  pages with `[n]` sources.
- **Performance Explainer.** Collects Core Web Vitals and related data while
  the chat is on the page and shows them as tiles and live charts updated
  every second. The model explains the biggest problems or answers a
  question.
- **Scam Check.** Looks for warning signs in code (brand name off its site,
  odd host, form sending data elsewhere, pressure wording and more), gives a
  risk level, and lets the model raise it by one step when the text is
  clearly a scam.
- **Dark Pattern Detector.** Finds pre-checked extras, countdown timers
  (read twice, 3 seconds apart), scarcity claims, guilt-trip decline buttons,
  weak decline buttons, items added to the basket and cancel pages without a
  cancel button. Each finding is marked on the page; pre-checked boxes can be
  unchecked.

While a response or tool runs, only Stop is enabled in the composer.

## Voice input

A mic button next to Send records speech (up to 60 seconds) and puts the
text into the input, where it can be edited before sending. The chat model's
audio input turns speech into text, so with the default model the audio stays
on the device. Esc cancels a recording. The mic is released as soon as
recording ends.

## Notes

- **Save note** in the selection actions bar saves the selected text with an
  AI note about it. Saved quotes are highlighted on the page with the CSS
  Custom Highlight API (the page's HTML is not changed). Clicking a highlight
  shows its note.
- The **Notes** panel (header menu) has three levels: websites, then the
  pages of a website by title, then the notes of a page with its URL as a
  link. Notes can be searched, copied, deleted and exported as Markdown.

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
