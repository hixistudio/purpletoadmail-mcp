#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "purpletoad-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "send_email",
        description: "Send an email via PurpleToad",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Sender email address" },
            to: { type: "string", description: "Recipient email address" },
            subject: { type: "string" },
            body: { type: "string" },
          },
          required: ["from", "to", "subject"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "send_email") {
    return {
      content: [
        {
          type: "text",
          text: `Email sending not yet implemented. Args: ${JSON.stringify(request.params.arguments)}`,
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
