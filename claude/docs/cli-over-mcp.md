# Prefer CLIs over MCP servers

Each configured MCP server adds its tool schemas to every request, whether or not
the tool is used. A CLI costs tokens only when Claude actually runs it.

| Service  | Instead of an MCP server, use | Auth / setup          |
| -------- | ----------------------------- | --------------------- |
| GitHub   | `gh`                          | `gh auth login`       |
| AWS      | `aws`                         | `aws configure` / SSO |
| Supabase | `supabase`                    | `supabase login`      |
| Netlify  | `netlify`                     | `netlify login`       |

## Audit checklist

1. Run `/context` in Claude Code and note how many tokens the MCP tools use.
2. For each server in `.mcp.json`, ask: used this week? Does a CLI exist?
3. Remove anything unused, or replaced by a CLI.
4. Re-run `/context` and compare.
5. Mention the CLI in `CLAUDE.md` only if Claude does not discover it on its own.

## When you must keep an MCP server

- Disable it when you don't need it: `/mcp` lets you turn servers off for
  the current session.
- Put rarely used servers in your user config (`claude mcp add --scope user`)
  instead of the shared `.mcp.json`, so only people who use them pay for them.
- `MAX_MCP_OUTPUT_TOKENS` (set to 10000 in `.claude/settings.json`) caps how
  much a single MCP tool result can add to the context.
- Recent Claude Code versions can defer MCP tool schemas and load them on
  demand (tool search). Check `/context` to see whether that is active for you.
