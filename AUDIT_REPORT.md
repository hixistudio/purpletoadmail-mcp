# PurpleToad MCP — Production Readiness Audit

**Date:** 2026-06-08
**Auditor:** Code Review Agent
**Scope:** Full source code review of `purpletoad-mcp`
**Goal:** Security, MCP spec compliance, developer experience (DX), production readiness

---

## Executive Summary

The `purpletoad-mcp` project is a **well-structured, functional MCP server** with excellent documentation and generally clean code. However, **several security vulnerabilities and missing capabilities prevent it from being production-ready** for use by other developers. This audit identifies **2 critical security issues**, **1 high-severity stability risk**, **6 missing tool definitions** (API methods exist but are not exposed), and several code-quality issues.

**Verdict: NOT production-ready without fixes.** Estimated fix time: 2–3 hours.

---

## Critical Issues (Must Fix Before Production)

### 🔴 C1 — SSE Endpoint Has Zero Authentication
**File:** `src/server.ts` (line 77)
**Severity:** Critical
**Impact:** Anyone who can reach the SSE port can connect, call tools, and access/modify the user's PurpleToad account data.

```typescript
// VULNERABLE: No auth check on SSE endpoint
server.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});
```

When using SSE transport, the MCP server exposes an HTTP endpoint. Unlike stdio (where the OS process boundary provides authentication), SSE is a network service. **There is no Bearer token validation, no API key check, no session validation** on the SSE connection. An attacker scanning ports could discover and abuse this endpoint.

**Fix:** Add middleware to validate `Authorization: Bearer <token>` against `config.apiKey` before establishing the SSE transport.

---

### 🔴 C2 — Unsafe Access to Private SDK Field (`_sessionId`)
**File:** `src/server.ts` (line 111)
**Severity:** Critical
**Impact:** Will crash or break with any future `@modelcontextprotocol/sdk` update. Private fields (underscore-prefixed) are not part of the public API contract.

```typescript
const sessionId = (transport as unknown as { _sessionId: string })._sessionId;
```

This is used to store SSE transports in a `Map` for `/messages` endpoint routing. If the SDK renames, removes, or changes `_sessionId`, the server will either crash at startup or silently fail to route messages.

**Fix:** Use `Map<ServerTransport, SSEServerTransport>` keyed by the transport object itself, or use a WeakMap, or generate a UUID on transport creation. Do not access private SDK fields.

---

### 🟠 H1 — No Graceful Shutdown Handling
**File:** `src/server.ts`
**Severity:** High
**Impact:** Process termination (e.g., during deployment, pod restart, SIGTERM) will abruptly drop in-flight requests, potentially leaving API calls in an inconsistent state.

**Fix:** Add `SIGTERM`/`SIGINT` handlers that call `server.close()` (or equivalent transport cleanup) before exiting. For stdio, this is less critical; for SSE, it is essential.

---

### 🟠 H2 — Tool Registration Crash on Single Failure
**File:** `src/tools/index.ts` (lines 22–25)
**Severity:** High
**Impact:** If one tool fails to import (e.g., a future typo or file corruption), the entire MCP server fails to start and the error is only visible in stderr — not returned to the client.

```typescript
Object.entries(tools).forEach(([name, tool]) => {
  if (!tool || !tool.handler) {
    console.error(`Tool ${name} is missing a handler`);
    return;
  }
  // If tool is malformed, server still starts with partial tools
  // — but if this loop throws, the server is in an undefined state
});
```

**Fix:** Validate all tools at startup and throw a hard error if any tool is invalid. Do not silently skip. Or better: use TypeScript's compile-time checks (ensure `tools` array is `ToolDefinition[]`).

---

## Security Issues

### 🟡 S1 — Health Check Uses Inappropriate Endpoint
**File:** `src/client.ts` (line 277)
**Severity:** Medium
**Impact:** API key validation performs a `GET /api/v1/inbound/messages?per_page=0`. This is a data endpoint, not a health endpoint. It adds load to the message database and may fail for reasons unrelated to key validity (e.g., DB connectivity issues), producing misleading error messages.

**Fix:** Use a dedicated lightweight endpoint like `GET /api/v1/health` or `GET /api/v1/account/me` for key validation.

---

### 🟡 S2 — No Input Sanitization on Email Fields
**File:** Multiple tool files (`send-email.ts`, `schedule-email.ts`, etc.)
**Severity:** Medium
**Impact:** Email addresses, subject lines, and body content are passed directly to the API without validation or sanitization. Malformed input could cause API-side injection issues (depending on how the API handles input) or confusing error responses.

**Fix:** Add basic email format validation (RFC 5322 subset regex) and length limits on subject/body fields before sending to the API. Reject clearly invalid input at the MCP layer.

---

