# Qampi MCP server

Make LinkedIn a step in your pipeline. This exposes Qampi's outreach engine as
[MCP](https://modelcontextprotocol.io) tools, so an agent in **Claude Code**,
**Codex**, **Cursor** — or any MCP client — can research a prospect, add them to
Qampi, enroll them in a sequence, and read back what happened, without leaving
the editor.

It is a thin client over Qampi's public REST API. It holds no LinkedIn
credentials: your Qampi API key authenticates, and every safety rule (daily and
weekly caps, the invite ramp, action pacing, the outstanding-invite ceiling) is
enforced server-side. An agent cannot talk its way past a cap by phrasing a tool
call differently.

## Setup

1. Create an API key in Qampi → **Settings → API keys** (shown once).
2. Add the server to your client.

### Claude Code

```bash
claude mcp add qampi --env QAMPI_API_KEY=qampi_live_… -- npx -y @qampi/mcp-server
```

or commit `.mcp.json` to share it with your team:

```json
{
  "mcpServers": {
    "qampi": {
      "command": "npx",
      "args": ["-y", "@qampi/mcp-server"],
      "env": { "QAMPI_API_KEY": "qampi_live_…" }
    }
  }
}
```

### Cursor

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global) — same shape as above.

### Codex

`~/.codex/config.toml`:

```toml
[mcp_servers.qampi]
command = "npx"
args = ["-y", "@qampi/mcp-server"]
env = { QAMPI_API_KEY = "qampi_live_…" }
```

## Modes — read this before enabling writes

| `QAMPI_MODE` | Behaviour |
|---|---|
| `read-only` *(default)* | Only read tools are **registered**. The agent cannot see, let alone call, anything that changes state. |
| `full` | Adds leads, campaigns, enrollment, launch, email lookup, webhooks. |

Write tools are withheld rather than merely discouraged, because "the model was
told not to" is not a safety property. Start in `read-only`; switch to `full`
when you actually want the pipeline to act.

`qampi_launch_campaign` is the only tool that contacts real people. It is
annotated `destructive`, and requires `confirm: true` — meant to represent a
human's explicit go-ahead, not the model's own enthusiasm. A sent invitation
cannot be unsent, and a withdrawn one cannot be resent for three weeks.

## Tools

**Read (always available)**

| Tool | What it does |
|---|---|
| `qampi_status` | LinkedIn connection + health, plan, and **today's remaining budget**. Call this first — the invite allowance ramps with account age and acceptance rate, so it is not a fixed number. |
| `qampi_list_templates` | Prebuilt sequences. |
| `qampi_list_leads` / `qampi_get_lead` | Leads and their enrichment. |
| `qampi_list_campaigns` / `qampi_get_campaign` / `qampi_campaign_leads` | Campaigns and per-lead progress. |
| `qampi_search_people` | LinkedIn people search. Costs one search from the monthly commercial-use budget. |

**Write (`QAMPI_MODE=full`)**

| Tool | What it does |
|---|---|
| `qampi_add_leads` | Adds leads. Contacts nobody. |
| `qampi_annotate_lead` | Tags and notes only — enrichment is engine-written, status is engine-derived. |
| `qampi_create_campaign` | Creates a campaign in DRAFT. |
| `qampi_enroll_leads` | Adds leads to a campaign. Still sends nothing. |
| `qampi_launch_campaign` | **Starts real outreach.** Requires `confirm: true`. |
| `qampi_find_email` | Finds a work email. Consumes one credit. |
| `qampi_register_webhook` | Subscribe a URL to lifecycle events so a pipeline reacts instead of polling. |

## Environment

| Variable | Default | |
|---|---|---|
| `QAMPI_API_KEY` | — | Required. |
| `QAMPI_MODE` | `read-only` | `full` enables write tools. |
| `QAMPI_BASE_URL` | `https://api.qampi.com/api/public/v1` | Point at a staging API. |
| `QAMPI_TIMEOUT_MS` | `60000` | Searches can take a while. |

## Example

> "Find the three companies we mentioned in `notes.md`, look up their heads of
> growth on LinkedIn, and add the 2nd-degree ones to Qampi tagged `q4-pilot`."

The agent reads your file, calls `qampi_search_people`, filters by degree,
then `qampi_add_leads` + `qampi_annotate_lead`. Nothing is sent to anyone —
launching stays a separate, deliberate step.

## Development

```bash
npm run build      # esbuild → dist/index.js
npm run smoke      # drives the server over stdio against a live account
```

`npm run smoke` needs `QAMPI_API_KEY` and makes real (read-only) API calls.
