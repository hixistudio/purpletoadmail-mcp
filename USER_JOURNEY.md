# PurpleToad MCP — New User Journey

> End-to-end flow of how a developer discovers, installs, and uses the PurpleToad MCP server with Claude Desktop.

---

## Persona: Sarah, Indie SaaS Founder

Sarah runs a small SaaS business. She wants her AI assistant (Claude) to be able to:
- Send onboarding emails to new customers
- Check support emails and draft replies
- Track whether her newsletter was delivered
- Set up new email addresses for her team

She's technical enough to run a terminal and edit JSON files.

---

## Phase 1: Discovery (2 minutes)

### Where Sarah hears about it

1. **PurpleToad Dashboard** — After signing up at `app.purpletoadmail.com`, she sees a banner:
   > "Connect Claude, Cursor, or any MCP client to your mail. [Learn more]"

2. **GitHub / npm** — She searches "email MCP server" and finds:
   ```
   npm install -g purpletoad-mcp
   ```

3. **Claude's MCP directory** — Listed under "Email & Communication" tools.

---

## Phase 2: Get an API Key (3 minutes)

Sarah logs into her PurpleToad dashboard:

1. **Settings → API Keys → Create Key**
2. She names it "Claude Desktop"
3. She scopes it:
   - ✅ `send` — send and schedule emails
   - ✅ `read` — read and search messages
   - ✅ `manage` — create domains, mailboxes, aliases
4. She copies the key: `pt_live_a1b2c3d4e5f6...`
   > ⚠️ Shown **once only**. She pastes it into her password manager.

---

## Phase 3: Install & Configure (5 minutes)

### Option A: Global install (recommended)

```bash
npm install -g purpletoad-mcp
```

### Option B: npx (no install)

```bash
npx -y purpletoad-mcp
```

### Configuration

Sarah creates the config file:

```bash
mkdir -p ~/.purpletoad
cat > ~/.purpletoad/config.json <<EOF
{
  "apiKey": "pt_live_a1b2c3d4e5f6...",
  "defaultFrom": "sarah@mycompany.com",
  "baseUrl": "https://api.purpletoadmail.com",
  "timeout": 30
}
EOF
chmod 600 ~/.purpletoad/config.json
```

> The `defaultFrom` saves her from typing her email address in every tool call.

---

## Phase 4: Connect to Claude Desktop (3 minutes)

### macOS

