---
name: implement-spec
description: Spec-driven workflow for this project's `specs/` folder. Use whenever the user asks to implement, start, continue, plan, spec out, or finish a task from the specs — e.g. "implement T-012", "work on the next backlog item", "continue the active spec", "write a spec for X", "mark T-003 done", "add this to the backlog". Also use before writing any feature code, to check that the work traces to an Approved spec or a quick-track backlog item.
---

# Implement a spec task

`specs/` is the single source of truth for what this project is, what is being
built, and why. Code follows the specs. If code and specs disagree, one of them
is wrong — resolve that before continuing.

Lookup material (folder layout, statuses, file responsibilities, ADR and release
rules) is in [reference.md](reference.md). Read it when a step below points
there or when you are unsure where something belongs.

## 1. Load context

1. Read `specs/principles.md` and `specs/progress.md`.
2. Identify the item: the ID the user named (`T-012`), the item in
   `progress.md` → In progress, or — if the user asked for "the next one" —
   the top item in `specs/backlog.md` under the highest priority section.
3. Read the item's spec in `specs/active/` (if any) and every ADR it links.
4. Read `specs/roadmap.md` and `specs/backlog.md` only when planning or choosing
   work.

If no backlog item or spec matches the request, propose a backlog item (next ID
from `Next ID`) and stop. Don't write code for untracked work.

## 2. Pick the track

Use the **quick track** only if all are true:

- Small: about a day of work or less, a few files.
- No new API, schema, dependency or architectural choice.
- The backlog item has clear acceptance criteria.

Otherwise use the **spec track**. If a quick task grows, stop and switch to the
spec track.

### Quick track

1. Implement directly from the backlog item.
2. Verify every acceptance criterion.
3. Add an entry under `Unreleased` in `specs/changelog.md`.
4. Remove the item from `specs/backlog.md`.

Then skip to step 6 (handoff).

## 3. Spec track — write or finish the spec

If there is no spec yet:

1. Copy `specs/active/_template.md` to `specs/active/T-<id>-<slug>.md`, fill the
   front matter (`status: Draft`, `created: <today>`).
2. Remove the item from `specs/backlog.md`; add a row to `specs/progress.md` →
   In progress.

Fill the spec in three phases:

1. **Requirements — what and why.** User stories plus numbered, testable
   acceptance criteria in EARS (`WHEN <trigger> THE SYSTEM SHALL <response>`)
   or Given/When/Then. List non-goals.
2. **Design — how.** Only the subsections that apply. Link ADRs instead of
   repeating them. A significant, hard-to-reverse choice gets an ADR drafted as
   `Proposed` (see reference.md → ADRs).
3. **Tasks — the plan.** Small ordered steps, each verifiable alone, each naming
   the criteria it satisfies (`R1.2`) and how to verify it.

Approval checklist — all must hold before asking for approval:

- Every requirement has acceptance criteria.
- Every acceptance criterion is covered by at least one task.
- Open Questions are resolved or explicitly deferred.

## 4. The Approved gate

**Never implement a spec whose status is Draft.** When the spec is complete,
stop, summarize it for the user, and ask for approval. Only a human sets
`status: Approved` (and `approved: <date>`). If the user approves in chat, set
those fields yourself, then continue.

If the spec is ambiguous or contradicts the code, add the problem to Open
Questions and ask. Never guess about anything that changes behavior.

## 5. Implement

1. Set `status: In progress` and update the row in `progress.md`.
2. Use the branch and commit conventions from `principles.md` (default
   `feat/T-<id>-<slug>`, `feat(T-<id>): <summary>`).
3. Work through the tasks in order. Tick a task only after running its Verify
   step and seeing it pass.
4. Before deviating from the spec, update the spec and add a dated line to its
   Progress Log. A small design/task change needs only the log line; a change to
   requirements or scope sends the spec back to **Draft** for re-approval.
5. Anything out of scope goes to `backlog.md` as a new item — don't build it.
6. If blocked, set `status: Blocked` and record the reason in `progress.md` →
   Blocked.

### Definition of Done

Plus any project additions in `principles.md`:

- [ ] All tasks checked; every acceptance criterion verified (by automated tests
      where practical).
- [ ] Tests, lint and build pass.
- [ ] The spec describes what was actually built.
- [ ] A changelog entry is added under `Unreleased`.

### Archive

1. Fill the spec's **Outcome**: what shipped, deviations, lessons, follow-ups.
   Follow-ups become new backlog items with new IDs.
2. Set `status: Done` and `completed: <date>`.
3. `git mv` the file from `specs/active/` to `specs/completed/`.
4. Remove the item from `progress.md`.

## 6. Handoff (every session)

Before ending, overwrite `progress.md` → Handoff: where you stopped, what is
half-done/uncommitted/failing, and the exact next step. Update `_Last updated_`.

## Never

- Implement scope that isn't in the spec.
- Edit `specs/completed/`, accepted ADRs (beyond the status line), or past
  changelog entries.
- Mark work done without verifying it.
- Reuse an ID.
