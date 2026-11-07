#!/usr/bin/env bash
# Reports what this repo adds to every Claude Code request, plus the files
# that are most expensive to read. Read-only; safe to run any time.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

tok() { echo $(( $1 / 4 )); }

echo "== Sent on every turn =="
if [[ -f CLAUDE.md ]]; then
  b="$(wc -c < CLAUDE.md | tr -d ' ')"
  echo "  CLAUDE.md: $(wc -l < CLAUDE.md | tr -d ' ') lines, ~$(tok "$b") tokens"
fi
for f in CLAUDE.local.md .claude/CLAUDE.md; do
  [[ -f "$f" ]] && echo "  $f: ~$(tok "$(wc -c < "$f" | tr -d ' ')") tokens"
done

# Only skill/agent descriptions are always loaded; bodies load on demand.
desc_bytes=0; n=0
for f in .claude/skills/*/SKILL.md .claude/agents/*.md; do
  [[ -f "$f" ]] || continue
  d="$(sed -n 's/^description:[[:space:]]*//p' "$f" | head -n 1)"
  desc_bytes=$(( desc_bytes + ${#d} )); n=$(( n + 1 ))
  (( ${#d} > 250 )) && echo "  WARN: long description (${#d} chars): $f"
done
echo "  Skill + agent descriptions: $n files, ~$(tok "$desc_bytes") tokens"

if [[ -f .mcp.json ]] && command -v jq >/dev/null 2>&1; then
  servers="$(jq -r '.mcpServers // {} | keys | join(", ")' .mcp.json)"
  echo "  MCP servers in .mcp.json: ${servers:-none}"
  echo "    (each adds its tool schemas; run /context to see exact cost)"
fi

echo ""
echo "== Largest tracked files (expensive to read whole) =="
git ls-files -z | while IFS= read -r -d '' f; do
  [[ -f "$f" ]] && printf '%s\t%s\n' "$(wc -c < "$f" | tr -d ' ')" "$f"
done | sort -rn | head -n 10 | while IFS=$'\t' read -r b f; do
  printf '  ~%6s tokens  %s\n' "$(tok "$b")" "$f"
done

echo ""
echo "Next: run /context and /cost inside Claude Code for live numbers."
