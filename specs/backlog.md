# Backlog

Next ID: T-011

## High

### T-003 · Check Agent Mode and Watch Mode with Gemini Nano

From T-001 and T-002. Quick track.

- Run `npm start`, open the demo in Chrome with the built-in model.
- Agent Mode: "Add the cheapest red shirt in size M to the cart", then "Place
  the order" (must ask first). Record which steps pass.
- Watch Mode: pick the ticker, "Tell me when the price is below 100". Record
  whether matches are posted and how often false ones appear.
- Write the results in `progress.md` and open items for problems found.

## Medium

### T-004 · Native tool calling for Agent Mode

From ADR 0001. When the Prompt API `tools` option is stable, map the
`AGENT_TOOLS` table to it when the provider supports it. Needs a spec.

## Low

### T-005 · Several watches at once

From T-002. More than one watched element per chat, each with its own Stop.
Needs a spec.

### T-006 · Browser notification for Watch Mode

From T-002. Optional `Notification` when a change is found while the tab is
in the background. Needs a spec (permission flow, config).
