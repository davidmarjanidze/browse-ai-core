#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash)
# Rewrites noisy commands (tests, lint, build, install) so only the lines that
# matter reach the model: matching error/failure lines, the last few summary
# lines, and the full tail if the command failed but nothing matched.
# The original exit code is preserved.
#
# Escape hatch: append `# raw` to a command to get unfiltered output.
set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

[[ -n "$cmd" ]] || exit 0
[[ "$cmd" == *"# raw"* ]] && exit 0

# Only rewrite simple commands. Anything with shell metacharacters
# (; & | > < ` $ newline) goes through the normal permission flow untouched,
# so `npm test; rm -rf x` can never be auto-approved by this hook.
safe='^[A-Za-z0-9 ._/=:@+,-]+$'
[[ "$cmd" =~ $safe ]] || exit 0

ws='[[:space:]]'
pm="(npm|pnpm|yarn|bun)"
if [[ "$cmd" =~ ^$ws*$pm$ws+(run$ws+)?test($ws|$) ]] \
   || [[ "$cmd" =~ ^$ws*npx$ws+(jest|vitest|mocha)($ws|$) ]] \
   || [[ "$cmd" =~ ^$ws*(pytest|python3?$ws+-m$ws+pytest)($ws|$) ]] \
   || [[ "$cmd" =~ ^$ws*(go|cargo)$ws+test($ws|$) ]]; then
  kind="test"
  pattern='FAIL|✕|✗|✖|error|failed|assertion|panicked|Traceback'
elif [[ "$cmd" =~ ^$ws*$pm$ws+(run$ws+)?(lint|build|typecheck|check)($ws|$) ]] \
   || [[ "$cmd" =~ ^$ws*npx$ws+(tsc|eslint)($ws|$) ]] \
   || [[ "$cmd" =~ ^$ws*(go$ws+(build|vet)|cargo$ws+(build|check|clippy))($ws|$) ]]; then
  kind="lint/build"
  pattern='error|warning|✖'
elif [[ "$cmd" =~ ^$ws*$pm$ws+(install|ci|i|add)($ws|$) ]] \
   || [[ "$cmd" =~ ^$ws*pip3?$ws+install($ws|$) ]]; then
  kind="install"
  pattern='ERR!|error|conflict|vulnerab'
else
  exit 0
fi

filtered="out=\$( ${cmd} 2>&1 ); rc=\$?; \
hits=\$(printf '%s\n' \"\$out\" | grep -E -i -A5 '${pattern}' | head -n 200); \
if [ -n \"\$hits\" ]; then printf '%s\n' \"\$hits\"; \
elif [ \$rc -ne 0 ]; then printf '%s\n' \"\$out\" | tail -n 80; fi; \
echo '--- last lines ---'; printf '%s\n' \"\$out\" | tail -n 5; \
echo \"[${kind} output filtered; exit code \$rc; append '# raw' for full output]\"; \
exit \$rc"

jq -n --arg cmd "$filtered" --arg kind "$kind" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    permissionDecisionReason: ("Filtered " + $kind + " output to errors/summary (token savings)"),
    updatedInput: { command: $cmd }
  }
}'
