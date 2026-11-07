---
name: retro
description: Retrospective over recent Claude Code sessions to make the repo easier for agents to navigate. Use when the user says retro, retrospective, review my last sessions, or asks where agents waste time searching or rely on out-of-date docs.
---

# Retro Procedure

Goal: find where agents took too long to find information or trusted stale
docs, and propose concrete repo changes that fix it. Report first; edit only
after the user approves.

## 1. Collect

Run `bash .claude/skills/retro/digest.sh 10` (pass a different N if the user
asks). It prints a compact per-session timeline from
`~/.claude/projects/<repo-slug>/*.jsonl`, skipping the current session.
Never Read the raw `.jsonl` files; they are huge. If the digest is very long,
hand this step to an Explore subagent and ask it for the signals below only.

## 2. Find the signals

For each session, note:

- **Slow finds**: many Grep/Glob/Read/`find`/`ls` calls before the first
  Edit/Write, or the same file read repeatedly. Record what was being looked
  for and where it actually lived.
- **Dead ends**: searches for paths, names, or commands that do not exist
  (`!! error`, empty results), then a retry with a different name.
- **Stale docs**: a doc (`README.md`, `CLAUDE.md`, `specs/`, skills, agents)
  was read, then the agent hit an error or the user corrected it. Verify each
  suspect claim against the current code before reporting it.
- **User corrections**: "no", "actually", "that's in X", "wrong file" —
  usually missing or wrong navigation info.
- **Repeated questions** across sessions: the same fact rediscovered more
  than once belongs in a doc.

Ignore one-off noise; a pattern needs two or more occurrences, or one costly
one (10+ wasted calls).

## 3. Report

Give a short table, most costly first:

| Problem | Evidence (session, call #s) | Fix | Where |

Fixes should be the smallest change that removes the search, e.g.:

- a one-line pointer in `CLAUDE.md` (keep it under 200 lines) or a nested
  `CLAUDE.md` in the subdirectory;
- correcting or deleting an out-of-date doc line;
- a "What's here" table entry in `README.md`;
- a skill `description` that lists the phrases users actually say;
- renaming or moving a file whose name hides its purpose (ask first).

Put new `README.md`/`CLAUDE.md` content in the matching part (Part 1 price
optimization, Part 2 other best practices).

## 4. Apply

After the user picks fixes, apply them, and re-check each edited doc claim
against the code. Do not commit unless asked.
