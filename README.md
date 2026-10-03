# PurpleToad Mail MCP

Send, receive, and manage email from your AI assistant using your own domains and mailboxes.

[npm](https://www.npmjs.com/package/purpletoadmail-mcp) · [Documentation](https://docs.purpletoadmail.com) · [Dashboard](https://app.purpletoadmail.com)

## What you can do

- Send emails, reply to conversations, and schedule follow-ups.
- Read your inbox, search messages, and check unread counts.
- Track delivery status and work with attachments.
- Set up domains, mailboxes, aliases, and webhooks.

Works with MCP clients that can run a local server, including Claude Desktop and Cursor.

## Prefer a hosted connection?

If your client supports remote MCP, use our hosted server without installing Node.js or setting up a local API key:

```text
https://mcp.purpletoadmail.com/mcp
```

Add this URL in your client's remote MCP or connector settings, then sign in to PurpleToad Mail and choose the permissions to grant. See the [remote setup guide](https://docs.purpletoadmail.com/docs/mcp).

## Local setup

You need **Node.js 18+**, a [PurpleToad Mail account](https://app.purpletoadmail.com), and an API key.

**1. Create an API key** in the dashboard under **Settings → API Keys**.

Choose `read` to access mail, `send` to send it, and `manage` for mailbox/domain setup, archiving, or webhooks. Replies need both `read` and `send`.

**2. Add PurpleToad Mail to your client's MCP configuration:**

```json
{
  "mcpServers": {
    "purpletoadmail": {
      "command": "npx",
      "args": ["-y", "purpletoadmail-mcp"],
      "env": {
        "PURPLETOAD_API_KEY": "pt_live_your_key_here",
        "PURPLETOAD_DEFAULT_FROM": "hello@yourdomain.com"
      }
    }
  }
}
```

Replace the key and sender address, then reload your client's MCP connections. No separate installation is needed—`npx` runs the package for you.

`PURPLETOAD_DEFAULT_FROM` is optional. If omitted, provide a sender when sending or scheduling an email. Use a mailbox you own on PurpleToad Mail.

**3. Try asking your assistant:**

> “Check unread emails in support@yourdomain.com.”
>
> “Reply to the latest email from Alex and confirm the meeting.”
>
> “Send the invoice to alex@example.com from billing@yourdomain.com.”

## Available tools

**22 tools** cover email and account setup. Your assistant discovers their inputs automatically.

| Area | Tools |
| --- | --- |
| Sending | `send_email`, `reply_to_message`, `schedule_email`, `cancel_scheduled_email` |
| Inbox | `list_messages`, `get_message`, `search_messages`, `mark_read`, `archive_message` |
| Delivery | `list_outbound_messages`, `get_outbound_message` |
| Domains | `list_domains`, `get_domain`, `create_domain` |
| Mailboxes | `list_mailboxes`, `get_mailbox`, `get_mailbox_status`, `create_mailbox` |
| Aliases | `list_aliases`, `create_alias` |
| Webhooks | `set_webhook` |
| Account | `get_account` |

## Companion skill

Give your assistant guidance for common PurpleToad Mail workflows:

```sh
npx skills add hixistudio/purpletoadmail-skill
```

## Help

This package runs locally with an API key. For hosted MCP connections, configuration options, and usage guides, see the [documentation](https://docs.purpletoadmail.com).

[Report an issue](https://github.com/hixistudio/purpletoadmail-mcp/issues) · [MIT license](LICENSE)
