# Principles

Stable rules for building `browse-ai-core`. Change them rarely.

## Product

An npm package with an AI chat assistant for web pages. It works in Angular,
React, Vue and plain HTML. By default it uses Chrome's built-in model (Gemini
Nano through the Prompt API), so nothing leaves the device.

## Stack

| Area      | Choice                                             | Why                                             |
| --------- | -------------------------------------------------- | ----------------------------------------------- |
| Framework | Angular standalone components, signals, OnPush     | [docs/decisions.md](../docs/decisions.md) 1, 9  |
| Isolation | Shadow DOM, custom element build                   | [docs/decisions.md](../docs/decisions.md) 1, 2  |
| Styling   | Tailwind CSS v4 with `bac-*` tokens                | [docs/decisions.md](../docs/decisions.md) 3     |
| AI        | `aiProvider` adapter, default Chrome Prompt API    | [docs/decisions.md](../docs/decisions.md) 7, 10 |
| Tools     | Page work in code, the model reads a short summary | [docs/decisions.md](../docs/decisions.md) 16    |

Decisions made before `specs/` existed are in `docs/decisions.md`. New ones go
in `specs/decisions/`.

## Commands

See `CLAUDE.md` → Commands. The main ones: `npm test`, `npm run build`,
`npm run test:element`, `npm start`.

## Conventions

- Code style, file size limit and README rules: `CLAUDE.md`.
- New tools follow [decision 16](../docs/decisions.md#16-shared-rules-for-new-tools):
  feature switch, `<tool>Name` / `<tool>Description` / `<tool>Notes` strings,
  "How to use" box, page work in code, fixed prompt size, page marks in one
  removable layer.
- Password and card fields are never read or filled.
- Branch: `feat/T-<id>-<slug>`. Commit: `feat(T-<id>): <summary>`, one short
  line.

## Definition of Done (project additions)

- `npm test`, `npm run build` and `npm run test:element` pass.
- `README.md` and `docs/features.md` describe the change when it affects users.
- Entry in `CHANGELOG.md` under `Unreleased`.

## Agent boundaries

Ask before: adding dependencies, changing public APIs (config, strings,
events, exports), changing CI, deleting files, or any git push.
