# PurpleToad Mail MCP Server

> Model Context Protocol server for PurpleToad Mail. Your AI agent sends, receives, searches, and tracks email.

## What is this?

The **PurpleToad Mail MCP Server** connects your AI agent (Claude, Cursor, etc.) to your PurpleToad Mail account via the [Model Context Protocol](https://modelcontextprotocol.io/).

Your agent can:

- **Send & schedule emails** from your own domains
- **Read & search inbound messages** with full-text search
- **Track delivery status** of sent emails
- **Set up new domains** with copy-paste DNS records
- **Reference** your domains, mailboxes, and aliases

## Installation

Requires Node.js 18+.

The client configs below run the server with `npx -y purpletoadmail-mcp`.

## Quick Start

### 1. Get an API Key

Log in to [app.purpletoadmail.com](https://app.purpletoadmail.com) → Settings → API Keys → **Create Key**.

Copy the key (starts with `pt_live_` or `pt_test_`). It is shown **once**.

### 2. Configure

**Option A — Environment variables:**

```bash
export PURPLETOAD_API_KEY="pt_live_your_key_here"
export PURPLETOAD_DEFAULT_FROM="agent@yourdomain.com"
```

**Option B — Config file:**

```bash
mkdir -p ~/.purpletoad
cat > ~/.purpletoad/config.json <<EOF
{
  "apiKey": "pt_live_your_key_here",
  "defaultFrom": "agent@yourdomain.com"
}
EOF
```

### 3. Connect to your AI client

The examples below use `npx -y purpletoadmail-mcp`.

#### Claude Desktop

Edit your Claude Desktop config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "purpletoadmail": {
      "command": "npx",
      "args": ["-y", "purpletoadmail-mcp"],
      "env": {
        "PURPLETOAD_API_KEY": "pt_live_your_key_here",
        "PURPLETOAD_DEFAULT_FROM": "agent@yourdomain.com"
      }
    }
  }
}
```

#### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "purpletoadmail": {
      "command": "npx",
      "args": ["-y", "purpletoadmail-mcp"],
      "env": {
        "PURPLETOAD_API_KEY": "pt_live_your_key_here"
      }
    }
  }
}
```

#### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "purpletoadmail": {
      "command": "npx",
      "args": ["-y", "purpletoadmail-mcp"],
      "env": {
        "PURPLETOAD_API_KEY": "pt_live_your_key_here"
      }
    }
  }
}
```

#### Kimi Code CLI

Kimi Code supports MCP via `~/.kimi-code/mcp.json` (or a project-local `.kimi-code/mcp.json`):

```bash
mkdir -p ~/.kimi-code
cat > ~/.kimi-code/mcp.json <<'EOF'
{
  "mcpServers": {
    "purpletoadmail": {
      "command": "npx",
      "args": ["-y", "purpletoadmail-mcp"],
      "env": {
        "PURPLETOAD_API_KEY": "pt_live_your_key_here",
        "PURPLETOAD_DEFAULT_FROM": "agent@yourdomain.com"
      }
    }
  }
}
EOF
```

Then run `kimi mcp list` to verify the connection, or use `/mcp-config` inside Kimi Code.

#### SSE (Remote / Self-hosted)

Start the SSE server:

```bash
PURPLETOAD_TRANSPORT=sse PURPLETOAD_PORT=3001 node dist/index.js
```

Then configure your client with `http://localhost:3001/sse`. If your MCP client supports headers, include the API key as a Bearer token:

```json
{
  "mcpServers": {
    "purpletoadmail": {
      "transport": "sse",
      "url": "http://localhost:3001/sse",
      "headers": {
        "Authorization": "Bearer pt_live_your_key_here"
      }
    }
  }
}
```

> **Security note:** The SSE endpoint requires `Authorization: Bearer <PURPLETOAD_API_KEY>` on the initial `/sse` request. Without a valid token, the connection is rejected with HTTP 401.

> **Restart required:** Most clients (Claude Desktop, Cursor, Windsurf, etc.) only load MCP servers on startup. Fully quit and reopen the client after editing the config.

### Backend requirements

No extra backend work is required. The MCP server talks to the standard PurpleToad Mail API (`https://api.purpletoadmail.com` by default, override with `PURPLETOAD_BASE_URL`). Just make sure your API key has the scopes you need (`send`, `read`, `manage`).

## Tool Reference

The server exposes **22 tools**.

### Email Operations

| Tool | Description |
|------|-------------|
| `send_email` | Send an email from a PurpleToad Mail mailbox (supports attachments) |
| `reply_to_message` | Reply to a received email, preserving the thread (supports attachments) |
| `schedule_email` | Schedule an email for future delivery (supports attachments) |
| `cancel_scheduled_email` | Cancel a scheduled email before it sends |
| `list_messages` | List received emails with filters (unread, since, from, thread) |
| `get_message` | Get full message body and attachments |
| `search_messages` | Full-text search across all inbound emails |
| `mark_read` | Mark one or more messages as read |
| `archive_message` | Archive a message to keep your inbox clean |
| `list_outbound_messages` | List sent emails with delivery status |
| `get_outbound_message` | Track a single email's delivery history |
| `get_mailbox_status` | Unread count and quota usage for a mailbox |
| `get_account` | Account profile, plan, and usage stats |

### Infrastructure Reference

