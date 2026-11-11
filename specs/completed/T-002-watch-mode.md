---
id: T-002
title: Watch Mode
status: Done
created: 2026-11-11
approved: 2026-11-11
completed: 2026-11-11
---

# T-002: Watch Mode

A tool that watches one part of the page for a text change the user describes
("tell me when the price drops below 100", "tell me when the status says
Shipped"). The user picks the part of the page with an element picker, like
the one in Chrome DevTools. The page text of that part is checked every 15
seconds. When it changes, the model decides if the change is what the user
asked for. If yes, the chat tells the user and keeps watching until the user
clicks Stop.

## Requirements

### User stories

- As a user, I want to point at a stock price, a ticket count or an order
  status and get told when it changes the way I care about.
- As a user, I want to keep using the page or other parts of the chat while
  it watches.
- As a user, I want it to keep watching after it tells me, until I stop it.

### Acceptance criteria

**Picking what to watch**

- **R1.1** WHEN `features.watchMode` is on THE SYSTEM SHALL list "Watch Mode"
  in the Tools select, in the "Agents" group. Default: off.
- **R1.2** WHEN Watch Mode is picked THE SYSTEM SHALL show a "Select element"
  button in the tool card.
- **R1.3** WHEN the user clicks "Select element" THE SYSTEM SHALL start the
  picker: the element under the pointer gets an outline and a label with its
  tag, id, classes and size; scrolling and moving the pointer update it.
- **R1.4** WHILE the picker is active THE SYSTEM SHALL let the user move the
  selection to the parent or first child with the Arrow Up / Arrow Down keys.
- **R1.5** WHEN the user clicks an element THE SYSTEM SHALL stop the picker,
  keep that element, and show it in the tool card with a short text preview
  (≤ 120 chars) and "Change" / "Remove" buttons. The click SHALL not reach the
  page.
- **R1.6** WHEN the user presses Escape THE SYSTEM SHALL cancel the picker
  without a selection.
- **R1.7** The picker SHALL ignore the chat element, password fields and card
  fields.
- **R1.8** WHEN the picked element has no text and no form value THE SYSTEM
  SHALL say "This element has no text to watch" and not accept it.

**Starting**

- **R2.1** WHILE no element is selected OR the prompt is empty THE SYSTEM
  SHALL keep the Start button disabled and show which one is missing.
- **R2.2** WHEN the user starts a watch THE SYSTEM SHALL save the element's
  current text as the baseline, show "Watching <element label>" with the
  instruction and a Stop button, and keep the selected element outlined
  with a small "Watching" badge on the page.

**Checking for changes**

- **R3.1** WHILE watching THE SYSTEM SHALL check the element every
  `watch.intervalMs` (default 15000, minimum 5000).
- **R3.2** WHEN the element's watched text has not changed since the last
  check THE SYSTEM SHALL not call the model.
- **R3.3** WHEN the watched text has changed THE SYSTEM SHALL send the model
  the instruction, the baseline text, the previous text, the current text, the
  changed lines, and the numbers found in the previous and current text, and
  ask for `{ matches, confidence, message }`.
- **R3.4** WHEN `matches` is true AND `confidence` ≥ `watch.threshold`
  (default 0.7) THE SYSTEM SHALL post a chat message with the time, the old and
  new text (short), and the model's message, and flash the element outline.
- **R3.5** WHEN the model reports a match for a text it already reported THE
  SYSTEM SHALL not post again.
- **R3.6** WHEN the check fails (model error, bad JSON) THE SYSTEM SHALL retry
  on the next tick, and after 3 failures in a row post one warning and keep
  watching.
- **R3.7** WHEN a match is posted THE SYSTEM SHALL keep watching. Only Stop,
  removing the element, a new chat, or the page unloading ends the watch.

**Keeping track of the element**

- **R4.1** WHEN the watched element is removed and a new element appears in
  its place (common in React/Vue/Angular re-renders) THE SYSTEM SHALL find it
  again by its saved locator and keep watching.
- **R4.2** WHEN the element can't be found for 3 checks in a row THE SYSTEM
  SHALL post "The watched element is gone" once, keep trying, and say when it
  is back.

**While the chat is closed**

- **R5.1** WHEN the chat panel is closed during a watch THE SYSTEM SHALL keep
  watching.
- **R5.2** WHEN a match is posted while the panel is closed THE SYSTEM SHALL
  show an unread dot on the launcher.
- **R5.3** WHILE watching THE SYSTEM SHALL show a small "watching" indicator on
  the launcher.

**Stopping**

- **R6.1** WHEN the user clicks Stop THE SYSTEM SHALL stop the timer and the
  observer, abort a running model call, remove the page outline and badge, and
  post "Stopped watching" with the number of checks and matches.

### Non-goals

- Visual changes (colors, images, layout, canvas). Only text and form values.
- Watching more than one element per chat at a time (see Open questions).
- Watching when the tab is closed or the page reloads.
- Browser or system notifications (see Open questions).
- Changes inside cross-origin iframes or closed shadow roots.

## Design

### Where the code lives

`projects/browse-ai-core/angular/src/lib/tools/watch/`:

| File                        | What it does                                                     |
| --------------------------- | ---------------------------------------------------------------- |
| `element-picker.service.ts` | DevTools-style picker (outline, label, parent/child keys)        |
| `element-locator.ts`        | Saves a locator for an element and finds it again                |
| `watched-text.ts`           | Reads and normalizes the text of an element; diff lines; numbers |
| `watch-runner.service.ts`   | Timer, observer, change check, model call, state signals         |
| `watch-prompt.ts`           | Builds the check prompt and reads the answer                     |
| `watch-card.component.ts`   | Tool card: selection, status, Stop                               |

The picker extends what `DomInspectorService` (DOM Element to Component)
does: hover outline, click to pick, Escape to cancel, ignore the chat host.
The shared part moves into `page/element-picker.ts` and both tools use it, so
there is one picker. The label and the parent/child keys are new.

### What "text" means

`watched-text.ts` reads, for the element and its subtree:

- `innerText` (visible text only, so hidden template text is ignored),
- `value` of inputs, selects and text areas (not password or card fields),
- `aria-valuenow`, `aria-valuetext`, `aria-label` when there is no text.

Whitespace is collapsed. The result is capped at 4,000 characters. If the
element's text is longer, the tool card says so before Start and suggests
picking a smaller part (R1.8 style message), but allows it.

### Change detection: observer plus timer

Why both:

- A `MutationObserver` on the element (`childList`, `subtree`,
  `characterData`, `attributes` limited to `value`, `aria-valuenow`,
  `aria-valuetext`) sets a `dirty` flag. It costs almost nothing and catches
  every DOM change between ticks.
- The 15-second timer does the real check, so a price that changes ten times
  a second makes at most one model call per 15 seconds.
- On each tick the text is read again even when `dirty` is false, because
  some changes don't produce mutations on the watched node (form `value` set
  by script, the node replaced by a parent re-render). Reading text is cheap;
  the model call only happens when the text differs (R3.2).

