# Claude Code best practices

A starter kit for working with [Claude Code](https://docs.claude.com/en/docs/claude-code),
in two parts:

1. [**Price optimization**](#part-1-price-optimization): a drop-in toolkit
   for cutting token spend. Every technique is a committed file, so one commit
   configures the whole team.
2. [**Other best practices**](#part-2-other-best-practices): a `CLAUDE.md`
   with workflow rules, a spec-driven `specs/` folder, and an `implement-spec`
   skill that drives it.

## Part 1: Price optimization

### Techniques at a glance

**Reduce what is sent on every turn**

| #   | Technique                                     | Why it saves tokens                                                          | Implemented in                                                                                                         |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Lean `CLAUDE.md` (<= 200 lines) + skills      | `CLAUDE.md` is resent every turn; a skill body loads only when used          | [`CLAUDE.md`](CLAUDE.md), [`.claude/skills/`](.claude/skills/), [check script](claude/scripts/check-claude-md-size.sh) |
| 2   | Trim MCP servers; prefer CLIs                 | Every MCP tool schema is sent on every request. CLIs cost nothing until used | [`.mcp.json`](.mcp.json), [`claude/docs/cli-over-mcp.md`](claude/docs/cli-over-mcp.md)                                 |
| 3   | Compact earlier (`autoCompactWindow: 400000`) | Stops paying for a huge context on every turn of 1M-context models           | [`.claude/settings.json`](.claude/settings.json)                                                                       |
| 4   | Handoff skill + `/clear`                      | A 40-line note replaces 100K+ tokens of history when resuming a task         | [`.claude/skills/handoff/`](.claude/skills/handoff/SKILL.md)                                                           |

**Reduce what tools put into context**

| #   | Technique                                        | Why it saves tokens                                                                                   | Implemented in                                                                                                                                 |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Filter test / lint / build / install output      | A hook rewrites noisy commands so only errors and the summary reach the model                         | [`filter-command-output.sh`](.claude/hooks/filter-command-output.sh)                                                                           |
| 6   | Block whole-file reads of large files            | A hook denies reading files over ~10K tokens without `offset`/`limit` and steers Claude to Grep first | [`guard-large-reads.sh`](.claude/hooks/guard-large-reads.sh)                                                                                   |
| 7   | Deny reads of build artifacts                    | `node_modules`, `dist`, source maps and minified files are never useful context                       | `permissions.deny` in [`.claude/settings.json`](.claude/settings.json)                                                                         |
| 8   | Cap Bash and MCP output size                     | `BASH_MAX_OUTPUT_LENGTH` and `MAX_MCP_OUTPUT_TOKENS` stop a single result from flooding the context   | `env` in [`.claude/settings.json`](.claude/settings.json)                                                                                      |
| 9   | Block oversized source files at commit time + CI | Big files are expensive every time an agent reads them                                                | [pre-commit](.githooks/pre-commit), [`check-file-tokens.sh`](claude/scripts/check-file-tokens.sh), [CI](.github/workflows/cost-guardrails.yml) |

**Use cheaper models and less reasoning**

| #   | Technique                              | Why it saves tokens                                                                             | Implemented in                                                   |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 10  | Reasoning effort = `medium` by default | Every session starts at medium instead of whatever each person picked                           | [`.claude/settings.json`](.claude/settings.json)                 |
| 11  | Run subagents on Haiku                 | Explore/Plan and custom agents run on the cheapest model                                        | `env` in [`.claude/settings.json`](.claude/settings.json)        |
| 12  | `test-runner` subagent                 | Verbose test runs happen in a Haiku subagent; only a short failure list enters the main context | [`.claude/agents/test-runner.md`](.claude/agents/test-runner.md) |
| 13  | Disable non-essential model calls      | `DISABLE_NON_ESSENTIAL_MODEL_CALLS` skips background calls such as flavor text                  | `env` in [`.claude/settings.json`](.claude/settings.json)        |

**Make spend visible**

| #   | Technique         | Why it saves tokens                                                                       | Implemented in                                                 |
| --- | ----------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 14  | Cost status line  | Live session cost, turning yellow/red past thresholds; people stop when they see it climb | [`.claude/statusline.sh`](.claude/statusline.sh)               |
| 15  | Cost audit script | Shows what the repo adds to every request and which files are most expensive to read      | [`claude/scripts/cost-audit.sh`](claude/scripts/cost-audit.sh) |
| 16  | Team habits guide | `/clear`, focused `/compact`, specific prompts, keeping the prompt cache warm             | [`claude/docs/habits.md`](claude/docs/habits.md)               |

### Setup

```bash
# from the root of the target repository (copy these files in first)
./claude/scripts/install.sh
./claude/scripts/cost-audit.sh   # optional: see your baseline
```

`install.sh` points git at `.githooks/`, makes the scripts executable, and
checks that `jq` is installed (the Claude Code hooks need it).

Commit `.claude/`, `.mcp.json`, `.githooks/`, `.github/`, `claude/`,
`.gitignore` and `.token-budget-ignore`. Everyone who clones the repo and runs
`install.sh` gets the same setup. Then fill in Part 1 of `CLAUDE.md`.

### How each technique works

#### Lean `CLAUDE.md` + skills (1)

`CLAUDE.md` holds only what is needed on _every_ turn (stack, commands,
conventions). PR review, migrations and handoff procedures live in
`.claude/skills/*/SKILL.md`; only their one-line `description` is always
loaded, so keep descriptions short (`cost-audit.sh` warns past 250 chars).
`claude/scripts/check-claude-md-size.sh` fails the commit if `CLAUDE.md`
passes 200 lines. To get back under the limit, ask Claude to _"compress
CLAUDE.md"_: the `compress-claude-md` skill finds instructions that can move
into skills, proposes the moves, and applies them once you approve.

#### Fewer MCP servers (2)

`.mcp.json` lists only the servers the team uses daily (none by default).
Everything else should be replaced by its CLI or moved to personal user
config. See [`claude/docs/cli-over-mcp.md`](claude/docs/cli-over-mcp.md).

#### Handoff instead of long sessions (4)

Say "handoff" and Claude writes `.claude/handoff.md` (gitignored): goal, done,
next steps, gotchas. Run `/clear`, then "Read .claude/handoff.md and continue."

#### Output filter hook (5)

A `PreToolUse` hook on `Bash` rewrites these commands so only error/failure
lines (with 5 lines of context), the last 5 lines (the summary), and the exit
code come back:

- tests: `npm|pnpm|yarn|bun test`, `npx jest|vitest|mocha`, `pytest`, `go test`, `cargo test`
- lint/build: `npm run lint|build|typecheck|check`, `npx tsc|eslint`, `go build|vet`, `cargo build|check|clippy`
- install: `npm install|ci|add`, `pip install`

If a command fails and nothing matches, the last 80 lines are shown, so a
failure is never hidden. Append `# raw` to a command for full output.

**Safety:** the hook auto-approves only simple commands. Anything with shell
metacharacters (`;`, `&&`, `|`, `>`, `$(...)`, backticks) passes through
untouched to the normal permission flow, so `npm test; rm -rf x` is never
auto-approved.

#### Large-read guard (6)

A `PreToolUse` hook on `Read` denies reading a text file over
`CLAUDE_MAX_READ_BYTES` (default 40,000 bytes, ~10K tokens) unless the call
passes `limit`. The denial tells Claude the file size and to Grep, then read
a range. Images, PDFs and notebooks are exempt.

#### Deny rules and output caps (7, 8)

`permissions.deny` blocks `Read` on `node_modules`, `dist`, `build`,
`coverage`, `.next`, `*.min.js`, `*.min.css` and `*.map`. Adjust the list for
your stack. `BASH_MAX_OUTPUT_LENGTH=20000` (characters) and
`MAX_MCP_OUTPUT_TOKENS=10000` cap single tool results.

#### Token budget pre-commit hook + CI (9)

- Locally, checks **only staged files** (added/copied/modified).
- In CI, `check-file-tokens.sh --all` checks every tracked file, so
  `git commit --no-verify` can't sneak a big file through.
- Tokens are estimated as `bytes / 4`; the limit is 5,000 tokens (20,000 bytes).
  Override with `MAX_TOKENS=8000 git commit ...`.
- Lockfiles, generated code, binaries and snapshots are skipped via `.token-budget-ignore`.
- On failure, the error message tells the agent exactly how to split the file.

#### Effort, Haiku subagents, `test-runner` (10-13)

- `"effortLevel": "medium"` is the team default. Raise it per task with `/effort`.
- `CLAUDE_CODE_SUBAGENT_MODEL=haiku` + `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` run
  all subagents on Haiku, even ones whose definition asks for another model
  (including `code-reviewer` and `oss-researcher` below). Remove
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` if those need a stronger model.
- `test-runner` runs the checks and replies with one PASS/FAIL line per
  command plus a short note per failure. `CLAUDE.md` tells the main agent to
  use it for long-output commands.

#### Status line and audit (14, 15)

The status line shows `model | $cost | ctx %`. Thresholds:
`CLAUDE_COST_WARN` (default $2, yellow) and `CLAUDE_COST_ALERT` (default $10, red).
A status line in project settings replaces each person's own; delete the
`statusLine` block if your team prefers personal ones.

### Verifying it works

| Check                        | Command                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| All hooks + status line      | `./claude/scripts/test-hooks.sh`                                                          |
| Budget hook blocks big files | `head -c 30000 /dev/urandom \| base64 > big.txt && git add big.txt && git commit -m test` |
| Whole-repo budget            | `./claude/scripts/check-file-tokens.sh --all`                                             |
| What every request costs     | `./claude/scripts/cost-audit.sh`, then `/context` in Claude Code                          |
| Subagent model               | Check usage per model in your billing dashboard                                           |

### Caveats

- Setting names (`effortLevel`, `autoCompactWindow`, the env vars) and the hook
  and status line input formats can change between Claude Code releases. If
  something is ignored, check the current Claude Code docs for settings and hooks.
- Hooks with `permissionDecision: "allow"` skip the permission prompt for the
  rewritten command. Review `filter-command-output.sh` before adopting it.
- `bytes / 4` is a rough token estimate; it is intentionally cheap and fast.

## Part 2: Other best practices

### What's here

| Path                             | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `CLAUDE.md`                      | Project memory loaded every session: commands, style, workflow rules. |
| `specs/`                         | Source of truth: principles, roadmap, backlog, progress, specs, ADRs. |
| `.claude/skills/implement-spec/` | Skill Claude loads when you ask it to implement or plan a spec task.  |
| `.claude/skills/retro/`          | `/retro`: mines recent sessions for slow searches and stale docs.     |
| `.claude/agents/`                | `code-reviewer`, `oss-researcher` and `test-runner` subagents.        |

Use it in a new project by copying `CLAUDE.md`, `specs/` and `.claude/` into
the project root, then filling in `specs/principles.md` and `specs/roadmap.md`.

### Context: `CLAUDE.md`

- Keep it short and specific. Every line is loaded into every session, so
  include only what Claude can't infer from the code: commands, conventions,
  gotchas, boundaries.
- Write rules as instructions ("Run `npm test` before committing"), not prose.
- Grow it from real corrections: when you fix the same mistake twice, add a
  rule. Prune rules that no longer matter.
- Use nested `CLAUDE.md` files in subdirectories for area-specific rules, and
  `CLAUDE.local.md` (gitignored) for personal preferences.
- Move long, situational procedures into skills so they load only when needed.

### Skills, commands and agents

- **Skills** (`.claude/skills/<name>/SKILL.md`): repeatable procedures. The
  `description` decides when Claude picks the skill up — list the phrases users
  actually say. Keep `SKILL.md` lean and put lookup material in sibling files.
- **Subagents** (`.claude/agents/`): delegate broad searches or independent
  reviews so the main context stays focused.
- **Hooks** (`.claude/settings.json`): for anything that must happen every
  time (format on save, block edits to protected paths). Instructions in
  `CLAUDE.md` are advice; hooks are guaranteed.

### Workflow

- **Explore → plan → code.** Ask Claude to read the relevant code first, then
  use plan mode (Shift+Tab) for non-trivial changes before implementing.
- **Give it a way to check its work**: tests, a typecheck, a linter, a
  screenshot. Claude is far more reliable when it can run the feedback loop
  itself.
- **Be specific.** Name files, functions and the expected behavior; paste the
  error. Vague prompts get generic code.
- **Test first for bugs**: have Claude write a failing test, confirm it fails,
  then fix.
- **Course-correct early.** Press Esc to interrupt, and double-Esc to rewind to
  an earlier point instead of arguing a bad direction forward.
- **Manage context.** Use `/clear` between unrelated tasks and `/compact` on
  long ones. A fresh session with a good handoff (`specs/progress.md`) beats a
  bloated one.
- **Review the diff yourself** before committing; use `/code-review` for a
  second pass.

### Permissions and safety

- Allowlist safe, frequent commands in `.claude/settings.json` (or run
  `/fewer-permission-prompts`) instead of approving them one by one.
- Keep destructive operations (push, deploy, delete) behind a prompt.
- Never put secrets in `CLAUDE.md`, specs, or prompts.

### Parallel work

- Use git worktrees to run several Claude sessions on separate branches without
  conflicts.
- For large changes, split work into independent spec tasks and run them in
  separate sessions.

### Spec-driven development

Ask Claude things like _"implement T-001"_, _"work on the next backlog item"_ or
_"write a spec for password reset"_. The `implement-spec` skill takes over:
it picks the quick or spec track, writes the spec, **stops for your approval**,
then implements task by task and updates `specs/progress.md` and
`specs/changelog.md`. See
[`.claude/skills/implement-spec/SKILL.md`](.claude/skills/implement-spec/SKILL.md).
