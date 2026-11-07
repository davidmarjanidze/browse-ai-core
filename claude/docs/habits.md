# Cost-saving habits

Config can only do so much. These habits usually save more than any setting.
Share this page with the team.

## Context hygiene

| Habit                                                     | Why                                                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/clear` between unrelated tasks                          | Every turn re-sends the whole conversation. Old, unrelated history is paid for again on every message           |
| Use the `handoff` skill before `/clear` on long tasks     | A 40-line note replaces 100K+ tokens of history and is enough to resume                                         |
| `/compact <focus>` instead of waiting for auto-compaction | e.g. `/compact keep the API design decisions, drop the debugging`. A focused summary is smaller and more useful |
| One task per session                                      | Mixed sessions keep irrelevant files and logs in context                                                        |
| `Esc` early when Claude heads the wrong way               | Stopping costs nothing. Letting a wrong approach finish, then undoing it, costs twice                           |

## Prompting

| Habit                                                          | Why                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Name the files: "fix the null check in `src/auth/session.ts`"  | Claude skips the search phase (often the most expensive part of a task)    |
| Paste the exact error, not "it's broken"                       | Saves a round of running commands to reproduce it                          |
| Ask for a plan first on large changes (plan mode, `Shift+Tab`) | Correcting a plan is cheap. Correcting 20 edited files is not              |
| Batch small requests into one message                          | Each turn re-sends the context; three requests in one turn pay for it once |
| Say "don't explain, just do it" for routine edits              | Output tokens cost several times more than input tokens                    |

## Model and effort

- Use the default model and `medium` effort for routine work. Raise effort
  (`/effort high`) or switch model (`/model`) only for the hard part of a task,
  then switch back.
- `opusplan` (via `/model`) uses Opus in plan mode and Sonnet for execution:
  strong planning, cheaper edits.
- Delegate verbose work (test runs, broad searches) to subagents like
  `test-runner` or Explore. Only their short summary enters your context.

## Keep the prompt cache warm

Claude Code caches the stable start of each request (system prompt, tools,
`CLAUDE.md`). Cached input is billed at a fraction of the normal price.
Anything that changes that prefix makes the next request pay full price.

- Don't edit `CLAUDE.md`, skills, or `.mcp.json` mid-session. Batch those
  changes, then start a new session.
- Don't add or remove MCP servers mid-session.
- Don't put timestamps, git SHAs, or other volatile data in `CLAUDE.md`.
- Long pauses let the cache expire; resuming after a long break re-pays
  the full prefix once.

## Measure

| Tool                             | Shows                                                     |
| -------------------------------- | --------------------------------------------------------- |
| Status line (this repo)          | Model and running session cost, always visible            |
| `/cost`, `/usage`                | Session token usage and plan limits                       |
| `/context`                       | What fills the context: system prompt, tools, MCP, memory |
| `./claude/scripts/cost-audit.sh` | What this repo adds to every request; largest files       |
| Console / billing dashboard      | Spend per model and per user over time                    |
