---
id: T-011
title: Optimize Agent Mode
status: Done
created: 2026-11-12
approved: 2026-11-12
completed: 2026-11-12
---

# T-011: Optimize Agent Mode

Make Agent Mode faster with Gemini Nano without making it worse at tasks. On
device, step time grows with the text the model reads and writes, so fewer
characters in and out is the main lever. Lower cost on paid providers comes
as a side effect.
Today each step sends the full page list (up to 9,000 chars) into a session
that already holds the earlier pages, so the session fills fast and has to be
rebuilt with a recap. The system prompt lists all 27 tools with their full
argument text. The answer schema does not check `args`, so wrong arguments
cost a full extra model call. On the page side, each observation walks the
whole DOM and measures every element more than once.

Builds on T-001 (Agent Mode), T-008 (steering) and T-009 (more tools). Uses
[ADR 0001](../decisions/0001-agent-tool-calls-as-json.md) as is.

## Requirements

### User stories

- As a user with Gemini Nano, I want Agent Mode to finish tasks in less
  time, so that I don't sit and wait for each step.
- As a user of a small on-device model, I want the agent to stay inside the
  model's context, so that it does not lose track of the task halfway.

### Acceptance criteria

**Measuring**

- **R1.1** THE SYSTEM SHALL have a benchmark test that runs scripted agent
  runs on fixed fixture pages (the demo shop flow and a long list page) with a
  fake `AiProvider`, and records: model calls, characters sent (system prompt
  plus step prompts), session restarts, and time spent in `takeSnapshot`.
- **R1.2** The baseline numbers from R1.1 for the current code SHALL be
  written in the Progress log before any other task starts, and the final
  numbers in the Outcome.

**Smaller step prompts**

- **R2.1** WHEN the URL is the same as at the last observation THE SYSTEM
  SHALL send only the page changes: elements added, elements removed (by ref)
  and elements whose line changed, plus the URL, title and scroll line.
- **R2.2** WHEN the URL changed, the session is new (recap), a screenshot is
  attached, or the changes are longer than the full list THE SYSTEM SHALL send
  the full page list as today.
- **R2.3** WHEN the last tool did not change the page (`changesPage` is false)
  and the page has no changes THE SYSTEM SHALL send `PAGE: unchanged` instead
  of the list.
- **R2.4** Element positions (`@x,y`) SHALL not by themselves count as a
  change, so scrolling does not resend every element.
- **R2.5** On the benchmark (R1.1), the characters sent per run SHALL drop by
  at least 40% against the baseline, and session restarts SHALL not go up.

**Smaller system prompt**

- **R3.1** THE SYSTEM SHALL build the system prompt from short tool lines:
  name, argument names with types, and a description of at most one sentence.
  Long tool notes stay out of the prompt.
- **R3.2** On the benchmark, the system prompt SHALL be at least 30% shorter
  than the baseline.

**Fewer wasted model calls**

- **R4.1** WHEN the provider supports `responseConstraint` THE SYSTEM SHALL
  pass a schema where `args` depends on `tool` (one `anyOf` branch per tool,
  with required args, types and enums), so wrong arguments can't be produced.
- **R4.2** WHEN a provider rejects that schema THE SYSTEM SHALL fall back to
  the current loose schema for the rest of the session, then to no schema, as
  `promptWithSchema` does today.
- **R4.3** THE `thought` field SHALL be limited to 200 characters in the
  schema and cut to 200 characters in code.
- **R4.4** WHEN the model calls the same tool with the same args 3 steps in a
  row and the page did not change THE SYSTEM SHALL add a NOTE that the step
  had no effect and it should try something else.

**Faster page work**

- **R5.1** `takeSnapshot` SHALL measure each element's box once per
  observation and reuse it for visibility, cover check and ordering.
- **R5.2** WHEN the page has had no DOM mutation, scroll or resize since the
  last observation THE SYSTEM SHALL reuse the last snapshot instead of walking
  the DOM again.
