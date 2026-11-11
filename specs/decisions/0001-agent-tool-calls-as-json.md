# 0001: Agent tool calls as one JSON object per step

- Status: Accepted (2026-11-11)
- Date: 2026-11-11
- Spec: T-001 (also used by T-002 for its check answer)

## Context

Agent Mode needs the model to pick a tool and its arguments on each step. The
`AiProvider` interface only has `prompt()` and `promptStreaming()`, which
return text. Gemini Nano is small and does not always follow a format. Custom
providers (other models) may or may not support native function calling.

## Decision

- Each step the model answers with one JSON object:
  `{ "thought": string, "tool": string, "args": object }`.
- The tool list is a table in code (`AgentTool`: name, description, JSON
  schema of args, handler). The system prompt and a JSON schema for the
  answer are built from it.
- Add an optional `responseConstraint?: object` (JSON schema) to
  `AiRequestOptions`. The Chrome provider passes it to `prompt()`. Providers
  that ignore it still work, because the answer is always checked in code.
- One tool call per step. The page is observed again after each action.

## Alternatives

- **Native function calling** (Prompt API `tools`, or a provider's own). Not
  stable in Chrome yet, and it would tie the loop to one provider. The tool
  table can be mapped to native tools later without changing the tools.
- **Several tool calls per step.** Fewer model calls, but the page changes
  after each action, so later calls would act on a stale view.
- **Free text with a regex** (`ACTION: click 12`). Easy for the model, but
  hard to check and to extend with arguments.

## Consequences

- Public API change: new optional field on `AiRequestOptions`.
- Each step costs one model call. Runs are slower than with batched calls.
- Bad answers are caught in code and sent back to the model (T-001 R2.5).
