import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface Config {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  transport: "stdio" | "sse";
  port?: number;
  defaultFrom?: string;
}

function loadConfig(): Config {
  const apiKey = process.env.PURPLETOAD_API_KEY || "";
  const baseUrl = process.env.PURPLETOAD_BASE_URL || "https://api.purpletoadmail.com";
  const timeout = parseInt(process.env.PURPLETOAD_TIMEOUT || "30", 10);
  const transport = (process.env.PURPLETOAD_TRANSPORT || "stdio") as "stdio" | "sse";
  const port = process.env.PURPLETOAD_PORT ? parseInt(process.env.PURPLETOAD_PORT, 10) : undefined;
  const defaultFrom = process.env.PURPLETOAD_DEFAULT_FROM || undefined;

  if (Number.isNaN(timeout) || timeout <= 0) {
    console.error("ERROR: PURPLETOAD_TIMEOUT must be a positive integer");
    process.exit(1);
  }
  if (port !== undefined && (Number.isNaN(port) || port <= 0 || port > 65535)) {
    console.error("ERROR: PURPLETOAD_PORT must be a valid port number (1-65535)");
    process.exit(1);
  }
  if (transport !== "stdio" && transport !== "sse") {
    console.error("ERROR: PURPLETOAD_TRANSPORT must be 'stdio' or 'sse'");
    process.exit(1);
  }

  const configPath = join(homedir(), ".purpletoad", "config.json");
  if (existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(readFileSync(configPath, "utf-8"));
      return {
        apiKey: apiKey || fileConfig.apiKey || "",
        baseUrl: baseUrl || fileConfig.baseUrl || "https://api.purpletoadmail.com",
        timeout: timeout || fileConfig.timeout || 30,
        transport: transport || fileConfig.transport || "stdio",
        port: port || fileConfig.port,
        defaultFrom: defaultFrom || fileConfig.defaultFrom,
      };
    } catch (err) {
      console.error(`Warning: Failed to parse ${configPath}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return { apiKey, baseUrl, timeout, transport, port, defaultFrom };
}

export const config = loadConfig();

if (!config.apiKey) {
  console.error("ERROR: PurpleToad API key required. Set PURPLETOAD_API_KEY env var.");
  process.exit(1);
}

if (!config.apiKey.startsWith("pt_live_") && !config.apiKey.startsWith("pt_test_")) {
  console.error("ERROR: Invalid API key format. Must start with pt_live_ or pt_test_");
  process.exit(1);
}
