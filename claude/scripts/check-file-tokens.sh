#!/usr/bin/env bash
# Fails the commit if any STAGED, agent-authored file exceeds MAX_TOKENS.
# With --all, checks every tracked file instead (used in CI, where
# `git commit --no-verify` can't bypass it).
# Tokens are estimated as bytes / 4.
set -euo pipefail

MAX_TOKENS="${MAX_TOKENS:-5000}"
BYTES_PER_TOKEN=4
MAX_BYTES=$(( MAX_TOKENS * BYTES_PER_TOKEN ))

ROOT="$(git rev-parse --show-toplevel)"
IGNORE_FILE="$ROOT/.token-budget-ignore"

patterns=()
if [[ -f "$IGNORE_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [[ -n "$line" ]] && patterns+=("$line")
  done < "$IGNORE_FILE"
fi

is_ignored() {
  local file="$1" base p
  base="$(basename "$file")"
  for p in ${patterns[@]+"${patterns[@]}"}; do
    # shellcheck disable=SC2053
    if [[ "$file" == $p || "$base" == $p ]]; then
      return 0
    fi
  done
  return 1
}

list_files() {
  if [[ "${1:-}" == "--all" ]]; then
    git ls-files -z
  else
    # Only staged files that are Added, Copied, or Modified.
    git diff --cached --name-only --diff-filter=ACM -z
  fi
}

violations=()

while IFS= read -r -d '' file; do
  is_ignored "$file" && continue

  # Size of the staged blob (not the working-tree copy).
  size="$(git cat-file -s ":$file" 2>/dev/null || echo 0)"
  if (( size > MAX_BYTES )); then
    tokens=$(( size / BYTES_PER_TOKEN ))
    violations+=("$file|$tokens")
  fi
done < <(list_files "${1:-}")

if (( ${#violations[@]} == 0 )); then
  exit 0
fi

{
  echo ""
  echo "COMMIT BLOCKED: file(s) exceed the ${MAX_TOKENS}-token limit (tokens = bytes/4)."
  echo ""
  for v in "${violations[@]}"; do
    echo "  - ${v%%|*}  (~${v##*|} tokens)"
  done
  echo ""
  echo "HOW TO FIX (split each file above):"
  echo "  1. Read the file and list its distinct responsibilities"
  echo "     (e.g. types, helpers, one component/handler/class per concern)."
  echo "  2. Create one new file per responsibility, next to the original,"
  echo "     named after what it does (not part1/part2)."
  echo "  3. Move code into the new files WITHOUT changing behavior."
  echo "  4. Turn the original file into a thin entry point that re-exports"
  echo "     from the new files, so existing imports keep working."
  echo "  5. Each resulting file must be under ${MAX_TOKENS} tokens (~${MAX_BYTES} bytes)."
  echo "  6. Run the tests, then 'git add' the new files and commit again."
  echo ""
  echo "If the file is NOT agent-authored (lockfile, codegen, snapshot),"
  echo "add its pattern to .token-budget-ignore instead of splitting it."
  echo ""
} >&2

exit 1