- **R5.3** WHEN an action finishes and the page is already idle THE SYSTEM
  SHALL start the next observation without waiting the full idle window
  (R5.4 of T-001 keeps its 3 s maximum).
- **R5.4** On the benchmark, time in `takeSnapshot` per run SHALL drop by at
  least 30% against the baseline.

**No change in behavior**

- **R6.1** All existing Agent Mode tests (`agent.spec.ts`,
  `agent-tools-more.spec.ts`, `agents-panels.spec.ts`) SHALL pass without
  changes to what they assert.
- **R6.2** Public config, strings, events and exports SHALL not change.
- **R6.3** Refs SHALL stay stable for the whole run, as today (WeakMap).

### Non-goals

- Native tool calling (T-004).
- Several tool calls per step (rejected in ADR 0001).
- Changing the step limit, time limit or risk rules.
- Checking quality with real Gemini Nano. That is T-003; this spec only
  checks that the scripted runs still pass.
- New tools or removing tools.

## Design

### Where the code changes

| File                        | Change                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| `page-snapshot.ts`          | One box read per element; `diffSnapshot(prev, next)`             |
| `page-observer.ts` (new)    | Dirty flag from `MutationObserver`, scroll and resize            |
| `agent-protocol.ts`         | Short tool lines, per-tool schema, `PAGE` as full/diff/unchanged |
| `agent-runner.service.ts`   | Keeps the last snapshot, picks full/diff, repeat-step NOTE       |
| `page-waits.ts`             | `waitForIdle` returns early when already idle                    |
| `agent.bench.spec.ts` (new) | Benchmark from R1.1                                              |

Each file stays under the 5,000-token limit. `agent-protocol.ts` is near
7 KB; if the schema builder pushes it too far, move it to
`agent-schema.ts`.

### Page diff

The snapshot keeps lines keyed by ref, with the position part split off. The
diff is:

```
SCROLL: 1200 of 4800, viewport 1280x720
ELEMENTS CHANGED since the last step (38 others are the same):
+ [41] button "Add to cart" @612,430
~ [9] select "Size" value="M" options=S|M|L @200,310
- gone: [12] [17]
```

Any session restart (recap) sends the full list, so the model never relies
on a diff whose base it no longer has.

### Per-tool schema

Built once per run from the tool table:

```json
{
  "type": "object",
  "anyOf": [
    {
      "properties": {
        "thought": { "type": "string", "maxLength": 200 },
        "tool": { "const": "click" },
        "args": {
          "type": "object",
          "properties": { "ref": { "type": "number" } },
          "required": ["ref"]
        }
      },
      "required": ["tool", "args"]
    }
  ]
}
```

`parseAgentCall` keeps checking in code, since some providers ignore the
schema.

### Snapshot reuse

`page-observer.ts` starts with the run and stops when it ends. It sets a
dirty flag on any mutation outside the chat element, scroll or resize.
`takeSnapshot` is skipped when the flag is clear. The cover check
(`elementFromPoint`) depends on layout, so any of these events clears the
cache.

## Tasks

- [x] 1. Benchmark spec with fixture pages and a scripted fake provider that
      counts calls, characters and restarts — covers R1.1, R1.2 — verify:
      runs in `npm test`; baseline written to the Progress log.
- [x] 2. One box read per element in `takeSnapshot` — covers R5.1 — verify:
      existing snapshot tests pass; spy counts one `getBoundingClientRect`
      per element.
- [x] 3. `page-observer.ts` and snapshot reuse — covers R5.2, R6.3 — verify:
      unit tests: no change → same snapshot object; mutation, scroll, resize
      → new snapshot; mutations inside the chat element ignored.
- [x] 4. Early return in `waitForIdle` — covers R5.3 — verify: fake-timer
      test that an idle page resolves after the idle window, not 3 s.
- [x] 5. `diffSnapshot` and the full/diff/unchanged choice in the runner —
      covers R2.1–R2.4 — verify: unit tests for each case, including URL
      change, recap and screenshot steps.
- [x] 6. Short tool lines in the system prompt — covers R3.1 — verify: unit
      test that each tool appears once and no line is over 160 chars.
