// CHECKPOINT: PRD-06 FR-6.1.3 Merge explicit environment values, file values, then defaults; validate the result.
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  transport: "stdio" | "sse";
  port: number;
  defaultFrom?: string;
}

export function resolveConfig(
  env: NodeJS.ProcessEnv,
  file: Record<string, unknown> = {},
): Config {
  const value = (key: string, field: string, fallback?: unknown) =>
    env[key] ?? file[field] ?? fallback;
  const integer = (
    input: unknown,
    label: string,
    maximum = Number.MAX_SAFE_INTEGER,
  ) => {
    if (
      (typeof input !== "string" && typeof input !== "number") ||
      !/^\d+$/.test(String(input))
    ) {
      throw new Error(`${label} must be a positive integer`);
    }
    const result = Number(input);
    if (!Number.isSafeInteger(result) || result < 1 || result > maximum)
      throw new Error(`${label} is out of range`);
    return result;
  };
  const apiKey = value("PURPLETOAD_API_KEY", "apiKey", "");
  if (typeof apiKey !== "string" || !/^pt_(live|test)_\S+$/.test(apiKey)) {
    throw new Error(
      "A PurpleToad API key starting with pt_live_ or pt_test_ is required",
    );
  }
  const baseUrl = value(
    "PURPLETOAD_BASE_URL",
    "baseUrl",
    "https://api.purpletoadmail.com",
  );
  if (typeof baseUrl !== "string")
    throw new Error("PURPLETOAD_BASE_URL must be a URL");
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("PURPLETOAD_BASE_URL must be a valid URL");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "PURPLETOAD_BASE_URL must use HTTPS (HTTP is allowed only for loopback development), without credentials, query, or fragment",
    );
  }
  const transport = value("PURPLETOAD_TRANSPORT", "transport", "stdio");
  if (transport !== "stdio" && transport !== "sse")
    throw new Error("PURPLETOAD_TRANSPORT must be stdio or sse");
  const defaultFrom = value("PURPLETOAD_DEFAULT_FROM", "defaultFrom");
  if (
    defaultFrom !== undefined &&
    (typeof defaultFrom !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(defaultFrom))
  ) {
    throw new Error("PURPLETOAD_DEFAULT_FROM must be an email address");
  }
  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    transport,
    timeout: integer(
      value("PURPLETOAD_TIMEOUT", "timeout", 30),
      "PURPLETOAD_TIMEOUT",
      2_147_483,
    ),
    port: integer(
      value("PURPLETOAD_PORT", "port", 3001),
      "PURPLETOAD_PORT",
      65535,
    ),
    defaultFrom: defaultFrom as string | undefined,
  };
}

function loadConfig(): Config {
  const path = join(homedir(), ".purpletoad", "config.json");
  let file: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("not an object");
      file = parsed as Record<string, unknown>;
    } catch {
      // Do not include the parser's message: it may contain credential-bearing file contents.
      throw new Error(
        "Cannot read ~/.purpletoad/config.json: expected a valid JSON object",
      );
    }
  }
  return resolveConfig(process.env, file);
}

export const config = loadConfig();