Each tick:

1. If the element is not connected, find it again (R4.1).
2. Read the text. If it equals the previous text, stop here.
3. Build the prompt (below) and call the model with the watch's
   `AbortSignal`.
4. Parse `{ matches: boolean, confidence: number, message: string }` with
   `ai/json-response.ts` (and `responseConstraint` if ADR 0001 is accepted).
5. If it matches with enough confidence and this text was not reported yet,
   post the message (R3.4, R3.5).
6. Previous text = current text.

A tick never starts while the previous one is still waiting for the model.

Hidden tabs: Chrome slows timers in background tabs to about once per minute.
Checks may be late there. This is stated in the "How to use" box.

### The check prompt

Fixed size per decision 16 (about 6,000 characters in total):

```
You watch part of a web page for the user.
User's instruction: <instruction>
Text when watching started: <baseline, ≤ 1500 chars>
Text at the last check: <previous, ≤ 1500 chars>
Text now: <current, ≤ 1500 chars>
Changed lines: <diff, ≤ 1000 chars>
Numbers before: 101.20, 3   Numbers now: 99.80, 3
Does the change from the last check to now match what the user asked for?
Answer with JSON: {"matches": true|false, "confidence": 0..1, "message": "<one sentence for the user>"}
```

Numbers are pulled out in code (with the page language's decimal separator)
so the model does not have to find them in long text. Both the baseline and
the previous text are sent, because "tell me when it changes" compares with
the last check, and "tell me when it is 20% lower" compares with the start.

One model session per watch with this as the system prompt. Each check is one
`prompt()` call. When `contextUsage` gets near `contextWindow`, the session is
destroyed and created again (the checks don't need each other's history).

### Locator (R4.1)

Saved at pick time:

- a CSS path from the nearest ancestor with an `id` (or `body`), using
  tag + `:nth-of-type`,
- the element's tag, id, stable-looking classes (no hashed class names),
  `data-testid` / `data-test` / `name` / `aria-label`,
- the text of the closest label or heading before it.

Finding again tries: `id` → test id → CSS path → tag + classes under the same
labelled ancestor. The first hit whose tag matches wins.

### Config (public API, needs approval)

```ts
features: { watchMode: boolean }   // default false
watch?: {
  intervalMs?: number              // default 15000, min 5000
  threshold?: number               // default 0.7
}
```

Strings: `watchMode`, `watchModeName`, `watchModeDescription`,
`watchModeNotes`, `watchSelectElement`, `watchChange`, `watchRemove`,
`watchStart`, `watchStop`, `watchWatching`, `watchNeedElement`,
`watchNeedInstruction`, `watchNoText`, `watchTooLong`, `watchElementGone`,
`watchElementBack`, `watchStopped`, `watchCheckFailed`.

Events: `watchMatched` (`{ instruction, previous, current, message,
confidence }`) so a host app or the extension can show its own notification.

## Tasks

- [x] 1. Move the shared picker out of `DomInspectorService` into
      `page/element-picker.ts`; DOM Element to Component keeps working —
      verify: existing dom-to-component tests pass.
- [x] 2. Picker label and parent/child keys, ignore password/card/chat —
      covers R1.3, R1.4, R1.6, R1.7 — verify: unit tests with keyboard events.
- [x] 3. `watched-text.ts`: read, normalize, cap, diff lines, numbers —
      covers R1.8, R3.3 — verify: unit tests (inputs, hidden text, decimal
      comma, long text).
- [x] 4. `element-locator.ts` — covers R4.1, R4.2 — verify: unit test that
      replaces the node with an equal one and finds it again.
- [x] 5. `watch-prompt.ts`: prompt within size limit, answer parsing —
      covers R3.3, R3.4, R3.6 — verify: unit tests for size cap and bad JSON.
- [x] 6. `watch-runner.service.ts`: observer, timer, skip when unchanged,
      no overlapping ticks, dedupe, failures, abort on stop — covers R2.2,
      R3.1–R3.7, R6.1 — verify: unit tests with fake timers and a fake
      `AiProvider`; assert no model call when text is unchanged.
- [x] 7. Tool card, Start disabled rules, launcher indicator and unread dot,
      page outline and badge — covers R1.1, R1.2, R1.5, R2.1, R5.1–R5.3 —
      verify: component tests.
- [x] 8. Config `watch`, strings, `watchMatched` event on the element and
      wrappers — verify: config and wrapper tests, `npm run test:element`.
- [ ] 9. (Demo ticker done; manual Nano run moved to T-003.) Demo page with a fake ticker that changes every few seconds; manual
      run with Gemini Nano for "below X", "changes at all", "says Shipped" —
      verify: record results in the Progress log.
- [x] 10. README, `docs/features.md`, `docs/architecture.md`, CHANGELOG —
      verify: review.

## Open questions

Resolved on 2026-11-11 by the user:

1. One watch per chat for now: yes.
2. Chat message plus `watchMatched` event only: yes.
3. Shared picker: left to the implementer (see Progress log).
4. Threshold: config only (`watch.threshold`), default 0.7.

## Progress log

- 2026-11-11: Spec created as Draft.
- 2026-11-11: Approved by the user in chat; default changed to off (R1.1),
  listed in the "Agents" group with Agent Mode.
- 2026-11-11: Design change (task 1): the picker stays in
  `DomInspectorService` and is extended (Arrow Up / Down, `accept` filter,
  picked element in the selection) instead of moving to `page/`. Both tools
  use it. It no longer picks `<body>` or `<html>`.
- 2026-11-11: Design change: the `MutationObserver` keeps up to 5 texts seen
  between checks (throttled to 4 per second) instead of a dirty flag. They
  are sent with the next check, so a short change is not lost. The model is
  still only asked when something changed.
- 2026-11-11: Design change: the watch session prompt mentions start and last
  check; a failing check keeps the previous text, so the next tick retries.
- 2026-11-11: Task 9 (manual run with Gemini Nano) not done: no Chrome with
  the built-in model here. The demo ticker is added; the manual check moved
  to T-003.

## Outcome

Shipped in 0.5.0. Code in `angular/src/lib/tools/watch/` and
`components/agents/watch-panel.component.ts`, launcher dots in
`components/launcher/`. Tests in `watch.spec.ts`, `agents-panels.spec.ts` and
`chat-session.store.spec.ts`. All automated checks pass.

Deviations: see the Progress log (picker kept in place, observer keeps texts).

Not verified: behaviour with the real Gemini Nano model (T-003).

Follow-ups: T-003 (manual check), T-005 (several watches at once), T-006
(optional browser notification).