- [x] 7. Per-tool `anyOf` schema, `thought` limit and fallback — covers
      R4.1–R4.3 — verify: unit tests for the schema shape and for a provider
      that throws `NotSupportedError` on it.
- [x] 8. Repeat-step NOTE — covers R4.4 — verify: scripted run that clicks
      the same ref 3 times gets the NOTE.
- [x] 9. (R5.4 met on the list only; see Outcome.) Run the benchmark, compare with the baseline — covers R2.5, R3.2,
      R5.4 — verify: numbers meet the targets; write them in the Outcome.
- [x] 10. Full check — covers R6.1, R6.2 — verify: `npm test`,
      `npm run build`, `npm run test:element` pass; no diff in the public
      API files (`config.ts`, `strings-*.ts`, `events.ts`, `public-api.ts`).
- [x] 11. `docs/architecture.md` and `CHANGELOG.md` under `Unreleased` —
      verify: review. README only if a user-facing behavior changes.

## Open questions

1. Resolved 2026-11-12: the goal is speed with Gemini Nano. The targets in
   R2.5, R3.2 and R5.4 are kept and can change after the baseline in task 1.
2. Resolved 2026-11-12: page diffs are on by default, with an internal
   constant to turn them off. T-003 checks Nano both ways.
3. Resolved 2026-11-12: deferred until the benchmark shows restarts matter.
   A restart is when the runner drops the model session and makes a
   new one: when the session is 75% full or the model reports the quota is
   exceeded (T-001 Progress log). The new session reads the system prompt
   again, then a recap of the steps. Chrome's Prompt API has `session.clone()`. A run could keep one clean
   session with only the system prompt and clone it on each restart, so the
   system prompt is not processed again. It is not in the `AiSession`
   interface, so adding it would be a public API change. Deferred unless the
   baseline shows restarts are a large share of the time.

4. Deferred 2026-11-12 to T-017. How to go on with the switches: test them one at a time with
   Gemini Nano (suggested order: `quickSettle`, `reuseSnapshot`,
   `strictSchema`, `shortToolLines`, `pageDiffs`), keep the ones that don't
   hurt, and remove the rest? Or drop T-011's model-facing changes and close
   it with only the page-side changes?

## Progress log

- 2026-11-12: Spec created as Draft.
- 2026-11-12: Open questions 1 and 2 answered by the user: speed with Gemini
  Nano is the goal; page diffs on by default.
- 2026-11-12: Question 3 deferred (no `clone()`). Approved by the user in
  chat. Implementation started.

- 2026-11-12: Baseline (task 1), per run, fake model with a 6,144-token
  context at 4 chars per token. Shop flow (11 calls): 97,960 chars sent
  (system 5,004 per session), 4 session restarts, 12 DOM walks, 6,135 box
  reads, 1,513 style reads, about 163 ms in layout and style reads. Long
  list (9 calls): 35,284 chars, 1 restart, 10 walks, 3,664 box reads, 607
  style reads, about 23 ms.
- 2026-11-12: Design change: "time in `takeSnapshot`" is measured as time
  in `getBoundingClientRect` and `getComputedStyle`, plus counts of DOM
  walks and reads. ESM exports can't be wrapped from the test.
- 2026-11-12: Design change: diff code is in `page-diff.ts`, not
  `page-snapshot.ts`, to keep files small. The observer also listens to
  input, change and focus events, ignores the chat element and the chat's
  own page marks (`data-browse-ai-core-flash` added to the action outline),
  and is reset after every page-changing tool (CSS-only changes such as
  hover leave no DOM record).
- 2026-11-12: Design change: style and cover checks run only for elements
  that can still fit the budget. The "N more not listed" count can now
  include hidden elements past the budget.
- 2026-11-12: Design change (R5.3): after an action, a page with no DOM
  change or request for 150 ms counts as settled; after any change the
  500 ms rule applies, max 3 s as before.
- 2026-11-12: Design change: "unchanged" is sent whenever nothing changed,
  also after a page-changing tool, since it tells the model the step had
  no effect.
