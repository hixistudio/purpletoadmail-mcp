# PurpleToad MCP Server

Model Context Protocol (MCP) server for PurpleToad email infrastructure.

## Installation

```bash
npm install -g purpletoad-mcp
```

## Usage

```bash
purpletoad-mcp --api-key pt_live_...
```

## Supported Transports

- stdio (local Claude Desktop, Cursor, Windsurf)
- SSE (remote connections)

## Tools

- `send_email` — Send an email
- `list_messages` — List inbox messages
- `get_message` — Get a specific message
- `create_domain` — Create a new domain
- `create_mailbox` — Create a mailbox
- `create_api_key` — Generate an API key
