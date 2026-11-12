# Backlog

Next ID: T-018

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

### T-013 · Agent Mode can't add a Google Calendar task

From T-003. 0.7.1 made an event instead of a task; 0.8.0 picked Task but
kept clicking the Task tab and never typed the title. Needs a check of what
the page list shows after the click (is "Add title" listed, focused?).
0.8.1 run: it opened Create → "Create appointment schedule" instead of a
task, then clicked Next and Save without asking, so a bookable schedule
with no title was made. Check whether "save" and "create" should be risk
words.

### T-014 · Agent Mode doesn't scroll when looking for an image

From T-003, task "scroll to the image with an airplane, use screenshots".
It takes screenshots of the same part of the page and then clicks the wrong
image. The prompt should tell it to scroll after a screenshot that doesn't
show the target. Acceptance: a scripted run that gets "not visible" from a
screenshot scrolls next.

### T-017 · Test the Agent Mode speed switches with Gemini Nano

From T-011. Turn on one `AGENT_TUNING` switch at a time (`reuseSnapshot`,
`quickSettle`, `strictSchema`, `shortToolLines`, `pageDiffs`), run the form,
Google Calendar and pexels tasks, and keep only the switches that don't make
results worse. Remove the code of the others.

### T-004 · Native tool calling for Agent Mode

From ADR 0001. When the Prompt API `tools` option is stable, map the
`AGENT_TOOLS` table to it when the provider supports it. Needs a spec.

## Low

### T-016 · Flaky notes test

`notes.spec.ts` "saves the selected text with an AI note" failed 2 times in
about 15 full runs (2026-11-12), always passing alone. Find the cause (the
document selection is not cleared between tests?). It can block
`npm run npm-publish`.

### T-005 · Several watches at once

From T-002. More than one watched element per chat, each with its own Stop.
Needs a spec.

### T-006 · Browser notification for Watch Mode

From T-002. Optional `Notification` when a change is found while the tab is
in the background. Needs a spec (permission flow, config).
