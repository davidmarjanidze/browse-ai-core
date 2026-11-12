# Part 1: Price optimization

Keep this file under 200 lines. It is sent on every turn.
Task-specific procedures belong in `.claude/skills/`.

## Commands

```bash
./claude/scripts/install.sh      # once per clone: git hooks + jq check
./claude/scripts/cost-audit.sh   # what this repo adds to every request
./claude/scripts/test-hooks.sh   # smoke-test the Claude Code hooks
```

## Conventions

- Keep every source file under 5,000 tokens (~20 KB). A pre-commit hook enforces this.
- Prefer small, single-purpose modules over large files.
- Prefer CLIs (`gh`, `aws`, `supabase`, `netlify`) over MCP servers.

## Workflows (loaded on demand as skills)

- Reviewing a pull request: use the `pr-review` skill.
- Writing or running database/schema migrations: use the `migrations` skill.
- Ending or pausing a long task: use the `handoff` skill.
- Shrinking this file under 200 lines: use the `compress-claude-md` skill.
- Finding where agents search too long or trust stale docs: use the `retro` skill.

## Cost rules for agents

- Use Explore/Plan subagents for searching and planning (they run on Haiku).
- Run tests, lint, and builds through the `test-runner` subagent when the
  output may be long.
- Grep before you Read. Read only the line ranges you need (offset/limit);
  a hook blocks full reads of files over ~10,000 tokens.
- Do not paste whole files or full command output into the conversation.
- Test/lint/build output is filtered to errors automatically; append `# raw`
  to a command only if the filtered output is not enough.
- Keep replies short: no restating the plan, no summaries of unchanged code.
- Never edit lockfiles or generated code by hand.

# Part 2: Other best practices

## Project Overview

`browse-ai-core`: an npm package with an AI chat assistant for web pages. One
Angular workspace, one source tree, several entry points
(see `docs/architecture.md` and `docs/decisions.md`):

- `projects/browse-ai-core/src/`: core entry `browse-ai-core` (types, config,
  palettes, strings, adapters). No framework code.
- `projects/browse-ai-core/angular/`: `browse-ai-core/angular`, the standalone
  components (ng-packagr secondary entry).
- `projects/element/`: `browse-ai-core/element`, the custom element bundle.
- `projects/react/`, `projects/vue/`: thin wrappers around the element.
- `projects/demo/`: demo app (`npm start`).
- `examples/`: Angular, React, Vue and HTML apps used in the README and CI.

## Commands

```bash
npm start                # demo app
npm test                 # library tests (ng test) + wrapper tests (vitest)
npm run build            # dist/browse-ai-core (all entry points)
npm run test:element     # load the built element in jsdom
npm run npm-publish      # test, build, then npm publish (needs NPM_TOKEN)
node scripts/examples.mjs <package> <dir>   # build the examples against a package
npm run prettier         # format everything
npx ng test browse-ai-core --no-watch --include=projects/browse-ai-core/<path>.spec.ts  # one file
```

No lockfile is committed (`package-lock.json` is gitignored): use `npm install`, not `npm ci`.

## Code Style

- Angular rules from the browse-ai repo apply: signals APIs, `inject()`,
  `#private` fields (view queries are `protected`, Angular can't query ES
  private fields), separate `.html` templates, OnPush.
- Selectors start with `bac-`. Services are `@Injectable()` without
  `providedIn` and listed in `providers.ts`, so each chat has its own state.
- Colors only through `bac-*` Tailwind tokens (`--bac-*` variables). No raw
  colors in templates.
- All UI text comes from `strings` (`DEFAULT_STRINGS` in the core entry).
  Tool names use Title Case ("Subject Finder", not "Subject finder").
- README and docs: short plain sentences, no marketing words.

## Specs

This project uses spec-driven development. The rules live in the
`implement-spec` skill (`.claude/skills/implement-spec/`); use it for any spec
or backlog work.

- At the start of every session, read `specs/principles.md` and `specs/progress.md`.
- Only write code for an Approved spec in `specs/active/` or a quick-track item
  in `specs/backlog.md`.
- Keep the spec and `specs/progress.md` in sync with what you actually build.

## Subagents

Project agents live in `.claude/agents/`. Delegate when the process is large but the result is small; do targeted or context-dependent work inline.

- `oss-researcher`: before implementing an unfamiliar feature (see Workflow).
- `code-reviewer`: after finishing a change, before committing.
- `test-runner`: to run tests/lint/format checks without flooding context.

## Workflow

- For unfamiliar features, don't write from scratch. First search GitHub for open-source implementations, compare approaches, then pick one and start. Summarize which approach you chose and why before implementing.
- Explore before editing: read the relevant files and existing patterns first. Reuse existing helpers instead of adding near-duplicates.
- For anything touching more than a few files, write a short plan (or use plan mode) and get agreement before coding.
- After any change, check `README.md` (it is the npm page) and update it when the change affects what users can do or configure: options, features, strings, CSS variables, parts, events, exports or behavior.
- Write or update a failing test first when fixing a bug, so the fix is proven.
- Never claim something works without running it. If you couldn't verify, say so explicitly.
- Fix root causes, not symptoms. Don't silence errors, skip tests, or loosen types to make a check pass.
- Keep diffs focused on the task. No drive-by refactors, renames, or reformatting of untouched code — note them as follow-ups instead.
- Ask before: adding dependencies, changing public APIs/schemas/CI, deleting files, or any git push / force operation.
- When stuck after two failed attempts at the same approach, stop, explain what you tried, and propose alternatives rather than looping.
- Commit in logical units with Conventional Commit messages; never commit secrets or generated artifacts.
- When a correction from the user is likely to recur, propose adding it to this file so it sticks.
- Always keep `README.md` and `CLAUDE.md` split into two parts: Part 1 price optimization, Part 2 other best practices. Put new content in the matching part.