- 2026-11-12: Task 6 verify limit raised from 160 to 200 chars: the
  `fill_form` line keeps its `{"fields": …}` format (178 chars).
- 2026-11-12: Results (task 9). Shop: 12,887 chars (-87%), system 3,470
  (-31%), 0 restarts, 8 walks, 1,042 box reads, 965 style reads, about
  145 ms (-11%). List: 7,901 chars (-78%), 0 restarts, 3 walks, 414 box
  reads, 134 style reads, about 16 ms (-30%). R2.5 and R3.2 met and
  asserted in `agent.bench.spec.ts`. R5.4 met on the list, not on the shop
  flow: 6 of its 10 steps change the page, so the snapshot is rebuilt and
  each rebuild still reads the style of every listed element. Waiting for
  the user's decision.
- 2026-11-12: `notes.spec.ts` "saves the selected text with an AI note"
  failed once in a full `npm test` run and passed in 3 runs alone and in the
  next full run. Not related to this change; flaky under load.
- 2026-11-12: Task 11: Agent Mode internals are described in
  `docs/features.md`, not `docs/architecture.md`, so that is where they
  went. README: the provider section explains the per-tool schema and its
  fallback, since custom providers see it.

- 2026-11-12: 0.8.0 published at the user's request before T-011 was
  closed.
- 2026-11-12: T-003 results from the user with Gemini Nano on 0.8.0: worse
  than 0.7.1 on a job form (fields left empty), Google Calendar (picked Task
  but kept clicking the Task tab, never typed the title) and a screenshot
  task on pexels.com (no scrolling, same screenshot twice, wrong image
  opened). Likely causes: page diffs (the model has to remember refs and
  empty fields from earlier turns), the 150 ms settle (the calendar modal
  is observed before it renders), shorter tool lines and the strict schema.
  Not proven; no Nano in this environment.
- 2026-11-12: Scope change, back to Draft. The model-facing changes (R2,
  R3, R4.1-R4.3, R5.2, R5.3) stay in the code behind `AGENT_TUNING` in
  `agent-tuning.ts`, all off by default, so the model sees what 0.7.1 sent.
  Still on: R4.4 (repeat NOTE), R5.1 (one box read) and the deferred style
  checks (same output). The bench turns all switches on to measure that
  path. The observer also listens to transitionend, animationend and load.
  Earlier problems that 0.7.1 had too went to the backlog: T-012 (form
  fields left empty), T-013 (calendar task), T-014 (screenshot search does
  not scroll).

## Outcome

Shipped in 0.8.0 (all changes on), 0.8.1 (model-facing changes off by
default) and 0.8.2 (agent tool fixes from the user's Gemini Nano runs:
T-012 and T-015). Closed by the user on 2026-11-12.

What ships on: the bench (`agent.bench.spec.ts`), one box read per element,
style and cover checks only for elements that fit the budget, the repeat
NOTE (R4.4), and `promptWithSchema` taking a list of schemas.

What ships off (`AGENT_TUNING` in `agent-tuning.ts`): page diffs (R2),
short tool lines (R3), the per-tool schema (R4.1-R4.3), snapshot reuse
(R5.2) and the 150 ms settle (R5.3). With all of them on, the bench met
R2.5 (-78% to -87% characters, no session restarts) and R3.2 (-31%), and
R5.4 only on the list page (-30%; shop flow -11%). Gemini Nano did worse
with them on forms, Google Calendar and a screenshot task, so the model now
gets what 0.7.1 sent.

Deviations: see the Progress log. The spec went back to Draft once for the
scope change and was closed by the user without a new approval.

Lessons: check changes to what the model sees with the real model before
publishing; the fake-model bench only measures size, not quality. The
biggest speed gain in the user's runs came from tool fixes (0.8.2: about
3x faster form filling, from fewer steps), not from smaller prompts.

Follow-ups: T-017 (test the `AGENT_TUNING` switches one at a time with
Gemini Nano), T-013, T-014, T-016.
