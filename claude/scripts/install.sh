#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Use the committed hooks directory
git config core.hooksPath .githooks

# Make everything executable
chmod +x .githooks/* claude/scripts/*.sh .claude/hooks/*.sh .claude/statusline.sh

# The Claude Code hooks and status line need jq
if ! command -v jq >/dev/null 2>&1; then
  echo "WARNING: jq is not installed. The Claude Code hooks need it." >&2
  echo "  macOS:  brew install jq" >&2
  echo "  Debian: sudo apt-get install jq" >&2
fi

echo "Installed:"
echo "  - git hooks path -> .githooks (token budget + CLAUDE.md size check)"
echo "  - Claude Code settings, hooks, skills, and agents are loaded from .claude/"
echo "Run ./claude/scripts/cost-audit.sh to see what this repo adds to every request."
echo "Done."
