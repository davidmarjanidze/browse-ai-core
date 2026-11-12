---
id: T-018
title: More Agent Mode tools
status: Done
created: 2026-11-12
approved: 2026-11-12
completed: 2026-11-12
---

# T-018: More Agent Mode tools

Agent Mode has 27 tools (T-001, T-009). Runs with Gemini Nano still get
stuck on things the tools can't do: finding an image that is not in the
element list (T-014), picking the cheapest item from a product grid, date
and range inputs, cookie banners and pop-ups that cover the page, and
single-page apps that change the address without a page load. This spec
adds 8 tools for these cases.

Builds on T-001 (Agent Mode), T-009 (more tools) and T-011 (speed). Follows
[decision 16](../../docs/decisions.md#16-shared-rules-for-new-tools) and
[ADR 0001](../decisions/0001-agent-tool-calls-as-json.md).

## Requirements

### User stories

- As a user, I want the agent to find an image on the page by what it shows
  or its caption, and scroll to it, so tasks like "scroll to the airplane
  photo" work.
- As a user, I want the agent to pick the cheapest (or highest rated) item
  in a list without reading every card itself.
- As a user, I want the agent to fill date, time, range and color inputs.
- As a user, I want the agent to close pop-ups and cookie banners that
  block the page, without agreeing to anything for me.
- As a user, I want the agent to work on single-page apps where clicking a
  link changes the address but the page doesn't reload.
- As a user, I want to select text on the page and tell the agent to use
  it.
- As a developer using the package, I want the prompt to stay within Gemini
  Nano's input after the new tools are added.
- As a developer using the package, I want to turn single agent tools off,
  so the agent can't do things I don't want on my site and the prompt is
  shorter.

### Acceptance criteria

**Finding images**

- **R1.1** WHEN the model calls `find_images` THE SYSTEM SHALL list up to
  `limit` (default 10, max 20) images on the page (`img`, `picture`, `svg`
  with a title, elements with a CSS background image larger than 48×48),
  each with a new ref, its alt text, title or nearby caption (≤ 80 chars),
  its size, and whether it is in view, above or below.
- **R1.2** WHEN `find_images` gets `text` THE SYSTEM SHALL keep only images
  whose alt, title, caption, file name or link text contain any of its words,
  ordered by how many words match.
- **R1.3** WHEN no image matches THE SYSTEM SHALL say so and add "Scroll
  and try again, or take a screenshot." to the result.

**Reading lists**

- **R2.1** WHEN the model calls `extract_list` with a `ref` THE SYSTEM SHALL
  read the repeated child items of that container. Without a `ref` it SHALL
  pick the largest group of visible sibling elements with the same tag and
  class (at least 3 items).
- **R2.2** For each item THE SYSTEM SHALL return a ref, a title (≤ 80
  chars), the first price found (parsed in code to a number and currency),
  a rating if one is shown, and the first link, at most `limit` items
  (default 10, max 20) and a fixed character budget.
- **R2.3** WHEN `sortBy` is `price` or `rating` and `order` is `asc` or
  `desc` THE SYSTEM SHALL sort the items in code before the limit is
  applied. Items without that value go last.
- **R2.4** WHEN items load as the page scrolls THE SYSTEM SHALL only read
  what is in the DOM and say "Scroll for more items." when the container is
  taller than the viewport.

**Special inputs**

- **R3.1** WHEN the model calls `set_value` on an `input` of type `date`,
  `time`, `datetime-local`, `month`, `week`, `range` or `color` THE SYSTEM
  SHALL check the value format for that type, set it with the native value
  setter and fire `input` and `change`, and return the value the element
  now has.
- **R3.2** WHEN `set_value` gets a `range` value outside `min` / `max` THE
  SYSTEM SHALL clamp it to the nearest valid step and say so.
- **R3.3** WHEN `set_value` targets any other element THE SYSTEM SHALL
  return "Use type_text for text fields or select_option for lists." and
  change nothing.

**Pop-ups**

- **R4.1** WHEN the model calls `close_overlay` THE SYSTEM SHALL find the
  topmost visible overlay: `dialog[open]`, `[role=dialog]`,
  `[role=alertdialog]`, `[aria-modal=true]`, or a fixed or sticky element
  covering at least 30% of the viewport, or a full-width bar at the top or
  bottom that has a close or decline button (so headers don't count).
- **R4.2** THE SYSTEM SHALL click the first button in it whose name means
  close or decline (close, ×, dismiss, no thanks, not now, reject all,
  necessary only, decline), and otherwise press Escape. It SHALL never click
  a button whose name matches accept, agree, allow, subscribe, sign up,
  buy or the risk words.
- **R4.3** THE SYSTEM SHALL return what it clicked or pressed and whether
  the overlay is gone. WHEN nothing was found THE SYSTEM SHALL return "No
  pop-up found."

**Single-page apps and history**

- **R5.1** WHEN the model calls `wait_for_url` THE SYSTEM SHALL wait until
  `location.href` changes, or matches `contains` when given, or the timeout
  passes (default 5 s, max 30 s), and return the new address or `timeout`.
- **R5.2** WHEN the address changes without a page load during a run THE
  SYSTEM SHALL send the full page list on the next step (as `page-diff.ts`
  does for a URL change today).
- **R5.3** WHEN the model calls `go_forward` THE SYSTEM SHALL ask first,
  like `go_back` (T-001 R4.4).

**Context menus and the user's selection**

- **R6.1** WHEN the model calls `right_click` THE SYSTEM SHALL fire
  `pointerdown`, `mousedown`, `contextmenu`, `pointerup` and `mouseup` on
  the target with the right button, and tell the model to look for the
  menu in the next page list. It SHALL not open the browser's own menu.
- **R6.2** WHEN the model calls `read_selection` THE SYSTEM SHALL return the
  text the user has selected on the page (≤ 2000 chars) and a ref to the
  element that holds it, or "Nothing is selected." Selections inside the
  chat element, password and card fields SHALL not be read.

**Rules for all new tools**

- **R7.1** `set_value`, `right_click` and `close_overlay` SHALL go through
  `riskOf` (they ask when `confirm` is `always`), `go_forward` asks like
  `go_back`, and `close_overlay` SHALL skip any button `riskOf` flags (a
  link to another page, a submit button) instead of clicking it.
- **R7.2** Every new tool that acts on an element SHALL scroll it into view
  and outline it for 1 second (T-001 R7.2) and show a run log line.
- **R7.3** WITH every switch in `AGENT_TUNING` off, the system prompt with
  all tools SHALL stay under 1,500 tokens (4 chars per token, as in
  `agent.bench.spec.ts`), and the shop flow benchmark with every tool SHALL
  run without a session restart. The T-011 targets keep comparing the 27
  tools they were measured with.
- **R7.4** WHEN `screenCapture` is `null` THE SYSTEM SHALL still offer all
  new tools (none of them needs a screenshot).

**Turning tools off**

- **R8.1** WHEN `agent.disabledTools` lists tool names THE SYSTEM SHALL leave
  those tools out of the system prompt and the answer schema, and a call to
  one SHALL get the unknown tool error. Default: `[]`.
- **R8.2** `done` and `fail` SHALL never be turned off. Names that are not
  tools SHALL be ignored.
- **R8.3** The core entry SHALL export the `AgentToolName` type (a union of
  every tool name) and `AGENT_TOOL_NAMES`, kept in sync with the tool list
  by a test.

### Non-goals

- Drag and drop, file uploads, clipboard reads or writes.
- Running page JavaScript (`evaluate_js`) or opening any address in this tab
  (`navigate`). Same reasons as T-001.
- Acting inside iframes or closed shadow roots.
- Accepting cookie banners or newsletter pop-ups for the user.
- Reading items that are not in the DOM yet (virtual lists).
- Native tool calling (T-004).

## Design

### Where the code lives

`agent-tools-more.ts` is about 2,900 tokens, so the new tools go in a new
file, with page work in small helpers:

| File                   | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `agent-tools-extra.ts` | Tool definitions for T-018, exported as `EXTRA_AGENT_TOOLS`   |
| `page-images.ts`       | Image search for `find_images`                                |
| `page-lists.ts`        | Repeated item detection, price and rating parsing, sort       |
| `page-overlays.ts`     | Overlay detection and close button choice for `close_overlay` |

`set_value`, `right_click` and `read_selection` are small and go in
`page-actions.ts` (now about 1,900 tokens). `wait_for_url` goes in
`page-waits.ts`. `go_forward` goes next to `go_back` in `agent-tools.ts`.
`agent-tools.ts` spreads `EXTRA_AGENT_TOOLS` after `MORE_AGENT_TOOLS`.

### Tools

| Group   | Tool             | Args                                                  | Returns                                   |
| ------- | ---------------- | ----------------------------------------------------- | ----------------------------------------- |
| Observe | `find_images`    | `text?`, `limit?` (≤ 20)                              | Images with refs, captions, place         |
| Observe | `extract_list`   | `ref?`, `sortBy?` (price, rating), `order?`, `limit?` | Items: ref, title, price, rating, link    |
| Observe | `read_selection` | —                                                     | Selected text and its ref                 |
| Act     | `set_value`      | `ref`, `value`                                        | New value                                 |
| Act     | `close_overlay`  | —                                                     | What was clicked, whether the pop-up left |
| Act     | `right_click`    | `ref`                                                 | New menu items                            |
| Act     | `go_forward`     | —                                                     | Asks first                                |
| Wait    | `wait_for_url`   | `contains?`, `timeoutMs?`                             | New address / `timeout`                   |

### Prices

`page-lists.ts` reads the first text in an item that looks like a price:
a currency sign or code next to a number, with `,` or `.` as the decimal
mark (the last one followed by 1 or 2 digits). A struck-through price
(`del`, `s`, `line-through`) is skipped when another price is in the item.
Ratings come from `itemprop=ratingValue`, then `aria-label` / `title` / text
like "4.5 out of 5" or "4.5 stars". Each item's ref is its first link (or
button), so the model can click it.

### Prompt size

Each tool line in the system prompt stays one line with short arg names.
The T-011 `shortToolLines` switch must also cover the new tools. The new
`tools-size.spec.ts` (or a case in `agent.bench.spec.ts`) checks R7.3.

### Strings and docs

No new public strings: tool names are model-facing and the run log already
shows the tool name. `agentModeNotes` gets no new step. `README.md` and
`docs/features.md` list the new tools and `agent.disabledTools`. The README
Agent Mode section says it works as an agent loop (observe, pick one tool,
run it, repeat).

### Config

```ts
interface BrowseAiCoreAgentOptions {
  // ...
  /** Tools the agent may not use. `done` and `fail` are always kept. */
  disabledTools?: readonly AgentToolName[]
}
```

`AgentToolName` and `AGENT_TOOL_NAMES` live in the core entry (no Angular
code), next to `AgentConfirmMode`. `agentTools()` takes the resolved list.

## Tasks

- [x] 1. `page-images.ts` + `find_images` — covers R1.1-R1.3 — verify: spec
      with images by alt, caption, background, below the fold.
- [x] 2. `page-lists.ts` + `extract_list` — covers R2.1-R2.4 — verify: spec
      with a product grid (sale prices, `1.299,00 €`, `$12`, no price) sorted
      both ways.
- [x] 3. `set_value` — covers R3.1-R3.3 — verify: spec for each input type
      and a text field.
- [x] 4. `page-overlays.ts` + `close_overlay` — covers R4.1-R4.3 — verify:
      spec with a cookie banner (Accept / Reject), a modal with ×, and a
      page without pop-ups. Accept is never clicked.
- [x] 5. `wait_for_url`, `go_forward`, full list after a URL change — covers
      R5.1-R5.3 — verify: spec using `history.pushState`.
- [x] 6. `right_click`, `read_selection` — covers R6.1, R6.2 — verify: spec
      with a custom context menu and a selection in the chat element.
- [x] 7. `riskOf` list, outline, run log — covers R7.1, R7.2 — verify:
      with `confirm: 'always'` they ask; `go_forward` asks in `risky`.
- [x] 8. Prompt size check and benchmark — covers R7.3, R7.4 — verify:
      `npx ng test browse-ai-core --no-watch --include=**/agent.bench.spec.ts`.
- [x] 9. Demo page: a date and a range input, an image, a cookie banner and
      a pushState link (the shop is the product list) — verify: `ng build
    demo`. The Gemini Nano run is T-019.
- [x] 10. `agent.disabledTools`, `AgentToolName`, `AGENT_TOOL_NAMES` —
      covers R8.1-R8.3 — verify: config and runner specs.
- [x] 11. `README.md` (agent loop, new tools, `disabledTools`),
      `docs/features.md`, `CHANGELOG.md` under `Unreleased` — verify:
      Definition of Done in `principles.md`.

## Open questions

- Should `close_overlay` run on its own before the first step when an
  overlay covers more than half the page, or only when the model calls it?
- Is `extract_list` enough for T-013 / T-014 style tasks, or should
  `find_images` also be offered to the model in the "not visible" case of
  T-014 by the prompt?
- Drag and drop (sliders, sortable lists, kanban boards) comes up often.
  Worth its own spec?

## Progress log

- 2026-11-12: Spec created.
- 2026-11-12: Approved by the user, with R8 (turn single tools off) and the
  README agent loop note added.
- 2026-11-12: Small design changes while building: full-width bars count
  as pop-ups only with a close button (R4.1); `right_click` points to the
  next page list instead of diffing (R6.1); `close_overlay` skips risky
  buttons instead of asking (R7.1); no star icon counting; the T-011
  benchmark leaves the T-018 tools out to compare like with like, and a new
  case runs the shop flow with every tool (R7.3). Tool texts were shortened
  to fit 1,500 tokens.

## Outcome

Shipped in 0.9.0. 8 new tools in `agent-tools-extra.ts`, `page-images.ts`,
`page-lists.ts`, `page-overlays.ts`, plus `set_value` / `right_click` in
`page-actions.ts`, `waitForUrl` in `page-waits.ts` and `go_forward`.
`agent.disabledTools`, `AgentToolName`, `AGENT_TOOL_NAMES` and
`REQUIRED_AGENT_TOOLS` in the core entry. The system prompt with every tool
is under 1,500 tokens.

Checked with automated tests in jsdom only. Not checked: real layout (the
tests give elements fixed boxes), "Scroll for more items." (needs layout),
and runs with Gemini Nano.

Follow-ups: T-019 (check the new tools with Gemini Nano on the demo and
real sites).