### 🟡 S3 — No Rate Limiting / Request Throttling
**File:** `src/server.ts`, `src/client.ts`
**Severity:** Medium
**Impact:** A malicious or buggy client could rapidly call tools (e.g., `send_email` in a loop), exhausting API quotas or causing abuse. The MCP server has no per-client rate limiting.

**Fix:** Add a simple in-memory rate limiter (e.g., 100 requests/minute per connection) or document that rate limiting must be handled by the upstream API.

---

### 🟡 S4 — `fetch()` Missing User-Agent Header
**File:** `src/client.ts` (line 93)
**Severity:** Low
**Impact:** API requests do not identify themselves as coming from the PurpleToad MCP client. This makes debugging harder on the server side and violates HTTP best practices.

**Fix:** Add `User-Agent: purpletoad-mcp/1.1.0` to all `fetch()` calls.

---

## Missing Tool Definitions (API Methods Exist But Not Exposed)

These methods exist in `client.ts` but have **no corresponding tool definition**. Developers cannot access these capabilities through the MCP interface.

| API Method | Missing Tool | Priority |
|---|---|---|
| `archiveMessage()` | `archive_message` | Medium |
| `deleteDomain()` | `delete_domain` | High |
| `deleteMailbox()` | `delete_mailbox` | High |
| `restoreDomain()` | `restore_domain` | Medium |
| `restoreMailbox()` | `restore_mailbox` | Medium |
| `updateMailboxPassword()` | `update_mailbox_password` | High |

**Note:** The README mentions `update_mailbox_password` but it is **not implemented anywhere** in the codebase. This is a documentation bug.

---

## Code Quality Issues

### Q1 — Potential Double Error Response
**File:** `src/client.ts` (line 99)
```typescript
const apiResponseBody = await response.json();  // If this throws...
if (!apiResponseBody.ok) { ... }                 // ...this is never reached
```

If the API returns non-JSON (e.g., HTML error page from a proxy), `response.json()` throws an unhandled exception. The tool handler does catch this, but the error message will be generic (`fetch failed`) instead of informative.

**Fix:** Wrap `response.json()` in a try/catch and return a meaningful error like "API returned non-JSON response (status: X)".

---

### Q2 — Typo in Field Name (`body_prev`)
**File:** `src/client.ts` (line 248)
```typescript
body_prev: data.body_preview,  // Should be body_preview
```

This typo means the `body_preview` field is silently dropped from outbound message results.

---

### Q3 — `@types/express` in `dependencies` Instead of `devDependencies`
**File:** `package.json`

Type definitions should be in `devDependencies`. This bloats the production install for a library package.

---

### Q4 — `strict: true` is Good, but `noImplicitReturns` is Missing
**File:** `tsconfig.json`

Not all functions have explicit return paths for every branch. TypeScript catches most of this, but enabling `noImplicitReturns` would improve robustness.

---

## Standards & Best Practices

### ✅ Good Practices Found

1. **Excellent README** — Comprehensive setup guide, clear examples, troubleshooting section, good project structure explanation.
2. **Error handling follows MCP spec** — Uses `isError: true` and returns JSON content arrays with `type: "text"`.
3. **Structured error responses** — All tools return `{ success, error, message, suggestion }` format, which is very developer-friendly.
4. **Input validation** — Required fields are checked before API calls.
5. **Config flexibility** — Supports both environment variables and `~/.purpletoad/config.json`.
6. **Tool descriptions include examples** — Helps LLMs understand how to use each tool.
7. **AbortController timeout** — All HTTP requests have configurable timeouts.
8. **Consistent naming** — Tool names use `snake_case`, matching MCP conventions.

---

## Recommendations Summary

| Priority | Issue | Effort |
|---|---|---|
| **P0** | Add SSE authentication (C1) | 30 min |
| **P0** | Fix `_sessionId` private field access (C2) | 30 min |
| **P1** | Add graceful shutdown | 20 min |
| **P1** | Fix tool registration validation | 15 min |
| **P1** | Add missing tools (delete_domain, delete_mailbox, update_mailbox_password, etc.) | 60 min |
| **P2** | Fix health check endpoint | 10 min |
| **P2** | Add email input validation | 30 min |
| **P2** | Fix `body_prev` typo | 5 min |
| **P2** | Add `User-Agent` header | 10 min |
| **P3** | Move `@types/express` to devDependencies | 5 min |

**Total estimated fix time: ~3 hours.**

---

## Conclusion

The `purpletoad-mcp` project shows **strong fundamentals** — good architecture, excellent documentation, and proper MCP spec compliance for the tools that *are* implemented. However, the **two critical security issues (unauthenticated SSE, private SDK field access)** and **six missing tool definitions** are blockers for production use by external developers. Once these are resolved, the project will be solid and ready for public use.
