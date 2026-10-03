// CHECKPOINT: PRD-06 FR-6.1.1 REST API client used by the MCP server.
// CHECKPOINT: PRD-06 FR-6.3.1 Structured error responses from API are normalized into { success, error, message }.
// CHECKPOINT: PRD-06 FR-6.4.1 Rate limits are enforced by the REST API per API key; the MCP server passes them through.

import { createRequire } from "node:module";
import { config } from "./config.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    http_status?: number;
    retry_after?: string;
  };
}

export class PurpleToadClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeout * 1000;
  }

  // CHECKPOINT: PRD-06 FR-6.3.1 / FR-6.4.2 Preserve readable errors and HTTP retry/rate-limit context.
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<APIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": `purpletoadmail-mcp/${version}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        redirect: "error",
      });
      // Timeout covers response headers AND body consumption.
      const text = await response.text();
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          if (response.ok)
            return {
              success: false,
              error: {
                code: "INVALID_RESPONSE",
                message: "API returned a non-JSON response",
                http_status: response.status,
              },
            };
        }
      }
      const record = (v: unknown): Record<string, unknown> =>
        v !== null && typeof v === "object" && !Array.isArray(v)
          ? (v as Record<string, unknown>)
          : {};
      if (!response.ok) {
        const outer = record(data);
        const raw = outer.error ?? outer.detail;
        const error = record(raw);
        const validation = Array.isArray(raw) ? raw : undefined;
        const message =
          typeof error.message === "string"
            ? error.message
            : typeof outer.message === "string"
              ? outer.message
              : typeof raw === "string"
                ? raw
                : validation
                  ? validation
                      .map((item) => {
                        const entry = record(item);
                        const location = Array.isArray(entry.loc)
                          ? entry.loc.join(".")
                          : "request";
                        return `${location}: ${typeof entry.msg === "string" ? entry.msg : "Invalid value"}`;
                      })
                      .join("; ")
                  : `HTTP ${response.status}`;
        const headers: Record<string, string> = {};
        for (const [key, val] of response.headers) {
          if (
            key === "retry-after" ||
            key.startsWith("x-ratelimit-") ||
            key.startsWith("x-emails-")
          )
            headers[key] = val;
        }
        return {
          success: false,
          error: {
            code:
              typeof error.code === "string"
                ? error.code
                : typeof outer.error === "string"
                  ? outer.error
                  : `HTTP_${response.status}`,
            message,
            http_status: response.status,
            retry_after: response.headers.get("retry-after") ?? undefined,
            details: {
              ...record(error.details),
              ...(Array.isArray(error.your_scopes)
                ? { your_scopes: error.your_scopes }
                : {}),
              ...(Array.isArray(error.required_scopes)
                ? { required_scopes: error.required_scopes }
                : {}),
              ...(validation
                ? {
                    validation: validation.map((item) => {
                      const entry = record(item);
                      // FastAPI's input/ctx can contain passwords or message bodies; retain only safe diagnostics.
                      return {
                        loc: entry.loc,
                        msg: entry.msg,
                        type: entry.type,
                      };
                    }),
                  }
                : {}),
              ...(Object.keys(headers).length ? { headers } : {}),
            },
          },
        };
      }
      return { success: true, data: data as T };
    } catch (error) {
      return {
        success: false,
        error: {
          code: controller.signal.aborted ? "TIMEOUT" : "REQUEST_FAILED",
          message: controller.signal.aborted
            ? `Request timed out after ${this.timeoutMs / 1000}s. Check message status before retrying a send or schedule.`
            : "Could not reach the PurpleToad Mail API",
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── Domains ──────────────────────────────────────────────────────────────

  async createDomain(domain: string) {
    return this.request("POST", "/api/v1/domains", { name: domain });
  }

  async listDomains(page = 1, perPage = 20) {
    return this.request(
      "GET",
      `/api/v1/domains?page=${page}&per_page=${perPage}`,
    );
  }

  async getDomain(domainId: string) {
    return this.request(
      "GET",
      `/api/v1/domains/${encodeURIComponent(domainId)}`,
    );
  }

  // ─── Mailboxes ────────────────────────────────────────────────────────────

  async createMailbox(params: {
    domain_id: string;
    local_part: string;
    display_name?: string;
    password?: string;
    quota_mb?: number;
  }) {
    return this.request("POST", "/api/v1/mailboxes", params);
  }

  async listMailboxes(domainId?: string, page = 1, perPage = 20) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (domainId) params.set("domain_id", domainId);
    const qs = `?${params}`;
    return this.request("GET", `/api/v1/mailboxes${qs}`);
  }

  async getMailbox(mailboxId: string) {
    return this.request(
      "GET",
      `/api/v1/mailboxes/${encodeURIComponent(mailboxId)}`,
    );
  }

  // ─── Aliases ──────────────────────────────────────────────────────────────

  async listAliases(domainId?: string, page = 1, perPage = 50) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (domainId) params.set("domain_id", domainId);
    const qs = `?${params}`;
    return this.request("GET", `/api/v1/aliases${qs}`);
  }

  async createAlias(params: {
    domain_id: string;
    source: string;
    targets: string[];
    enabled?: boolean;
  }) {
    return this.request("POST", "/api/v1/aliases", params);
  }

  // ─── Inbound Messages ─────────────────────────────────────────────────────

  async listMessages(params?: {
    mailbox?: string;
    unread_only?: boolean;
    from?: string;
    since?: string;
    limit?: number;
    thread_id?: string;
    page?: number;
  }) {
    const mapped: Record<string, string> = {};
    if (params?.mailbox) mapped.mailbox = params.mailbox;
    if (params?.unread_only !== undefined)
      mapped.unread = String(params.unread_only);
    if (params?.from) mapped.from_email = params.from;
    if (params?.since) mapped.date_from = params.since;
    if (params?.limit) mapped.per_page = String(Math.min(params.limit, 100));
    if (params?.thread_id) mapped.thread_id = params.thread_id;
    if (params?.page) mapped.page = String(params.page);

    const qs = Object.keys(mapped).length
      ? "?" + new URLSearchParams(mapped).toString()
      : "";
    return this.request("GET", `/api/v1/inbound/messages${qs}`);
  }

  async getMessage(messageId: string) {
    return this.request(
      "GET",
      `/api/v1/inbound/messages/${encodeURIComponent(messageId)}`,
    );
  }

  async markRead(messageId: string) {
    return this.request(
      "PATCH",
      `/api/v1/inbound/messages/${encodeURIComponent(messageId)}`,
      {
        read: true,
      },
    );
  }

  async archiveMessage(messageId: string) {
    return this.request(
      "PATCH",
      `/api/v1/inbound/messages/${encodeURIComponent(messageId)}`,
      {
        archived: true,
      },
    );
  }

  async searchMessages(
    query: string,
    mailbox?: string,
    page?: number,
    perPage?: number,
  ) {
    const params = new URLSearchParams({ q: query });
    if (mailbox) params.set("mailbox", mailbox);
    if (page) params.set("page", String(page));
    if (perPage) params.set("per_page", String(perPage));
    return this.request("GET", `/api/v1/inbound/search?${params.toString()}`);
  }

  // ─── Outbound Messages ────────────────────────────────────────────────────

  async sendEmail(params: {
    from_email: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text?: string;
    html?: string;
    thread_id?: string;
    attachments?: Array<{
      filename: string;
      content: string;
      content_type: string;
      disposition?: string;
      content_id?: string;
    }>;
    in_reply_to?: string;
    references?: string[];
    reply_to?: string;
    headers?: Record<string, string>;
  }) {
    return this.request("POST", "/api/v1/outbound/send", params);
  }

  async listOutboundMessages(params?: {
    status?: string;
    domain_id?: string;
    thread_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }) {
    const entries = Object.entries(params || {}).filter(
      ([, v]) => v !== undefined,
    );
    const qs = entries.length
      ? "?" + new URLSearchParams(entries as [string, string][]).toString()
      : "";
    return this.request("GET", `/api/v1/outbound/messages${qs}`);
  }

  async getOutboundMessage(messageId: string) {
    return this.request(
      "GET",
      `/api/v1/outbound/messages/${encodeURIComponent(messageId)}`,
    );
  }

  async scheduleEmail(params: {
    from_email: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text?: string;
    html?: string;
    send_at: string;
    attachments?: Array<{
      filename: string;
      content: string;
      content_type: string;
      disposition?: string;
      content_id?: string;
    }>;
  }) {
    const { send_at, ...message } = params;
    return this.request("POST", "/api/v1/outbound/schedule", {
      ...message,
      scheduled_at: send_at,
    });
  }

  async cancelScheduled(messageId: string) {
    return this.request(
      "DELETE",
      `/api/v1/outbound/schedule/${encodeURIComponent(messageId)}`,
    );
  }

  // ─── Account ──────────────────────────────────────────────────────────────

  async getAccount() {
    return this.request("GET", "/api/v1/account/me");
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  async setWebhook(params: { url: string; events: string[] }) {
    return this.request("POST", "/api/v1/webhooks", params);
  }

  // CHECKPOINT: PRD-06 FR-6.2.2 / FR-6.2.8 Paginated lookup for domains and mailboxes.
  async findResource(
    kind: "domains" | "mailboxes",
    field: string,
    value: string,
  ): Promise<APIResponse<Record<string, unknown>>> {
    // Bound automatic lookup work. Callers can use explicit resource IDs for very large accounts.
    for (let page = 1; page <= 100; page++) {
      const result =
        kind === "domains"
          ? await this.listDomains(page, 100)
          : await this.listMailboxes(undefined, page, 100);
      if (!result.success)
        return result as APIResponse<Record<string, unknown>>;
      const data = result.data as Record<string, unknown>;
      const resources = (data[kind] || []) as Record<string, unknown>[];
      const match = resources.find(
        (item) => String(item[field]).toLowerCase() === value.toLowerCase(),
      );
      if (match) return { success: true, data: match };
      const pagination = (data.pagination || {}) as Record<string, unknown>;
      if (page >= Number(pagination.total_pages ?? 1))
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `${kind === "domains" ? "Domain" : "Mailbox"} not found`,
          },
        };
    }
    return {
      success: false,
      error: {
        code: "LOOKUP_LIMIT_EXCEEDED",
        message:
          "Automatic lookup exceeded 100 pages; use resource IDs or narrow your lookup",
      },
    };
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  async validateKey() {
    // Use a lightweight account endpoint for key validation
    const result = await this.request("GET", "/api/v1/account/me");
    const scopes = result.error?.details?.your_scopes;
    if (
      !result.success &&
      result.error?.http_status === 403 &&
      result.error.code === "INSUFFICIENT_SCOPE" &&
      Array.isArray(scopes) &&
      scopes.includes("send")
    ) {
      return { success: true, data: { limited_scope: true } };
    }
    return result;
  }
}

export const client = new PurpleToadClient();
