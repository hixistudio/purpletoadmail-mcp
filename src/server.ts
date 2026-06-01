import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { client } from "./client.js";
import { tools } from "./tools/index.js";

// CHECKPOINT: PRD-06 FR-6.1.4 — Validate API key on startup
async function validateApiKey(): Promise<boolean> {
  const result = await client.validateKey();
  if (!result.success) {
    console.error(`ERROR: API key validation failed: ${result.error?.message || "Unknown error"}`);
    return false;
  }
  const data = result.data as Record<string, unknown>;
  console.error(`PurpleToad MCP connected as ${data.email || "unknown"} (${data.plan || "unknown"} plan)`);
  return true;
}

export async function startServer() {
  const valid = await validateApiKey();
  if (!valid) {
    process.exit(1);
  }

  const server = new Server(
    {
      name: "purpletoad-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
    }
  );

  // CHECKPOINT: PRD-06 FR-6.1.5 — tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolList = Object.values(tools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as { type: "object"; properties?: object; [k: string]: unknown },
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { tools: toolList as any };
  });

  // CHECKPOINT: PRD-06 FR-6.1.5 — tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools[name];

    if (!tool) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "TOOL_NOT_FOUND",
              message: `Tool '${name}' not found.`,
            }),
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args || {});
      const resultObj = result as Record<string, unknown>;
      const isError = resultObj.success === false;
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
        isError,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // CHECKPOINT: PRD-06 FR-6.1.2 — Transport selection
  if (config.transport === "sse") {
    const express = await import("express");
    const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
    const app = express.default();

    app.get("/sse", async (_req: unknown, res: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transport = new SSEServerTransport("/message", res as any);
      await server.connect(transport);
    });

    app.post("/message", async (_req: unknown, res: unknown) => {
      // Messages handled by SSE transport
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (res as any).status(200).end();
    });

    const port = config.port || 3001;
    app.listen(port, () => {
      console.error(`PurpleToad MCP SSE server on port ${port}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("PurpleToad MCP server started (stdio)");
  }
}
