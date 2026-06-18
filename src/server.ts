// CHECKPOINT: PRD-06 FR-6.1.1 MCP server is a standalone process connecting to the PurpleToad REST API.
// CHECKPOINT: PRD-06 FR-6.1.2 Supports stdio and SSE transports.
// CHECKPOINT: PRD-06 FR-6.1.4 Server lifecycle: validate API key, announce capabilities, request/response loop.
// CHECKPOINT: PRD-06 FR-6.1.5 MCP protocol compliance: initialize, tools/list, tools/call, notifications/initialized, protocol version 2024-11-05.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
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

  let httpServer: import("http").Server | null = null;
  let activeTransport: StdioServerTransport | { close: () => Promise<void> } | null = null;

  const shutdown = async (signal: string) => {
    console.error(`PurpleToad MCP received ${signal}, shutting down...`);
    try {
      if (activeTransport) {
        await activeTransport.close();
      }
      await server.close();
      if (httpServer) {
        httpServer.close();
      }
    } catch {
      // ignore cleanup errors
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  if (config.transport === "sse") {
    const express = await import("express");
    const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
    const app = express.default();

    const transports: Map<string, InstanceType<typeof SSEServerTransport>> = new Map();

    const validateBearer = (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
      const auth = req.headers.authorization || "";
      const match = auth.match(/^Bearer\s+(.+)$/);
      if (!match || match[1] !== config.apiKey) {
        res.status(401).json({ error: "Unauthorized", message: "Invalid or missing Bearer token." });
        return;
      }
      next();
    };

    app.get("/sse", validateBearer, async (_req, res) => {
      const transport = new SSEServerTransport("/message", res);
      const sessionId = randomUUID();
      transports.set(sessionId, transport);
      activeTransport = transport;

      await server.connect(transport);

      res.on("close", () => {
        transports.delete(sessionId);
        if (activeTransport === transport) {
          activeTransport = null;
        }
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
    httpServer = app.listen(port, () => {
      console.error(`PurpleToad MCP SSE server on port ${port}`);
    });
  } else {
    const transport = new StdioServerTransport();
    activeTransport = transport;
    await server.connect(transport);
    console.error("PurpleToad MCP server started (stdio)");
  }
}
