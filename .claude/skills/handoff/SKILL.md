---
name: handoff
description: Write a short handoff note so the session can be cleared and resumed cheaply. Use when the user says handoff, wrap up, or before /clear.
---

# Handoff Procedure

Write `.claude/handoff.md` (gitignored), overwriting it, with at most 40 lines:

1. **Goal** - one sentence.
2. **Done** - bullets of completed changes with `file:line` references.
3. **Next** - the exact next steps, in order.
4. **Gotchas** - decisions made, dead ends tried, commands that matter.

Do not paste code or logs; reference files instead.
Then tell the user: run `/clear`, then start the new session with
"Read .claude/handoff.md and continue."
