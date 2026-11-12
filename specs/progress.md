# Progress

_Last updated: 2026-11-12_

## In progress

_None._

## Blocked

_None._

## Handoff

T-001 (Agent Mode) and T-002 (Watch Mode) shipped in 0.5.0 and are in
`completed/`. ADR 0001 is accepted. Both were checked with automated tests
only; the check with the real Gemini Nano model is T-003 in the backlog.

Quick track T-007 (2026-11-11, from the user): Agent Mode and Watch Mode are
listed in Tools by default (`agentMode` / `watchMode` default `true`); they
only act after the user picks one and sends. Shipped in 0.5.1. This replaces
the "Default: off" in T-001 R1.1 and T-002 R1.1.

Quick track T-008 (2026-11-11, from the user): Agent Mode takes new
instructions while it runs. Messages sent during a run go to the agent as
USER UPDATES at its next step. Shipped in 0.6.0.

Quick track T-009 (2026-11-11, from the user): more Agent Mode tools, with
`open_in_new_tab` first. Shipped in 0.7.0.

Quick track T-010 (2026-11-11, from the user): left / right Position in
settings, saved with the appearance. Shipped in 0.7.0.

T-011 (2026-11-12): done and archived. Shipped in 0.8.0-0.8.2; the
model-facing speed changes are off by default (`agent-tuning.ts`).

Quick track T-012 (form fields left empty) and T-015 (typed search not
sent), 2026-11-12, from the user's Gemini Nano runs. Shipped in 0.8.2;
form filling about 3x faster in the user's run. The extension uses
`^0.8.2`.

T-018 (2026-11-12): done and archived. 8 more Agent Mode tools and
`agent.disabledTools`, shipped in 0.9.0. Checked with jsdom tests only;
the Gemini Nano check is T-019.

Next step: T-003 (Watch Mode check with Gemini Nano; Agent Mode was checked
by the user on 2026-11-12), then T-019 (the T-018 tools with Gemini Nano),
T-017 (test the speed switches one at a time), T-013, T-014.
