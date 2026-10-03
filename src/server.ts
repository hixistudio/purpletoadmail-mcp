// CHECKPOINT: PRD-06 FR-6.1.1 / FR-6.1.4 Standalone REST client with API-key validation.
// CHECKPOINT: PRD-06 FR-6.1.2 / FR-6.1.5 stdio and optional legacy SSE protocol lifecycle.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import { client } from "./client.js";
import { tools } from "./tools/index.js";
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

function toolResult(result: Record<string, unknown>): CallToolResult {
  // CHECKPOINT: PRD-06 FR-6.3.1 Structured JSON and legacy text content carry identical results.
  const clean = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
  return {
    content: [{ type: "text", text: JSON.stringify(clean, null, 2) }],
    structuredContent: clean,
    isError: clean.success === false,
  };
}

export function createServer(): Server {
  const server = new Server(
    { name: "purpletoadmail-mcp", version },
    { capabilities: { tools: { listChanged: false } } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.values(tools).map(
      ({ name, description, inputSchema, outputSchema, annotations }) => ({
        name,
        description,
        inputSchema,
        outputSchema,
        annotations,
      }),
    ) as Tool[],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools[request.params.name];
    if (!tool)
      return toolResult({
        success: false,
        error: "TOOL_NOT_FOUND",
        message: "Requested tool is not available",
      });
    try {
      return toolResult(
        (await tool.handler(request.params.arguments || {})) as Record<
          string,
          unknown
        >,
      );
    } catch {
      // Never echo arbitrary exception text, which could contain secrets or API response bodies.
      return toolResult({
        success: false,
        error: "INTERNAL_ERROR",
        message:
          "The tool could not complete. Check configuration and API availability.",
      });
    }
  });
  return server;
}

export async function startServer() {
  const validation = await client.validateKey();
  if (!validation.success)
    throw new Error(
      `API key validation failed (${validation.error?.code || "UNKNOWN"}). Check your key, scopes, and API URL.`,
    );
  if ((validation.data as Record<string, unknown> | undefined)?.limited_scope)
    console.error(
      "API key authenticated with send-only scope; reading and replying require read scope.",
    );
  let httpServer: import("node:http").Server | undefined;
  const servers = new Set<Server>();
  const shutdown = async () => {
    httpServer?.close();
    await Promise.allSettled([...servers].map((server) => server.close()));
    httpServer?.closeAllConnections();
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  if (config.transport === "stdio") {
    const server = createServer();
    servers.add(server);
    await server.connect(new StdioServerTransport());
    console.error("PurpleToad Mail MCP started (stdio)");
    return;
  }
  const { default: express } = await import("express");
  const { SSEServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/sse.js"
  );
  const app = express();
  const sessions = new Map<
    string,
    { transport: InstanceType<typeof SSEServerTransport>; server: Server }
  >();
  // CHECKPOINT: PRD-06 FR-6.1.2 Bearer authentication on both SSE legs; loopback-only legacy compatibility.
  app.use((req, res, next) => {
    const host = req.headers.host;
    if (
      ![`127.0.0.1:${config.port}`, `localhost:${config.port}`].includes(
        host || "",
      ) ||
      req.headers.origin
    ) {
      res.status(403).json({ error: "Forbidden host or origin" });
      return;
    }
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/)?.[1];
    if (
      !token ||
      Buffer.byteLength(token) !== Buffer.byteLength(config.apiKey) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(config.apiKey))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });
  app.get("/sse", async (_req, res) => {
    if (sessions.size >= 32) {
      res.status(503).json({ error: "Too many local sessions" });
      return;
    }
    const transport = new SSEServerTransport("/message", res, {
      enableDnsRebindingProtection: true,
      allowedHosts: [`127.0.0.1:${config.port}`, `localhost:${config.port}`],
    });
    const server = createServer();
    sessions.set(transport.sessionId, { transport, server });
    servers.add(server);
    res.on("close", () => {
      sessions.delete(transport.sessionId);
      servers.delete(server);
      void server.close().catch(() => undefined);
    });
    try {
      await server.connect(transport);
    } catch {
      sessions.delete(transport.sessionId);
      servers.delete(server);
      await server.close();
      if (!res.headersSent) res.status(500).end();
    }
  });
  app.post("/message", async (req, res) => {
    const sessionId = req.query.sessionId;
    if (typeof sessionId !== "string") {
      res.status(400).end("Missing sessionId");
      return;
    }
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).end("Session not found");
      return;
    }
    try {
      await session.transport.handlePostMessage(req, res);
    } catch {
      if (!res.headersSent) res.status(400).end("Invalid MCP message");
    }
  });
  httpServer = await new Promise<import("node:http").Server>(
    (resolve, reject) => {
      const listener = app.listen(config.port, "127.0.0.1", () =>
        resolve(listener),
      );
      listener.once("error", reject);
    },
  );
  console.error(
    `PurpleToad Mail MCP legacy SSE listening on 127.0.0.1:${config.port}`,
  );
}