| Tool | Description |
|------|-------------|
| `list_domains` | List all domains with DNS health and mailbox counts |
| `get_domain` | Get detailed domain info including DNS records |
| `list_mailboxes` | List all mailboxes with quota usage |
| `get_mailbox` | Get mailbox details (quota, last login, alternate email) |
| `list_aliases` | List all email aliases with source and targets |

### Domain & Mailbox Setup

| Tool | Description |
|------|-------------|
| `create_domain` | Add a new domain and receive copy-paste DNS records. Requires `manage` scope. |
| `create_mailbox` | Create a mailbox under a verified domain. The auto-generated password is shown once. Requires `manage` scope. |
| `create_alias` | Create an email alias that forwards to target mailboxes. Requires `manage` scope. |

### Webhooks

| Tool | Description |
|------|-------------|
| `set_webhook` | Configure a webhook endpoint for push delivery of PurpleToad Mail events (`inbound_email`, `delivery_status`, `bounce`, `complaint`, `domain_verified`, `mailbox_created`, `migration_complete`, `rate_limit_warning`, or `all`). Requires `manage` scope. |

## Example Workflows

### "Send a welcome email"

```
User: Send a welcome email from hello@mycompany.com to john@example.com

Agent: send_email(
  from="hello@mycompany.com",
  to=["john@example.com"],
  subject="Welcome to MyCompany!",
  text="Thanks for signing up..."
)
```

### "Check my unread emails"

```
User: Do I have any unread emails in support@mycompany.com?

Agent: list_messages(mailbox="support@mycompany.com", unread_only=true)
Agent: get_account()
```

### "Find that invoice from last week"

```
User: Find the invoice email from Acme Corp I received last week

Agent: search_messages(query="invoice Acme")
Agent: get_message(message_id="...")
```

### "Set up a new domain"

```
User: Add mycompany.com to PurpleToad Mail

Agent: create_domain(domain="mycompany.com")
```

The AI returns a formatted DNS table:

```
| Type  | Host (Name)        | Value / Points to                            | Priority | TTL  |
|-------|--------------------|----------------------------------------------|----------|------|
| MX    | @                  | mail.purpletoadmail.com                      | 10       | 3600 |
| TXT   | @                  | v=spf1 include:mail.purpletoadmail.com ~all  | —        | 3600 |
| TXT   | pt2024._domainkey  | v=DKIM1; k=rsa; p=MIGfMA...                  | —        | 3600 |
| TXT   | _dmarc             | v=DMARC1; p=quarantine; ...                  | —        | 3600 |
```

Copy these into your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.). The domain verifies automatically within minutes.

### "Create a mailbox"

```
User: Create a new mailbox support@mycompany.com

Agent: create_mailbox(
  domain_id="uuid",
  local_part="support",
  display_name="Support Team",
  quota_mb=512
)
```

The AI returns the new mailbox password. **Copy it and change it immediately** — it is shown once only.

### "Create a support alias"

```
User: Set up a support alias that forwards to alice and bob

Agent: create_alias(
  domain_id="uuid",
  source="support",
  targets=["alice@mycompany.com", "bob@mycompany.com"]
)
```

### "Track whether my newsletter was delivered"

```
User: Was yesterday's newsletter delivered?

Agent: list_outbound_messages(
  date_from="2026-06-01",
  status="delivered"
)
Agent: get_outbound_message(message_id="...")
```

### "Schedule a follow-up"

```
User: Schedule a follow-up email for next Monday at 9am

Agent: schedule_email(
  from="sales@mycompany.com",
  to=["prospect@example.com"],
  subject="Following up",
  text="Just checking in...",
  send_at="2026-06-08T09:00:00Z"
)
```

## Configuration Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PURPLETOAD_API_KEY` | **Yes** | — | Your API key (`pt_live_*` or `pt_test_*`) |
| `PURPLETOAD_DEFAULT_FROM` | No | — | Default sender address if `from` is omitted |
| `PURPLETOAD_BASE_URL` | No | `https://api.purpletoadmail.com` | API base URL |
| `PURPLETOAD_TIMEOUT` | No | `30` | Request timeout in seconds |
| `PURPLETOAD_TRANSPORT` | No | `stdio` | `stdio` or `sse` |
| `PURPLETOAD_PORT` | No | `3001` | Port for SSE transport |

## Error Handling

All tools return structured JSON with `success: false` on error:

```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Daily email limit reached.",
  "suggestion": "Wait until tomorrow or upgrade your plan."
}
```

Common error codes:

| Code | Meaning | Suggestion |
|------|---------|------------|
| `INVALID_FROM` | Sender not a valid mailbox | Use `list_mailboxes` to find valid addresses |
| `DOMAIN_NOT_VERIFIED` | DNS records missing | Use `get_domain` to see required records |
| `RATE_LIMIT_EXCEEDED` | Plan limit hit | Wait or upgrade at app.purpletoadmail.com |
| `INSUFFICIENT_SCOPE` | API key lacks permission | Create a key with the required scope in the dashboard |
| `TIMEOUT` | Request timed out | Retry or increase `PURPLETOAD_TIMEOUT` |

## Rate Limits

Rate limits, quotas, and attachment size vary by plan. Check your account
dashboard for current limits.

The `send_email` and `schedule_email` tools return remaining quota in the response.

## Support

- **Website**: [purpletoadmail.com](https://purpletoadmail.com)
- **Dashboard**: [app.purpletoadmail.com](https://app.purpletoadmail.com)
- **Support**: hello@purpletoadmail.com

## License

MIT © PurpleToad Mail
