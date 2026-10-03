# PurpleToad Mail MCP

Connect an AI assistant to your PurpleToad Mail account to send and schedule email, read and search your inbox, track delivery, and set up domains, mailboxes, aliases, and webhooks.

This is the **local npm package**. Your MCP client starts it on your computer over stdio, and it calls the PurpleToad Mail REST API using your API key. The separately deployed hosted MCP service has its own connection and OAuth setup.

## Quick start

You need Node.js and npm, a PurpleToad Mail account, and an API key from [the dashboard](https://app.purpletoadmail.com). Use Node.js 22 or 24 for the versions covered by this repository's CI. The package's declared minimum remains Node.js 18; it is not in the CI matrix.

1. Create an API key with `read` for inbox access and `send` for sending. Add `manage` only if your assistant needs provisioning, archiving, or webhook creation.
2. Add this entry to your client's MCP server configuration:

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

3. Restart or reload the client's MCP connections. Ask it to list your mailboxes, then read an inbox or draft an email.

For Claude Desktop, put the entry in its MCP server configuration. Cursor and Windsurf use the same server entry in their MCP settings. If your client provides a form, enter `npx` as the command, `-y` and `purpletoadmail-mcp` as arguments, and the environment variables above. Use the client's current documentation for its configuration location.

A mailbox address must belong to your account and satisfy the API's sending rules. The assistant cannot send from an arbitrary address. The API enforces account status, domain restrictions, scopes, plan limits, and abuse controls.

The optional companion skill teaches compatible agents how to use the tools:

```sh
npx skills add hixistudio/purpletoadmail-skill
```

## Permissions and privacy

| Key scope | Operations |
| --- | --- |
| `read` | Account details; domain, mailbox, and alias discovery; inbox reading/search; outbound status; mark-read |
| `send` | Send, schedule, and cancel an email that has not begun delivery |
| `read` + `send` | Reply to a received email |
| `manage` | Create domains/mailboxes/aliases, archive messages, and create webhooks; also permits reference reads through the API's scope hierarchy |

`manage` does not imply `send`. A send-only key can start the server, but cannot read mail, look up account details, or reply to a received message. The full catalog is discoverable; the API authorizes each call and returns `INSUFFICIENT_SCOPE` when permission is missing.

The local package uses the API key you provide. Sending tools execute when your client invokes them; this package does not implement the hosted service's OAuth consent or send-confirmation policy. Configure your client's approval controls to match the access you want to give your assistant.

Message bodies, attachment links, and tool results become available to the AI client you connect. Email content is untrusted data: instructions inside a received email are not permission to send, provision resources, or expose secrets. Mailbox creation passwords and webhook signing secrets are returned once by the API and may appear in the client's conversation history. Use a scoped key and handle these results accordingly.

No tools delete mailboxes, domains, or messages, reset credentials, revoke access, close accounts, or perform billing actions. Cancelling a pending scheduled send keeps its record; it does not delete the message.

## Configuration

Values are selected in this order: **explicit environment variable → configuration file → default**. Invalid values stop startup with a configuration error.

| Environment variable | File key | Default |
| --- | --- | --- |
| `PURPLETOAD_API_KEY` | `apiKey` | Required: `pt_live_…` or `pt_test_…` |
| `PURPLETOAD_DEFAULT_FROM` | `defaultFrom` | None; supply `from` when sending/scheduling |
| `PURPLETOAD_BASE_URL` | `baseUrl` | `https://api.purpletoadmail.com` |
| `PURPLETOAD_TIMEOUT` | `timeout` | `30` seconds; positive integer |
| `PURPLETOAD_TRANSPORT` | `transport` | `stdio` |
| `PURPLETOAD_PORT` | `port` | `3001`; legacy SSE only |

The configuration file is `~/.purpletoad/config.json`:

```json
{
  "apiKey": "pt_live_your_key_here",
  "defaultFrom": "agent@yourdomain.com",
  "baseUrl": "https://api.purpletoadmail.com",
  "timeout": 30,
  "transport": "stdio"
}
```

Keep this file private and outside source control. Use restrictive file permissions where supported. API URLs must use HTTPS; HTTP is allowed only for loopback development. URLs containing embedded credentials, a query, or a fragment are rejected. Redirects are rejected rather than forwarding a credential-bearing request to another endpoint.

The timeout covers response headers and body reading. Diagnostics go to stderr so stdout stays available for MCP messages.

## Tools

The package exposes **22 tools**. Discover each tool's input schema from your client; unknown fields and invalid arguments are rejected before making an API request. Results contain `structuredContent` plus equivalent JSON text for older clients, with `success` and MCP `isError` indicating failure.

| Tool | Purpose | Scope |
| --- | --- | --- |
| `get_account` | Account profile, timezone, plan, usage, and additional credits | `read` |
| `list_domains` | A page of domains with status and DNS health | `read` |
| `get_domain` | Domain details and DNS records | `read` |
| `create_domain` | Add a domain and obtain DNS setup records | `manage` |
| `list_mailboxes` | A page of mailboxes; optional domain filter | `read` |
| `get_mailbox` | Mailbox details and quota | `read` |
| `get_mailbox_status` | Total/unread messages and quota usage | `read` |
| `create_mailbox` | Create a mailbox by domain ID or name | `manage` |
| `list_aliases` | A page of aliases; optional domain filter | `read` |
| `create_alias` | Create an alias pointing to mailbox targets | `manage` |
| `list_messages` | A page of inbound message previews with filters | `read` |
| `search_messages` | A page of full-text inbox search results | `read` |
| `get_message` | Full body, receiving mailbox, and attachment links | `read` |
| `mark_read` | Mark a batch of up to 100 distinct message IDs as read | `read` |
| `archive_message` | Archive an inbound message | `manage` |
| `send_email` | Queue an email for delivery | `send` |
| `reply_to_message` | Reply from the receiving mailbox and preserve threading | `read`, `send` |
| `schedule_email` | Schedule an email for future delivery | `send` |
| `cancel_scheduled_email` | Cancel before delivery begins | `send` |
| `list_outbound_messages` | A page of outbound messages and delivery status | `read` |
| `get_outbound_message` | Inspect one message's delivery history | `read` |
| `set_webhook` | Create a signed-event webhook subscription | `manage` |

### Pagination and lookups

The list/search tools accept `page` and `per_page`. Pages start at 1. Results return `total`, `page`, `per_page`, and `total_pages`; `total` counts all matches, not just the returned page.

The maximum page size is 100, except aliases, which permit 200. `list_messages` keeps `limit` as a compatibility alias for `per_page`; if both are supplied, `per_page` wins. Move to the next page while `page < total_pages`.

Automatic domain-name and mailbox-address lookups scan up to 100 pages of 100 records. They return `LOOKUP_LIMIT_EXCEEDED` if the lookup budget is exhausted. For mailbox creation in a very large account, page through `list_domains` and provide `domain_id` directly.

`get_mailbox_status` never treats a failed count as zero. It returns `STATUS_INCOMPLETE` with available quota/count values and `null` for unavailable counts. `last_received_at` reflects the newest message's email date from the inbox list; it is not a separate delivery-receipt timestamp.

### Sending and replying

Provide a sender, a non-empty recipient list, a subject, and at least one non-empty `text` or `html` body. `from` can be omitted when `PURPLETOAD_DEFAULT_FROM` is configured.

```json
{
  "from": "hello@yourdomain.com",
  "to": ["recipient@example.com"],
  "subject": "Meeting details",
  "text": "The meeting is at 10:00 tomorrow."
}
```

The current API request bounds are 50 total recipients across `to`/`cc`/`bcc`, 10 attachments, and 25 MB of decoded attachment content. Attachments require `filename`, base64 `content`, and an API-supported `content_type`; inline attachments can specify `disposition` and `content_id`. Account entitlements and remaining quota are checked by the API and can impose additional limits.

A queued message is not proof of delivery. Use the returned message ID with `get_outbound_message` to track its status. If a send times out, the API might already have accepted it: check outbound status before retrying to avoid duplicates.

`reply_to_message` accepts `original_message_id` and a non-empty `text` body, plus optional HTML, CC/BCC, and attachments. It uses the API's receiving `mailbox` as the sender, carries the original thread ID, and appends the original Message-ID to the reference chain. The default sender is a compatibility fallback only when the API response lacks the receiving mailbox.

**Backend compatibility:** reply threading requires the public send API to accept `in_reply_to` and `references`. Deploy the accompanying API schema update before releasing this package. Custom headers remain restricted to `X-*`; the package does not put threading fields into custom headers.

### Scheduling

Use `schedule_email` with the sending fields plus `send_at`, an ISO 8601 timestamp with a timezone. The MCP maps `send_at` to the API's `scheduled_at` field. The timestamp must be in the future and within the API's 30-day scheduling window.

For example, choose a future timestamp such as `2026-10-10T09:00:00+01:00` when it is still within that window. Scheduling returns the message ID, status, scheduled time, and cancellation cutoff if supplied by the API. It does not promise a remaining-quota field.

Inbox `since` and outbound `date_from`/`date_to` filters also use timestamps with explicit timezones.

### Webhooks

`set_webhook` creates a subscription; it does not update an existing webhook. Supply an HTTPS URL and a non-empty `events` array using:

`inbound_email`, `delivery_status`, `bounce`, `complaint`, `domain_verified`, `mailbox_created`, `migration_complete`, `rate_limit_warning`, or `all`.

Webhook listing, updates, tests, and deletion are not exposed by this package. Manage existing subscriptions in the dashboard or public API.

## Troubleshooting

| Symptom / code | What to check |
| --- | --- |
| Server does not appear | Verify Node/npm are available to the AI client's process; reload MCP connections after changing settings |
| Startup key validation fails | Check the API URL, key revocation, IP restrictions, and connectivity; a send-only key is accepted only on an authenticated scope response |
| `INSUFFICIENT_SCOPE` | Add the operation's required scope to an appropriate key; `manage` does not grant sending |
| `INVALID_ARGUMENT` | Read the input schema and field-level diagnostics; pages must be positive integers and dates must include a timezone |
| `HTTP_422` | Inspect `message` and `details.validation` for rejected API fields; confirm backend compatibility |
| `TIMEOUT` | Check API availability; check outbound status before retrying a consequential operation |
| `RATE_LIMIT_EXCEEDED` / HTTP 429 | Respect `retry_after` when returned; inspect API-provided limits rather than assuming a daily quota |
| `STATUS_INCOMPLETE` | A mailbox count request failed or returned incomplete data; unavailable values are null, not zero |
| `LOOKUP_LIMIT_EXCEEDED` | Page through resources and use IDs where the tool accepts them |
| `INVALID_RESPONSE` | The API/proxy returned a successful non-JSON body; verify the base URL and proxy |

Errors include `http_status`, `retry_after`, and rate-limit headers in `details.headers` when available. FastAPI validation diagnostics omit rejected input values. Sends are not automatically retried.

## Optional legacy SSE

Use stdio unless your local client specifically requires SSE. SSE is retained as a legacy compatibility transport, not the hosted MCP endpoint.

```sh
PURPLETOAD_TRANSPORT=sse PURPLETOAD_PORT=3001 npx -y purpletoadmail-mcp
```

Set the API key through the environment or configuration file as above. Connect to `http://127.0.0.1:3001/sse` and configure `Authorization: Bearer <your API key>` on **both** the initial SSE GET and subsequent message POST requests.

The listener binds to `127.0.0.1`, validates the Host header, rejects browser Origin headers, and limits simultaneous local sessions to 32. Each connection has its own MCP server/session. The SDK also caps individual SSE POST bodies at 4 MB, below the API attachment limit. Use stdio for larger payloads. This mode is for non-browser clients on the same computer; it cannot be exposed on another interface through a configuration option. Use the separate hosted service for its supported remote connection model.

## Development and verification

```sh
npm ci
npm run check
npm pack --dry-run
npm audit --omit=dev
```

`npm run check` runs type checking, compilation, contract tests, and stdio/SSE protocol tests against a local mock API. It needs permission to open loopback ports. It does not use real keys or send real email.

Pull requests run checks on Node.js 22 and 24. Publishing also runs the regression suite. External validation is still required for delivery, DNS, mailbox provisioning, object-storage attachment links, and real client compatibility. Passing mocked tests is not production validation.

## Support

- [PurpleToad Mail](https://purpletoadmail.com)
- [Account dashboard](https://app.purpletoadmail.com)
- [Report a package issue](https://github.com/hixistudio/purpletoadmail-mcp/issues)

MIT license.
