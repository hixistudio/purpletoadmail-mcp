#!/usr/bin/env node
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { name: string; version: string };

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`${packageJson.name} v${packageJson.version}`);
  console.log("");
  console.log("Model Context Protocol server for PurpleToad Mail.");
  console.log("");
  console.log("Usage:");
  console.log("  npx -y purpletoadmail-mcp");
  console.log("");
  console.log("Environment variables:");
  console.log("  PURPLETOAD_API_KEY       Required. API key (pt_live_... or pt_test_...)");
  console.log("  PURPLETOAD_BASE_URL      Optional. API base URL (default: https://api.purpletoadmail.com)");
  console.log("  PURPLETOAD_DEFAULT_FROM  Optional. Default sender address");
  console.log("  PURPLETOAD_TRANSPORT     Optional. stdio or sse (default: stdio)");
  console.log("  PURPLETOAD_PORT          Optional. Port for SSE transport (default: 3001)");
  console.log("  PURPLETOAD_TIMEOUT       Optional. Request timeout in seconds (default: 30)");
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(packageJson.version);
  process.exit(0);
}

async function main() {
  const { startServer } = await import("./server.js");
  await startServer();
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
