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
    } catch {
      // Ignore parse errors
    }
  }

  return { apiKey, baseUrl, timeout, transport, port, defaultFrom };
}

export const config = loadConfig();

if (!config.apiKey) {
  console.error(
    "ERROR: PurpleToad API key required. Set PURPLETOAD_API_KEY or run 'npx purpletoad-mcp init'"
  );
  process.exit(1);
}

if (!config.apiKey.startsWith("pt_live_") && !config.apiKey.startsWith("pt_test_")) {
  console.error("ERROR: Invalid API key format. Must start with pt_live_ or pt_test_");
  process.exit(1);
}
