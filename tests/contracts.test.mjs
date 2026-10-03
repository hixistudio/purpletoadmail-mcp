import test from "node:test";
import assert from "node:assert/strict";
process.env.PURPLETOAD_API_KEY = "pt_test_local_fixture";
const { client, PurpleToadClient } = await import("../dist/client.js");
const { tools } = await import("../dist/tools/index.js");
const { resolveConfig, config } = await import("../dist/config.js");
const savedFetch = globalThis.fetch;
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers });
const fixture = {
  from: "agent@example.com",
  to: ["user@example.com"],
  subject: "Test",
  text: "Test",
};
const originals = Object.fromEntries(
  ["getMessage", "sendEmail", "findResource", "listMessages"].map((k) => [
    k,
    client[k],
  ]),
);
test.afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const [key, value] of Object.entries(originals)) client[key] = value;
});

// CHECKPOINT: PRD-06 FR-6.1.3 Configuration precedence and validation regression coverage.
test("file settings apply; explicit environment settings win", () => {
  const file = {
    apiKey: process.env.PURPLETOAD_API_KEY,
    baseUrl: "https://example.com",
    timeout: 77,
    transport: "sse",
    port: 4567,
  };
  assert.deepEqual(resolveConfig({}, file), {
    ...file,
    defaultFrom: undefined,
  });
  const config = resolveConfig(
    { PURPLETOAD_TIMEOUT: "12", PURPLETOAD_TRANSPORT: "stdio" },
    file,
  );
  assert.equal(config.timeout, 12);
  assert.equal(config.transport, "stdio");
});
for (const field of ["PURPLETOAD_TIMEOUT", "PURPLETOAD_PORT"]) {
  for (const invalid of ["12abc", "1.5", "-1", "0", ""])
    test(`reject ${field}=${JSON.stringify(invalid)}`, () => {
      assert.throws(() =>
        resolveConfig({
          PURPLETOAD_API_KEY: process.env.PURPLETOAD_API_KEY,
          [field]: invalid,
        }),
      );
    });
}
test("reject insecure API URL and credentials in URL", () => {
  for (const baseUrl of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com?key=x",
  ])
    assert.throws(() =>
      resolveConfig({}, { apiKey: process.env.PURPLETOAD_API_KEY, baseUrl }),
    );
  assert.equal(
    resolveConfig(
      {},
      {
        apiKey: process.env.PURPLETOAD_API_KEY,
        baseUrl: "http://127.0.0.1:4567",
      },
    ).baseUrl,
    "http://127.0.0.1:4567",
  );
});
// CHECKPOINT: PRD-04 FR-4.3.1 Scheduling sends scheduled_at without changing the MCP send_at contract.
test("schedule maps send_at to scheduled_at", async () => {
  let payload;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return json({
      message_id: "scheduled",
      status: "scheduled",
      scheduled_at: payload.scheduled_at,
    });
  };
  const send_at = new Date(Date.now() + 86400000).toISOString();
  const result = await tools.schedule_email.handler({ ...fixture, send_at });
  assert.equal(result.success, true);
  assert.equal(payload.scheduled_at, send_at);
  assert.equal(payload.send_at, undefined);
});
// CHECKPOINT: PRD-06 FR-6.2.6 Reply fields and receiving-mailbox selection.
test("reply uses receiving mailbox and appends reference chain", async () => {
  client.getMessage = async () => ({
    success: true,
    data: {
      mailbox: "actual@example.com",
      from: { email: "sender@example.com" },
      to: [{ email: "other@example.com" }],
      subject: "Hello",
      message_id_header: "<new@example.com>",
      headers: { References: "<old@example.com>" },
      thread_id: "thread",
    },
  });
  let payload;
  client.sendEmail = async (p) => {
    payload = p;
    return { success: true, data: { message_id: "reply", status: "queued" } };
  };
  const result = await tools.reply_to_message.handler({
    original_message_id: "original",
    text: "Hello",
  });
  assert.equal(result.success, true);
  assert.equal(payload.from_email, "actual@example.com");
  assert.equal(payload.headers, undefined);
  assert.equal(payload.in_reply_to, "<new@example.com>");
  assert.deepEqual(payload.references, [
    "<old@example.com>",
    "<new@example.com>",
  ]);
});
// CHECKPOINT: PRD-06 FR-6.2.8 Never report failed counts as zero.
test("mailbox status reads pagination and email_date", async () => {
  client.findResource = async () => ({
    success: true,
    data: { quota_mb: 100, quota_used_mb: 5 },
  });
  client.listMessages = async (p) => ({
    success: true,
    data: {
      pagination: { total: p.unread_only ? 7 : 42 },
      messages: p.unread_only ? [] : [{ email_date: "2026-10-01T10:00:00Z" }],
    },
  });
  const result = await tools.get_mailbox_status.handler({
    mailbox: "actual@example.com",
  });
  assert.equal(result.total_messages, 42);
  assert.equal(result.unread_count, 7);
  assert.equal(result.last_received_at, "2026-10-01T10:00:00Z");
  assert.equal(result.quota_percent, 5);
});
test("mailbox count failure is an incomplete result with null count", async () => {
  client.findResource = async () => ({
    success: true,
    data: { quota_mb: 100, quota_used_mb: 5 },
  });
  client.listMessages = async () => ({
    success: false,
    error: { code: "TIMEOUT", message: "Timeout" },
  });
  const result = await tools.get_mailbox_status.handler({
    mailbox: "actual@example.com",
  });
  assert.equal(result.success, false);
  assert.equal(result.error, "STATUS_INCOMPLETE");
  assert.equal(result.total_messages, null);
});
test("domain/mailbox lookup finds resources beyond page one", async () => {
  const pages = [];
  globalThis.fetch = async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    pages.push(page);
    return json({
      mailboxes: page === 2 ? [{ email: "found@example.com", id: "id" }] : [],
      pagination: { total_pages: 2 },
    });
  };
  assert.equal(
    (await client.findResource("mailboxes", "email", "found@example.com")).data
      .id,
    "id",
  );
  assert.deepEqual(pages, [1, 2]);
});
for (const [name, key] of [
  ["list_domains", "domains"],
  ["list_mailboxes", "mailboxes"],
  ["list_aliases", "aliases"],
])
  test(`${name} preserves total and paging`, async () => {
    let request;
    globalThis.fetch = async (url) => {
      request = new URL(url);
      return json({
        [key]: [{ id: "one" }],
        pagination: { total: 55, page: 2, per_page: 10, total_pages: 6 },
      });
    };
    const result = await tools[name].handler({ page: 2, per_page: 10 });
    assert.equal(result.total, 55);
    assert.equal(result.page, 2);
    assert.equal(result.total_pages, 6);
    assert.equal(request.searchParams.get("page"), "2");
  });
