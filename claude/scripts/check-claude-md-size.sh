#!/usr/bin/env bash
# Fails if CLAUDE.md exceeds 200 lines (it is resent on every turn).
set -euo pipefail

MAX_LINES="${CLAUDE_MD_MAX_LINES:-200}"
ROOT="$(git rev-parse --show-toplevel)"
FILE="$ROOT/CLAUDE.md"

[[ -f "$FILE" ]] || exit 0

lines="$(wc -l < "$FILE" | tr -d ' ')"
if (( lines > MAX_LINES )); then
  {
    echo ""
    echo "COMMIT BLOCKED: CLAUDE.md has $lines lines (limit: $MAX_LINES)."
    echo "CLAUDE.md is sent on every turn. To fix:"
    echo "  1. Move task-specific procedures (PR review, migrations, release steps)"
    echo "     into .claude/skills/<name>/SKILL.md."
    echo "  2. Keep only always-needed facts in CLAUDE.md (stack, commands, conventions)."
    echo "  3. Delete anything Claude can discover by reading the code."
    echo ""
  } >&2
  exit 1
fi