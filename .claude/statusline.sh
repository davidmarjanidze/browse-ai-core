#!/usr/bin/env bash
# Status line: shows model, session cost and (when available) context usage,
# so everyone sees spend in real time instead of at the end of the month.
# Colors turn yellow/red past CLAUDE_COST_WARN / CLAUDE_COST_ALERT (USD).
set -uo pipefail

WARN="${CLAUDE_COST_WARN:-2}"
ALERT="${CLAUDE_COST_ALERT:-10}"

input="$(cat)"
model="$(printf '%s' "$input" | jq -r '.model.display_name // "?"')"
cost="$(printf '%s' "$input" | jq -r '.cost.total_cost_usd // 0')"
ctx="$(printf '%s' "$input" | jq -r '
  if .context_window.used_percentage then (.context_window.used_percentage | floor | tostring) + "%"
  elif .exceeds_200k_tokens == true then ">200K"
  else empty end')"

color=$'\e[32m'
if awk "BEGIN{exit !($cost >= $ALERT)}"; then color=$'\e[31m'
elif awk "BEGIN{exit !($cost >= $WARN)}"; then color=$'\e[33m'; fi
reset=$'\e[0m'

line="$(printf '%s | %s$%.2f%s' "$model" "$color" "$cost" "$reset")"
[[ -n "$ctx" ]] && line="$line | ctx $ctx"
printf '%s\n' "$line"
