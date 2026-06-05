import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { client } from "./client.js";
import { tools } from "./tools/index.js";

async function validateApiKey(): Promise<boolean> {
  const result = await client.validateKey();
  if (!result.success) {
    console.error(`ERROR: API key validation failed: ${result.error?.message || "Unknown error"}`);
    return false;
  }
  console.error("PurpleToad MCP API key validated successfully");
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
      version: "1.1.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolList = Object.values(tools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as { type: "object"; properties?: object; [k: string]: unknown },
    }));
    return { tools: toolList };
  });

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

  if (config.transport === "sse") {
    const express = await import("express");
    const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
    const app = express.default();

    const transports: Map<string, InstanceType<typeof SSEServerTransport>> = new Map();

    app.get("/sse", async (_req, res) => {
      const transport = new SSEServerTransport("/message", res);
      await server.connect(transport);
      // _sessionId is private in SDK v0.5.0
      const sessionId = (transport as unknown as { _sessionId: string })._sessionId;
      transports.set(sessionId, transport);

      res.on("close", () => {
        transports.delete(sessionId);
      });
    });

    app.post("/message", async (req, res) => {
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        res.status(400).end("Missing sessionId");
        return;
      }

      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).end("Session not found");
        return;
      }

      await transport.handlePostMessage(req, res);
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
