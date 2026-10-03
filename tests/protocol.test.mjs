// CHECKPOINT: PRD-06 FR-6.1.2 / FR-6.1.5 stdio and legacy SSE client compatibility.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { fileURLToPath } from "node:url";
const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const key = "pt_test_protocol_fixture";
async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}
async function mockApi() {
  const api = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: "fixture",
        email: "fixture@example.com",
        usage: {},
      }),
    );
  });
  const port = await listen(api);
  return {
    api,
    env: {
      ...process.env,
      PURPLETOAD_API_KEY: key,
      PURPLETOAD_BASE_URL: `http://127.0.0.1:${port}`,
      PURPLETOAD_TRANSPORT: "stdio",
    },
  };
}
function newClient() {
  return new Client({ name: "regression-test", version: "1.0.0" });
}
async function check(client) {
  const catalog = await client.listTools();
  assert.equal(catalog.tools.length, 22);
  assert.ok(catalog.tools.every((t) => t.outputSchema && t.annotations));
  const result = await client.callTool({ name: "get_account", arguments: {} });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.id, "fixture");
  assert.deepEqual(
    JSON.parse(result.content[0].text),
    result.structuredContent,
  );
  const invalid = await client.callTool({
    name: "send_email",
    arguments: { to: ["bad"] },
  });
  assert.equal(invalid.isError, true);
  assert.equal(invalid.structuredContent.error, "INVALID_ARGUMENT");
  const unknown = await client.callTool({ name: "toString", arguments: {} });
  assert.equal(unknown.isError, true);
  assert.equal(unknown.structuredContent.error, "TOOL_NOT_FOUND");
}
test(
  "stdio initialize, list, call, argument rejection, and unknown-tool errors",
  { timeout: 10000 },
  async () => {
    const { api, env } = await mockApi();
    const client = newClient();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env,
      stderr: "pipe",
    });
    try {
      await client.connect(transport);
      await check(client);
    } finally {
      await client.close();
      api.closeAllConnections();
      await new Promise((r) => api.close(r));
    }
  },
);
test(
  "SSE sessions initialize independently; both legs require auth and valid host/origin",
  { timeout: 15000 },
  async () => {
    const { api, env } = await mockApi();
    const holder = createServer();
    const port = await listen(holder);
    await new Promise((r) => holder.close(r));
    const child = spawn(process.execPath, [entry], {
      env: {
        ...env,
        PURPLETOAD_TRANSPORT: "sse",
        PURPLETOAD_PORT: String(port),
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const clients = [];
    try {
      await new Promise((resolve, reject) => {
        let output = "";
        const timer = setTimeout(
          () => reject(Error("SSE did not start")),
          5000,
        );
        child.stderr.on("data", (chunk) => {
          output += String(chunk);
          if (output.includes("legacy SSE listening")) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(Error(`SSE exited: ${code}`));
        });
      });
      const base = `http://127.0.0.1:${port}`;
      assert.equal((await fetch(base + "/sse")).status, 401);
      assert.equal(
        (await fetch(base + "/message?sessionId=fake", { method: "POST" }))
          .status,
        401,
      );
      assert.equal(
        (
          await fetch(base + "/sse", {
            headers: {
              Authorization: `Bearer ${key}`,
              Origin: "https://untrusted.example",
            },
          })
        ).status,
        403,
      );
      assert.equal(
        await new Promise((resolve, reject) => {
          const request = httpRequest(
            base + "/sse",
            {
              headers: {
                Authorization: `Bearer ${key}`,
                Host: "untrusted.example",
              },
            },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          );
          request.on("error", reject);
          request.end();
        }),
        403,
      );
      assert.equal(
        (
          await fetch(base + "/message?sessionId=fake", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
          })
        ).status,
        404,
      );
      for (let i = 0; i < 2; i++) {
        const client = newClient();
        clients.push(client);
        const authenticatedFetch = (url, options) => {
          const headers = new Headers(options?.headers);
          headers.set("Authorization", `Bearer ${key}`);
          return fetch(url, { ...options, headers });
        };
        await client.connect(
          new SSEClientTransport(new URL(base + "/sse"), {
            eventSourceInit: { fetch: authenticatedFetch },
            requestInit: { headers: { Authorization: `Bearer ${key}` } },
          }),
        );
      }
      await Promise.all(clients.map(check));
      await clients[0].close();
      await check(clients[1]);
    } finally {
      await Promise.allSettled(clients.map((c) => c.close()));
      child.kill("SIGTERM");
      if (child.exitCode === null) await once(child, "exit");
      api.closeAllConnections();
      await new Promise((r) => api.close(r));
    }
  },
);
