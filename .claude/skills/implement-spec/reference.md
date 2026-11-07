# Specs reference

## Structure

```text
specs/
├── principles.md    # Stable rules: product, stack, commands, conventions, DoD, agent boundaries
├── roadmap.md       # Direction: vision, non-goals, milestones
├── backlog.md       # Prioritized work that has not started
├── progress.md      # What is happening right now + session handoff
├── changelog.md     # What shipped (append-only)
├── active/          # One spec per item being specified or built
│   └── _template.md
├── completed/       # Archived specs (read-only)
└── decisions/       # Architecture Decision Records (append-only)
    └── _template.md
```

Each file holds one kind of information. Link to other files instead of copying
from them.

## Lifecycle

```text
Idea
  │
  ├─► roadmap.md              (only if it is strategic / a milestone)
  ▼
backlog.md                    T-012 · Backlog
  │
  ├─ quick track ─► implement ─► changelog.md, remove from backlog
  │
  ▼ spec track
active/T-012-<slug>.md        Draft ─► Approved ─► In progress ─► Done
  │                           (tracked in progress.md while active)
  ▼
completed/T-012-<slug>.md     + changelog.md entry
```

ADRs (`decisions/`) can be written at any stage.

## Statuses

| Status      | Location     | Meaning                                                          |
| ----------- | ------------ | ---------------------------------------------------------------- |
| Backlog     | `backlog.md` | Prioritized, not started.                                        |
| Draft       | `active/`    | Spec being written. No production code yet.                      |
| Approved    | `active/`    | A human approved requirements, design and tasks. Code may start. |
| In progress | `active/`    | Being implemented.                                               |
| Blocked     | `active/`    | Cannot continue. The reason is in `progress.md`.                 |
| Done        | `completed/` | Meets the Definition of Done.                                    |
| Dropped     | `completed/` | Abandoned. The reason is recorded in the spec.                   |

## IDs and naming

- Backlog items get a permanent ID: `T-001`, `T-002`, … Take the next number
  from `Next ID` in `backlog.md` and increment it. Never reuse an ID.
- An item keeps its ID for life: `active/T-012-user-login.md` →
  `completed/T-012-user-login.md`.
- ADRs are numbered separately: `decisions/0001-use-postgres.md`.
- Put the ID in branch names, commits and PR titles, e.g.
  `feat(T-012): add login form`.

## File responsibilities

| File             | Answers                         | Update when                                                          |
| ---------------- | ------------------------------- | -------------------------------------------------------------------- |
| `principles.md`  | "How do we build here?"         | Stack, conventions, commands or boundaries change (rarely).          |
| `roadmap.md`     | "Where are we going?"           | Priorities or long-term direction change. No implementation details. |
| `backlog.md`     | "What's next, in what order?"   | Work is found, re-prioritized, started or dropped.                   |
| `progress.md`    | "What is happening right now?"  | Continuously, and at the end of every work session.                  |
| `changelog.md`   | "What shipped, and when?"       | Every completed item. Append-only; never rewrite history.            |
| `active/*.md`    | "What exactly are we building?" | Before and during implementation. Must always match reality.         |
| `completed/*.md` | "Why was it built this way?"    | Only once, when archiving. Read-only afterwards.                     |
| `decisions/*.md` | "Why did we choose X over Y?"   | A significant technical decision is made. Append-only.               |

Completed specs are read-only. Later changes to a shipped feature get a new
backlog item and spec that links to the old one.

## ADRs

Write an ADR when a decision is significant and costly to reverse: a framework,
library, datastore, protocol, architectural pattern, or a cross-cutting
convention.

- Copy `decisions/_template.md` to `decisions/NNNN-<slug>.md`.
- `Proposed` while under discussion, `Accepted` once made. Agents draft as
  `Proposed` and ask.
- Never edit an accepted ADR's content. To change direction, write a new ADR
  and set the old one's status to `Superseded by NNNN`.
- Add accepted choices to the stack table in `principles.md`, linked to the ADR.

## Releases

`changelog.md` follows [Keep a Changelog](https://keepachangelog.com). Record
finished work under `Unreleased`. On release, rename that section to the version
and date, then start a new `Unreleased` section. Use
[SemVer](https://semver.org) if the project is versioned; otherwise use the date
only.

## Setting up specs in a new project

1. Copy `specs/` and `.claude/skills/implement-spec/` into the project root.
2. Fill in `principles.md` (product, stack, commands, conventions, agent
   boundaries) and `roadmap.md` (vision, milestones).
3. Add work items to `backlog.md`.
4. Add the Specs section from this repo's `CLAUDE.md` to the project's
   `CLAUDE.md`.

## Principles

- The specs are the source of truth, and code follows them. When reality
  changes, update the spec first.
- Write specs for the reader: concise, concrete, testable.
- One fact lives in one place. Link to it instead of copying it.
- History is append-only: changelog, completed specs, ADRs.
- Every piece of work has a traceable lifecycle, from ID to spec to commits to
  changelog.