```bash
# Edit Claude's MCP config
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Windows

```powershell
notepad %APPDATA%\Claude\claude_desktop_config.json
```

### Config JSON

```json
{
  "mcpServers": {
    "purpletoad": {
      "command": "npx",
      "args": ["-y", "purpletoad-mcp"],
      "env": {
        "PURPLETOAD_API_KEY": "pt_live_a1b2c3d4e5f6...",
        "PURPLETOAD_DEFAULT_FROM": "sarah@mycompany.com"
      }
    }
  }
}
```

> **Why env vars in Claude config?** Keeps the API key out of shell history and makes it easy for Claude to pass it to the MCP process.

### Restart Claude

Sarah fully quits Claude (`Cmd+Q` / `Alt+F4`) and reopens it.

---

## Phase 5: First Interaction — "Does it work?" (1 minute)

In Claude's chat, Sarah types:

> **Sarah:** Check my account status

Claude sees the available tools, picks `get_account`, and calls it:

```json
// MCP request (invisible to Sarah)
{
  "name": "get_account",
  "arguments": {}
}
```

```json
// MCP response (rendered by Claude)
{
  "success": true,
  "name": "Sarah Chen",
  "email": "sarah@mycompany.com",
  "plan": "Builder",
  "email_used_this_year": 124_350,
  "email_limit": 1_000_000,
  "storage_used_mb": 8_420,
  "storage_limit_mb": 25_600,
  "domains": 3,
  "mailboxes": 7
}
```

Claude replies:

> **Claude:** Your PurpleToad account looks healthy! You're on the **Builder** plan with 3 domains and 7 mailboxes. You've used **124,350** of your 1M yearly emails (12.4%) and **8.4 GB** of your 25 GB storage.

✅ **Sarah confirms the connection works.**

---

## Phase 6: Real Workflows

### Workflow A: Send a Welcome Email

> **Sarah:** Send a welcome email from hello@mycompany.com to john@example.com

Claude reasons:
1. Need to verify `hello@mycompany.com` is a valid mailbox → `list_mailboxes`
2. Send the email → `send_email`

```json
// Step 1: list_mailboxes
{ "name": "list_mailboxes", "arguments": {} }
```

```json
// Step 2: send_email
{
  "name": "send_email",
  "arguments": {
    "from": "hello@mycompany.com",
    "to": ["john@example.com"],
    "subject": "Welcome to MyCompany!",
    "text": "Hi John,\n\nThanks for signing up...",
    "html": "<h1>Welcome!</h1><p>Thanks for signing up...</p>"
  }
}
```

Claude replies:

> **Claude:** ✅ Welcome email sent! Message ID: `msg_abc123`. Status: `queued`. You have **4,876** sends remaining today. The email should deliver within 1–2 minutes.

---

### Workflow B: Check Support Inbox

> **Sarah:** Any unread emails in support@mycompany.com?

```json
{ "name": "list_messages", "arguments": { "mailbox": "support@mycompany.com", "unread_only": true, "limit": 10 } }
```

Claude replies:

> **Claude:** You have **3 unread** support emails:
> 
> 1. **From:** `angry-customer@example.com` — *"Billing issue — charged twice!"* (2 hours ago)
> 2. **From:** `partnership@bigcorp.com` — *"Integration partnership inquiry"* (5 hours ago)
> 3. **From:** `newsletter@substack.com` — *"Your weekly digest"* (12 hours ago)
> 
> Want me to read any of these in full?

> **Sarah:** Read the billing one

```json
{ "name": "get_message", "arguments": { "message_id": "msg_def456" } }
```

> **Claude:** Here's the billing email from angry-customer@example.com:
> 
> **Subject:** Billing issue — charged twice!
> 
> *"I was charged $49 twice on June 1st. Please refund the duplicate charge immediately."*
> 
> Want me to draft a reply and send it?

> **Sarah:** Yes, draft a polite apology and cc billing@mycompany.com

Claude drafts the reply, shows it to Sarah for approval, then:

```json
{ "name": "send_email", "arguments": { "from": "support@mycompany.com", "to": ["angry-customer@example.com"], "cc": ["billing@mycompany.com"], "subject": "Re: Billing issue — charged twice!", "text": "..." } }
```

Then marks the original as read:

```json
{ "name": "mark_read", "arguments": { "message_id": "msg_def456" } }
```

> **Claude:** ✅ Reply sent and original message marked as read.

---

### Workflow C: Find an Old Invoice

> **Sarah:** Find the invoice from Acme Corp I received in May

```json
{ "name": "search_messages", "arguments": { "query": "invoice Acme Corp", "per_page": 10 } }
```

> **Claude:** Found **2** emails matching "invoice Acme Corp":
> 
> 1. **May 15** — *"Invoice #AC-2026-0515 from Acme Corp"* — $2,400
> 2. **May 28** — *"Re: Invoice #AC-2026-0515"* — payment confirmation
> 
> Want me to retrieve the full invoice?

---

### Workflow D: Track Newsletter Delivery

> **Sarah:** Was yesterday's newsletter delivered?

```json
{ "name": "list_outbound_messages", "arguments": { "date_from": "2026-06-07", "date_to": "2026-06-08" } }
```

Claude sees the newsletter, then:

```json
{ "name": "get_outbound_message", "arguments": { "message_id": "msg_newsletter_789" } }
```

> **Claude:** Your newsletter was sent to **1,247** recipients:
> - ✅ **Delivered:** 1,189 (95.4%)
> - ⚠️ **Bounced:** 38 (3.0%)
> - 🕐 **Pending:** 20 (1.6%)
> 
> SMTP response: `250 OK id=abc123`
> 
> 38 addresses bounced — want me to show you which ones so you can clean your list?

---

### Workflow E: Set Up a New Team Member

> **Sarah:** Create a new mailbox for our new developer, Alex

Claude first checks available domains:

```json
{ "name": "list_domains", "arguments": {} }
```

> **Claude:** You have `mycompany.com` verified. Ready to create `alex@mycompany.com`?

> **Sarah:** Yes

```json
{ "name": "create_mailbox", "arguments": { "domain_id": "dom_abc123", "local_part": "alex", "display_name": "Alex Rivera", "quota_mb": 5120 } }
```

> **Claude:** ✅ Mailbox created! 
> 
> **Email:** `alex@mycompany.com`
> **Password:** `TempP@ss789!` *(shown once — Alex should change this immediately)*
> **Quota:** 5 GB
> 
> Alex can log in at `app.purpletoadmail.com` using these credentials.

---

## Phase 7: Self-Hosted / SSE Mode (Optional)

Sarah wants to run the MCP server on her VPS so her whole team can share it.

```bash
# On her server
export PURPLETOAD_API_KEY="pt_live_..."
export PURPLETOAD_TRANSPORT="sse"
export PURPLETOAD_PORT="3001"
npx purpletoad-mcp
```

Then in Claude Desktop config:

```json
{
  "mcpServers": {
    "purpletoad": {
      "url": "http://mcp-server.internal:3001/sse",
      "headers": {
        "Authorization": "Bearer pt_live_..."
      }
    }
  }
}
```

> ⚠️ In production, Sarah puts this behind HTTPS with a reverse proxy (Nginx/Caddy) and restricts access via firewall rules.

---

## Phase 8: Troubleshooting

### "API key validation failed"

Sarah sees this in Claude's MCP logs. She checks:
1. Is the key copied correctly? (no extra spaces)
2. Does it start with `pt_live_` or `pt_test_`?
3. Did she accidentally regenerate the key in the dashboard (invalidating the old one)?

### "Tool not found"

Claude tries to call `delete_domain`. Sarah learns:
> Destructive actions like deleting domains or mailboxes are intentionally **not available** via MCP for safety. She must use the PurpleToad dashboard for destructive operations.

### "Rate limit exceeded"

Sarah sees:
```json
{ "success": false, "error": "RATE_LIMIT_EXCEEDED", "message": "Daily email limit reached." }
```

Claude suggests:
> "You've hit your daily send limit. You can wait until tomorrow (resets at midnight UTC) or upgrade your plan at app.purpletoadmail.com."

---

## Security Model Summary

| Layer | Protection |
|---|---|
| **API Key** | `pt_live_` / `pt_test_` prefix, validated at startup |
| **Config file** | `~/.purpletoad/config.json` should have `chmod 600` |
| **SSE transport** | Requires `Authorization: Bearer <key>` on `/sse` endpoint |
| **Destructive ops** | **Blocked** — no delete/restore via MCP |
| **Email validation** | All `to`/`cc`/`bcc` addresses validated before sending |
| **Timeouts** | 30s default, aborts hanging requests |

---

## Tool Availability Quick Reference

| What Sarah wants to do | Tool |
|---|---|
| Send an email | `send_email` |
| Schedule a future email | `schedule_email` |
| Cancel a scheduled email | `cancel_scheduled_email` |
| Check inbox | `list_messages` |
| Read a full email | `get_message` |
| Search emails | `search_messages` |
| Mark as read | `mark_read` |
| Archive a message | `archive_message` |
| Check sent emails | `list_outbound_messages` |
| Track delivery | `get_outbound_message` |
| See account status | `get_account` |
| List domains | `list_domains` |
| Add a domain | `create_domain` |
| List mailboxes | `list_mailboxes` |
| Create a mailbox | `create_mailbox` |
| Change a password | `update_mailbox_password` |
| List aliases | `list_aliases` |
| Create an alias | `create_alias` |
| **Delete anything** | ❌ Not available via MCP (use dashboard) |

---

*This document lives in the repo as a reference for onboarding new users and evaluating the developer experience.*
