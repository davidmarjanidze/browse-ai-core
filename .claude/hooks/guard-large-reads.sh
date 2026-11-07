#!/usr/bin/env bash
# PreToolUse hook (matcher: Read)
# Denies a full read of a large text file and tells Claude to read a line
# range or Grep first. Reads that pass `limit` are always allowed.
# Threshold: CLAUDE_MAX_READ_BYTES (default 40000 bytes ~= 10,000 tokens).
set -euo pipefail

MAX_BYTES="${CLAUDE_MAX_READ_BYTES:-40000}"

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
limit="$(printf '%s' "$input" | jq -r '.tool_input.limit // empty')"

[[ -n "$file" && -z "$limit" && -f "$file" ]] || exit 0

# Images, PDFs and notebooks are handled specially by the Read tool.
ext="$(printf '%s' "${file##*.}" | tr '[:upper:]' '[:lower:]')"
case "$ext" in
  png|jpg|jpeg|gif|webp|bmp|pdf|ipynb) exit 0 ;;
esac

size="$(wc -c < "$file" | tr -d ' ')"
(( size > MAX_BYTES )) || exit 0

lines="$(wc -l < "$file" | tr -d ' ')"
tokens=$(( size / 4 ))
reason="$(basename "$file") is ~${tokens} tokens (${lines} lines). Do not read it whole. \
Grep for the symbol or text you need, then Read only that range with offset/limit \
(for example limit: 200)."

jq -n --arg reason "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}'
