---
name: compress-claude-md
description: Shrink CLAUDE.md under 200 lines by moving task-specific instructions into skills. Use when the user says compress, shrink, trim or slim down CLAUDE.md, or it fails the size check.
---

# Compress CLAUDE.md

Goal: `CLAUDE.md` holds only what is needed on _every_ turn. Everything
situational moves into `.claude/skills/<name>/SKILL.md`, where only the
one-line `description` is always loaded.

## 1. Measure

Run `wc -l CLAUDE.md` and `./claude/scripts/cost-audit.sh`. Note the line
count and the limit (`CLAUDE_MD_MAX_LINES`, default 200). Aim well below it.

## 2. Find candidates

Read `CLAUDE.md` and classify each section or bullet group:

| Keep in CLAUDE.md                      | Move to a skill                                  |
| -------------------------------------- | ------------------------------------------------ |
| Stack, build/test commands             | Multi-step procedures (release, deploy, migrate) |
| Conventions that apply to every edit   | Rules for one task type (PR review, specs, docs) |
| Pointers: "for X, use the `x` skill"   | Checklists, templates, examples, long tables     |
| Hard safety rules (ask before push...) | Rules for one directory or tool only             |

Also flag, but do not move:

- **Delete** candidates: anything Claude can learn by reading the code,
  duplicated rules, stale references (verify paths/commands still exist).
- **Already covered**: content an existing skill in `.claude/skills/` already
  holds — replace it with a one-line pointer.

## 3. Propose before editing

Show the user a short table: section, line range, action (move to new skill /
merge into existing skill / delete / keep), target skill name, lines saved,
and the projected new line count. Wait for approval. Never drop a rule
silently; anything removed must live in a skill or be explicitly approved
for deletion.

## 4. Apply

For each approved move:

1. Create or extend `.claude/skills/<kebab-name>/SKILL.md` with frontmatter
   `name` and `description`. The description states what it does and the
   phrases users actually say; keep it under 250 chars.
2. Move the text verbatim first, then tighten wording only if needed.
3. Replace it in `CLAUDE.md` with one pointer line under
   "Workflows (loaded on demand as skills)".

Keep the Part 1 / Part 2 split in `CLAUDE.md` and `README.md` intact.
If a new skill is worth documenting, add it to the matching part of `README.md`.

## 5. Verify

Re-run `wc -l CLAUDE.md`, `./claude/scripts/check-claude-md-size.sh` and
`./claude/scripts/cost-audit.sh`. Report old vs. new line count and the list
of skills created or changed.