test("inbox pagination and unread filters remain aligned", async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(new URL(url));
    return json({
      messages: [],
      pagination: { total: 0, page: 2, per_page: 10, total_pages: 0 },
    });
  };
  const result = await tools.list_messages.handler({
    page: 2,
    per_page: 10,
    since: "2026-10-01T00:00:00Z",
  });
  assert.equal(result.page, 2);
  assert.equal(result.total, 0);
  assert.equal(requests[0].searchParams.get("page"), "2");
  assert.equal(
    requests[1].searchParams.get("date_from"),
    "2026-10-01T00:00:00Z",
  );
});
// CHECKPOINT: PRD-06 FR-6.3.1 / FR-6.4.2 Error normalization, safe diagnostics, rate-limit context.
test("422 errors expose readable fields and omit rejected input", async () => {
  globalThis.fetch = async () =>
    json(
      {
        detail: [
          {
            loc: ["body", "scheduled_at"],
            msg: "Field required",
            type: "missing",
            input: { password: "secret" },
          },
        ],
      },
      422,
    );
  const result = await client.request("POST", "/test");
  assert.match(result.error.message, /body.scheduled_at: Field required/);
  assert.equal(result.error.http_status, 422);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});
test("retry-after survives API client and tool adapter", async () => {
  globalThis.fetch = async () =>
    json({ detail: { code: "RATE_LIMIT_EXCEEDED", message: "Wait" } }, 429, {
      "Retry-After": "15",
      "X-RateLimit-Remaining": "0",
    });
  const result = await tools.get_account.handler({});
  assert.equal(result.retry_after, "15");
  assert.equal(result.http_status, 429);
  assert.equal(result.details.headers["x-ratelimit-remaining"], "0");
});
test("send-only key validates only on explicit authenticated scope response", async () => {
  globalThis.fetch = async () =>
    json(
      {
        detail: {
          code: "INSUFFICIENT_SCOPE",
          message: "read required",
          your_scopes: ["send"],
          required_scopes: ["read"],
        },
      },
      403,
    );
  assert.equal((await client.validateKey()).success, true);
  for (const status of [401, 403]) {
    globalThis.fetch = async () => json({ detail: "Forbidden" }, status);
    assert.equal((await client.validateKey()).success, false);
  }
});
test("non-JSON success is not falsely accepted", async () => {
  globalThis.fetch = async () => new Response("<html>proxy error</html>");
  assert.equal(
    (await client.request("GET", "/test")).error.code,
    "INVALID_RESPONSE",
  );
});
test("catalog contains output schemas and accurate annotations", () => {
  assert.equal(Object.keys(tools).length, 22);
  for (const tool of Object.values(tools)) {
    assert.ok(tool.outputSchema);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.match(tool.description, /Required API key scope/);
  }
  assert.equal(tools.send_email.annotations.idempotentHint, false);
  assert.equal(tools.get_account.annotations.readOnlyHint, true);
});
for (const [name, args] of [
  ["get_message", { message_id: 123 }],
  ["list_messages", { page: -1 }],
  ["list_messages", { limit: 1.5 }],
  ["list_messages", { per_page: 101 }],
  ["send_email", { ...fixture, text: undefined }],
  ["send_email", { ...fixture, cc: "bad" }],
  [
    "send_email",
    {
      ...fixture,
      attachments: [
        { filename: "x", content: "%%%bad", content_type: "text/plain" },
      ],
    },
  ],
  [
    "reply_to_message",
    { original_message_id: "x", text: "Test", bcc: ["bad"] },
  ],
  ["mark_read", { message_ids: ["x", "x"] }],
  ["set_webhook", { url: "http://example.com", events: ["inbound_email"] }],
  ["schedule_email", { ...fixture, send_at: "2000-01-01T00:00:00Z" }],
  ["get_account", { unexpected: true }],
])
  test(`invalid ${name} arguments do not call API: ${JSON.stringify(args)}`, async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return json({});
    };
    // Simulate JSON wire serialization, which omits undefined properties.
    const result = await tools[name].handler(JSON.parse(JSON.stringify(args)));
    assert.equal(result.error, "INVALID_ARGUMENT");
    assert.equal(calls, 0);
  });

test("request timeout remains active while response body is read", async () => {
  const timeout = config.timeout;
  config.timeout = 0.02;
  const instance = new PurpleToadClient();
  config.timeout = timeout;
  globalThis.fetch = async (_url, options) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: () =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      ),
  });
  const result = await instance.request("GET", "/test");
  assert.equal(result.error.code, "TIMEOUT");
  assert.match(result.error.message, /0.02s/);
});
test("credential-bearing requests refuse redirects", async () => {
  let redirect;
  globalThis.fetch = async (_url, options) => {
    redirect = options.redirect;
    return json({ id: "test" });
  };
  await client.request("GET", "/test");
  assert.equal(redirect, "error");
});
