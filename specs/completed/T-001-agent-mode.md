---
id: T-001
title: Agent Mode
status: Done
created: 2026-11-11
approved: 2026-11-11
completed: 2026-11-11
---

# T-001: Agent Mode

A tool that does a task on the page for the user. It looks at the page
(screenshots and a short list of page elements), picks an action, runs it,
looks again, and repeats until the task is done, it needs the user, or it hits
a limit.

## Requirements

### User stories

- As a user, I want to type a task ("add the cheapest red shirt in size M to
  the cart") and have the assistant do the clicks and typing for me.
- As a user, I want to see each step the assistant takes and stop it at any
  time.
- As a user, I want the assistant to ask me before it does something I can't
  undo (pay, send, delete, submit).
- As a developer using the package, I want to turn Agent Mode on or off and
  limit how far it can go.

### Acceptance criteria

**Starting and stopping**

- **R1.1** WHEN `features.agentMode` is on THE SYSTEM SHALL list "Agent Mode"
  in the Tools select, in an "Agents" group right after Forms. Default: off.
- **R1.2** WHEN Agent Mode is picked and the prompt is empty THE SYSTEM SHALL
  keep the Send button disabled (the task text is required).
- **R1.3** WHEN the user sends a task THE SYSTEM SHALL start an agent run and
  show a Stop button in place of Send.
- **R1.4** WHEN the user clicks Stop, starts a new chat, or closes the tool
  THE SYSTEM SHALL abort the current model request and any wait within 1
  second, run no further actions, and show "Stopped" in the run log.

**The loop**

- **R2.1** WHEN a run starts THE SYSTEM SHALL repeat: observe the page, send
  the task, the step history and the observation to the model, read one tool
  call from the answer, check it, run it, record the result.
- **R2.2** WHEN the model calls `done` THE SYSTEM SHALL end the run and show
  its summary as the answer.
- **R2.3** WHEN the model calls `fail` THE SYSTEM SHALL end the run and show
  the reason.
- **R2.4** WHEN the run reaches `agent.maxSteps` (default 25) or
  `agent.maxDurationMs` (default 5 minutes) THE SYSTEM SHALL end the run and
  say which limit was hit and what was done so far.
- **R2.5** WHEN the model answer is not a valid tool call THE SYSTEM SHALL
  send the error back to the model once as the step result. WHEN it fails 3
  times in a row THE SYSTEM SHALL end the run with an error.
- **R2.6** WHEN a tool throws or its target is gone THE SYSTEM SHALL return the
  error text to the model as the step result instead of ending the run.
- **R2.7** WHEN the history no longer fits the model's input quota THE SYSTEM
  SHALL keep the task, the last 5 steps in full and a one-line summary of each
  older step.

**Observing the page**

- **R3.1** WHEN the agent observes the page THE SYSTEM SHALL build a page
  state: URL, title, scroll position, viewport size, and a numbered list of
  visible interactive elements (role, accessible name, value, state, box), at
  most 150 elements and a fixed character budget.
- **R3.2** WHEN the model calls `screenshot` THE SYSTEM SHALL capture the
  visible area through the `screenCapture` adapter, draw the element numbers
  on it, and send the image to the model on the next step.
- **R3.3** WHEN `screenCapture` is `null` or the model has no image input THE
  SYSTEM SHALL not offer the `screenshot` tool and work from the text page
  state only.
- **R3.4** Element numbers SHALL map to elements through an in-memory map. The
  page DOM SHALL not be changed to store them.

**Acting**

- **R4.1** WHEN a click, type, select, check, key, hover or scroll tool runs
  THE SYSTEM SHALL scroll the target into view, then fire the same events a
  user would cause (pointer, mouse, focus, key, input, change), using the
  native value setter for fields so framework forms see the change.
- **R4.2** THE SYSTEM SHALL never read, fill or click inside password, card
  number, CVC or one-time-code fields, and never act on the chat element.
- **R4.3** WHEN an action looks risky (see Design → Risky actions) THE SYSTEM
  SHALL pause, show the action and its target with Allow and Deny, and only
  run it after Allow. Deny is returned to the model as the step result.
- **R4.4** WHEN an action would navigate the page away THE SYSTEM SHALL ask
  first, as in R4.3, and tell the user the run ends when the page unloads.

**Waiting**

- **R5.1** WHEN the model calls `wait` THE SYSTEM SHALL sleep for the given
  time, at most 10 seconds per call.
- **R5.2** WHEN the model calls `wait_for` THE SYSTEM SHALL poll until a
  selector or text appears or disappears, or the timeout passes (default 5 s,
  max 30 s), and return which happened.
- **R5.3** WHEN the model calls `wait_for_idle` THE SYSTEM SHALL wait until
  the page has had no DOM changes and no new network requests for 500 ms, or
  the timeout passes.
- **R5.4** WHEN any action that changes the page finishes THE SYSTEM SHALL
  wait for idle (max 3 s) before the next observation, without a model call.

**Asking the user**

- **R6.1** WHEN the model calls `ask_user` THE SYSTEM SHALL show the question
  in the chat, pause the run, and continue with the user's next message as
  the step result.

**Showing progress**

- **R7.1** WHILE a run is active THE SYSTEM SHALL show a run log in the tool
  card: one line per step with the tool, a short target description and the
  result (ok, error, denied).
- **R7.2** WHEN an action runs on an element THE SYSTEM SHALL outline that
  element on the page for 1 second.

### Non-goals

- Continuing a run after the page unloads or navigates (full page load).
- Acting across tabs, opening tabs, or reading other tabs.
- Acting inside cross-origin iframes or closed shadow roots.
- Drag and drop, file uploads, canvas drawing.
- Solving CAPTCHAs or logging in with stored passwords.
- Visual pixel-level clicks by coordinates. Actions target elements.

## Design

### Where the code lives

`projects/browse-ai-core/angular/src/lib/tools/agent/`:

| File                         | What it does                                                      |
| ---------------------------- | ----------------------------------------------------------------- |
| `agent-runner.service.ts`    | The loop, limits, abort, history, step log signals                |
| `agent-tools.ts`             | Tool definitions: name, description, JSON schema of args, handler |
| `agent-protocol.ts`          | Builds the step prompt, parses and checks the tool call           |
| `page-snapshot.ts`           | Visible interactive elements → numbered list + ref map            |
| `page-actions.ts`            | Click, type, select, check, key, hover, scroll with real events   |
| `page-waits.ts`              | `sleep`, `waitFor`, `waitForIdle` (MutationObserver + poll)       |
| `risk-check.ts`              | Decides if an action needs confirmation                           |
| `agent-run-log.component.ts` | Run log and the Allow / Deny prompt                               |

`insert-text.ts`, `reveal-element.ts`, `marker-layer.ts` and the
`screenCapture` adapter are reused. Each file stays under the 5,000-token
limit.

### Tool calling

Gemini Nano has no native function calling in the `AiProvider` interface.
The model answers each step with one JSON object, checked against a JSON
schema built from the tool list:

```json
{
  "thought": "The size select is #12",
  "tool": "select_option",
  "args": { "ref": 12, "value": "M" }
}
```

When the provider supports `responseConstraint` (Chrome Prompt API does), the
schema is passed so the model can only produce valid shapes. Otherwise the
answer is read with `ai/json-response.ts` and checked in code. See
[ADR 0001](../decisions/0001-agent-tool-calls-as-json.md).

The system prompt lists each tool with a one-line description and its
arguments. It is built once per run.

### Tools

| Group   | Tool             | Args                                        | Returns                                          |
| ------- | ---------------- | ------------------------------------------- | ------------------------------------------------ |
| Observe | `get_page_state` | —                                           | Page state (R3.1). Sent automatically each step. |
| Observe | `screenshot`     | —                                           | Image with element numbers, on the next step     |
| Observe | `query_selector` | `selector`, `limit?` (≤ 20)                 | Matches with new refs: tag, text (≤ 120 chars)   |
| Observe | `find_text`      | `text`                                      | Elements containing the text, with refs          |
| Observe | `read_element`   | `ref`, `maxChars?` (≤ 2000)                 | Element text and attributes                      |
| Act     | `click`          | `ref`                                       | ok / error                                       |
| Act     | `type_text`      | `ref`, `text`, `clear?`, `submit?`          | ok / error; `submit` presses Enter               |
| Act     | `select_option`  | `ref`, `value` (value or label)             | Selected option                                  |
| Act     | `set_checked`    | `ref`, `checked`                            | New state                                        |
| Act     | `press_key`      | `key`, `ref?`                               | ok (Enter, Escape, Tab, arrows, PageDown…)       |
| Act     | `hover`          | `ref`                                       | ok (opens hover menus)                           |
| Act     | `scroll`         | `direction`, `amount?` or `ref`             | New scroll position, whether the end was reached |
| Act     | `go_back`        | —                                           | Asks first (R4.4)                                |
| Wait    | `wait`           | `ms` (≤ 10000)                              | ok                                               |
| Wait    | `wait_for`       | `selector` or `text`, `state`, `timeoutMs?` | `appeared` / `disappeared` / `timeout`           |
| Wait    | `wait_for_idle`  | `timeoutMs?`                                | `idle` / `timeout`                               |
| Control | `ask_user`       | `question`                                  | The user's answer                                |
| Control | `done`           | `summary`                                   | Ends the run                                     |
| Control | `fail`           | `reason`                                    | Ends the run                                     |

Not included on purpose: `evaluate_js` (runs any code on the page; too much
power for a small model) and `navigate(url)` (see Non-goals).

### Page state

- Interactive: `a[href]`, `button`, `input`, `select`, `textarea`,
  `[role=button|link|checkbox|radio|tab|menuitem|option|switch|combobox]`,
  `[contenteditable]`, `[tabindex]` ≥ 0, elements with a click handler
  attribute.
- Visible: in or near the viewport (one screen above and below), non-zero box,
  not `display:none`/`visibility:hidden`/`opacity:0`, not covered at its
  center (`elementFromPoint`).
- Open shadow roots and same-origin iframes are walked.
- One line per element, e.g. `[12] select "Size" value="S" options=S,M,L`.
- Refs are rebuilt each observation. A ref from an old observation that is no
  longer connected returns "element gone, observe again".

### Screenshots

- Badges with element numbers are drawn with `MarkerLayer` just before
  capture and removed right after, so the model can match what it sees to
  refs (set-of-marks).
- The image is scaled down to at most 1024 px wide before sending.
- On a normal web page the `screenCapture` adapter uses `getDisplayMedia`.
  The user is asked for screen access once per run, not per screenshot.

### Waits

- `sleep(ms, signal)` rejects on abort.
- `waitFor` checks on each `MutationObserver` callback and also every 250 ms
  (for changes the observer misses, such as style changes from classes on
  ancestors), until match, timeout or abort.
- `waitForIdle` tracks DOM mutations with `MutationObserver` and requests with
  `PerformanceObserver` (`resource` entries). Idle = 500 ms with neither.

### Risky actions

Confirmation is needed when any of these hold:

- The target is a submit button, or pressing Enter in a form field submits a
  form.
- The target's text, label or nearby heading matches the `agentRiskWords`
  list (buy, pay, order, checkout, delete, remove, send, publish, confirm,
  subscribe, unsubscribe, transfer, …). The list is in `strings` so it can be
  translated.
- The action navigates: a link to another URL, `go_back`.
- `agent.confirm` is `'always'`.

`agent.confirm`: `'risky'` (default), `'always'`, `'never'`. `'never'` still
blocks R4.2.

### Config (public API, needs approval)

```ts
features: { agentMode: boolean }        // default false
agent?: {
  maxSteps?: number                     // default 25
  maxDurationMs?: number                // default 300000
  confirm?: 'risky' | 'always' | 'never' // default 'risky'
}
```

Strings: `agentMode`, `agentModeName`, `agentModeDescription`,
`agentModeNotes`, `agentStop`, `agentStopped`, `agentAllow`, `agentDeny`,
`agentConfirmTitle`, `agentLimitReached`, `agentRiskWords`, step labels per
tool.

Events: `agentStep` (`{ step, tool, args, result }`) and `agentFinished`
(`{ status: 'done' | 'failed' | 'stopped' | 'limit', summary }`).

### Model session

One session per run, created with the agent system prompt and `expectedInputs`
`['text', 'image']` when screenshots are on. Destroyed when the run ends.
Each step is one `prompt()` call with the `AbortSignal` of the run.

## Tasks

- [x] 1. ADR 0001 accepted; add `responseConstraint` to `AiRequestOptions` and
      pass it through in `chromeLanguageModelProvider` — covers R2.1, R2.5 —
      verify: unit test that the option reaches `LanguageModel` prompt call.
- [x] 2. `page-waits.ts`: `sleep`, `waitFor`, `waitForIdle` with abort —
      covers R5.1–R5.4, R1.4 — verify: unit tests with fake timers and DOM
      changes.
- [x] 3. `page-snapshot.ts`: interactive element list, visibility, ref map,
      budget — covers R3.1, R3.4, R4.2 — verify: unit tests on fixture pages
      (hidden, covered, shadow root, password field skipped).
- [x] 4. `page-actions.ts`: each action with real events and native setter —
      covers R4.1, R4.2 — verify: unit tests that a React-style controlled
      input and a select see the change; chat element is refused.
- [x] 5. `risk-check.ts` — covers R4.3, R4.4 — verify: unit tests per rule.
- [x] 6. `agent-tools.ts` + `agent-protocol.ts`: tool table, schema, prompt,
      parse and check — covers R2.1, R2.5, R2.6 — verify: unit tests for
      valid, invalid and unknown tool calls.
- [x] 7. `agent-runner.service.ts`: loop, limits, history trimming, abort,
      `ask_user` pause — covers R1.3, R1.4, R2.1–R2.7, R6.1 — verify: unit
      tests with a fake `AiProvider` scripted to call tools.
- [x] 8. Screenshot step with number badges and scaling — covers R3.2, R3.3 —
      verify: unit test with a fake `screenCapture`; manual check in the demo.
- [x] 9. Tool registration, feature switch, strings, "How to use" box, run log
      and Allow/Deny UI, element outline — covers R1.1, R1.2, R4.3, R7.1, R7.2
      — verify: component tests.
- [x] 10. Config `agent`, events `agentStep` / `agentFinished`, element and
      React/Vue wrapper events — covers R2.4, R4.3 — verify: config and
      wrapper tests, `npm run test:element`.
- [ ] 11. (Demo page done; manual Nano run moved to T-003.) Demo page with a small shop form (search, select, add to cart,
      checkout) and a manual run with Gemini Nano — covers all — verify:
      record which tasks pass in the Progress log.
- [x] 12. README, `docs/features.md`, `docs/architecture.md`, CHANGELOG —
      verify: review.

## Open questions

Resolved on 2026-11-11 by the user:

1. Off by default: yes. Listed in a new "Agents" group right after Forms.
2. Public API (config, strings, events, `responseConstraint`): approved.
   Native tool calling stays a later option (ADR 0001).
3. Continuing after navigation: out of scope.
4. Nano quality: accepted as a known limit.
5. `getDisplayMedia` dialog for screenshots on web pages: accepted.

## Progress log

- 2026-11-11: Spec created as Draft.
- 2026-11-11: Approved by the user in chat; Agents group after Forms.
- 2026-11-11: Design change: one model session per run keeps the history;
  each step sends only the last step and the page. When the session is 75%
  full (or the model reports the quota is exceeded), a new session starts
  with a recap (last 5 steps in full, older ones on one line). Meets R2.7.
- 2026-11-11: Design change: bad answers (R2.5) go back as a NOTE in the next
  prompt and are not counted as steps.
- 2026-11-11: Design change: refs stay the same for an element for the whole
  run (WeakMap), instead of being rebuilt each step.
- 2026-11-11: Design change: no per-tool step label strings; the run log shows
  the tool name and the element's name. Stop, limits and errors return the
  answer with the step list instead of an error message.
- 2026-11-11: Task 11 (manual run with Gemini Nano) not done: no Chrome with
  the built-in model in this environment. The demo shop is added; the manual
  check moved to T-003.

## Outcome

Shipped in 0.5.0. Code in `angular/src/lib/tools/agent/` and
`components/agents/agent-panel.component.ts`, tests in `agent.spec.ts`,
`agents-panels.spec.ts` and `chat-session.store.spec.ts`. All automated
checks pass (`npm test`, `npm run build`, `npm run test:element`).

Deviations: see the Progress log (session recap, refs, run log labels).

Not verified: behaviour with the real Gemini Nano model (T-003).

Follow-ups: T-003 (manual check with Gemini Nano), T-004 (native tool calling
when the Prompt API `tools` option is stable).
