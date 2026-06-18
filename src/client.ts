// CHECKPOINT: PRD-06 FR-6.1.1 REST API client used by the MCP server.
// CHECKPOINT: PRD-06 FR-6.3.1 Structured error responses from API are normalized into { success, error, message }.
// CHECKPOINT: PRD-06 FR-6.4.1 Rate limits are enforced by the REST API per API key; the MCP server passes them through.

import { config } from "./config.js";

interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
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

  async request<T>(method: string, path: string, body?: unknown): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "User-Agent": "purpletoad-mcp/1.1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const err = data as Record<string, unknown>;
        const errObj = (err.error || err.detail || {}) as Record<string, unknown>;
        return {
          success: false,
          error: {
            code: (errObj.code as string) || (err.error as string) || `HTTP_${response.status}`,
            message:
              (errObj.message as string) ||
              (err.message as string) ||
              (err.detail as string) ||
              `HTTP ${response.status}`,
            details: errObj.details as Record<string, unknown> | undefined,
          },
        };
      }

      return { success: true, data: data as T };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: { code: "TIMEOUT", message: `Request timed out after ${config.timeout}s` },
        };
      }
      return {
        success: false,
        error: {
          code: "REQUEST_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  // ─── Domains ──────────────────────────────────────────────────────────────

  async createDomain(domain: string) {
    return this.request("POST", "/api/v1/domains", { name: domain });
  }

  async listDomains() {
    return this.request("GET", "/api/v1/domains");
  }

  async getDomain(domainId: string) {
    return this.request("GET", `/api/v1/domains/${encodeURIComponent(domainId)}`);
  }

  async verifyDomainDns(domainId: string) {
    return this.request("POST", `/api/v1/domains/${encodeURIComponent(domainId)}/verify-dns`);
  }

  async deleteDomain(domainId: string) {
    return this.request("DELETE", `/api/v1/domains/${encodeURIComponent(domainId)}`);
  }

  async restoreDomain(domainId: string) {
    return this.request("POST", `/api/v1/domains/${encodeURIComponent(domainId)}/restore`);
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

  async listMailboxes(domainId?: string) {
    const qs = domainId ? `?domain_id=${encodeURIComponent(domainId)}` : "";
    return this.request("GET", `/api/v1/mailboxes${qs}`);
  }

  async getMailbox(mailboxId: string) {
    return this.request("GET", `/api/v1/mailboxes/${encodeURIComponent(mailboxId)}`);
  }

  async deleteMailbox(mailboxId: string) {
    return this.request("DELETE", `/api/v1/mailboxes/${encodeURIComponent(mailboxId)}`);
  }

  async restoreMailbox(mailboxId: string) {
    return this.request("POST", `/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/restore`);
  }

  async updateMailboxPassword(mailboxId: string, newPassword: string) {
    return this.request("PUT", `/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/password`, {
      new_password: newPassword,
    });
  }

  // ─── Aliases ──────────────────────────────────────────────────────────────

  async listAliases(domainId?: string) {
    const qs = domainId ? `?domain_id=${encodeURIComponent(domainId)}` : "";
    return this.request("GET", `/api/v1/aliases${qs}`);
  }

  async createAlias(params: { domain_id: string; source: string; targets: string[]; enabled?: boolean }) {
    return this.request("POST", "/api/v1/aliases", params);
  }

  async deleteAlias(aliasId: string) {
    return this.request("DELETE", `/api/v1/aliases/${encodeURIComponent(aliasId)}`);
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
    if (params?.unread_only !== undefined) mapped.unread = String(params.unread_only);
    if (params?.from) mapped.from_email = params.from;
    if (params?.since) mapped.date_from = params.since;
    if (params?.limit) mapped.per_page = String(Math.min(params.limit, 100));
    if (params?.thread_id) mapped.thread_id = params.thread_id;
    if (params?.page) mapped.page = String(params.page);

    const qs = Object.keys(mapped).length ? "?" + new URLSearchParams(mapped).toString() : "";
    return this.request("GET", `/api/v1/inbound/messages${qs}`);
  }

  async getMessage(messageId: string) {
    return this.request("GET", `/api/v1/inbound/messages/${encodeURIComponent(messageId)}`);
  }

  async markRead(messageId: string) {
    return this.request("PATCH", `/api/v1/inbound/messages/${encodeURIComponent(messageId)}`, {
      read: true,
    });
  }

  async archiveMessage(messageId: string) {
    return this.request("PATCH", `/api/v1/inbound/messages/${encodeURIComponent(messageId)}`, {
      archived: true,
    });
  }

  async searchMessages(query: string, mailbox?: string, page?: number, perPage?: number) {
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
    const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined);
    const qs = entries.length ? "?" + new URLSearchParams(entries as [string, string][]).toString() : "";
    return this.request("GET", `/api/v1/outbound/messages${qs}`);
  }

  async getOutboundMessage(messageId: string) {
    return this.request("GET", `/api/v1/outbound/messages/${encodeURIComponent(messageId)}`);
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
  }) {
    return this.request("POST", "/api/v1/outbound/schedule", params);
  }

  async cancelScheduled(messageId: string) {
    return this.request("DELETE", `/api/v1/outbound/schedule/${encodeURIComponent(messageId)}`);
  }

  // ─── Account ──────────────────────────────────────────────────────────────

  async getAccount() {
    return this.request("GET", "/api/v1/account/me");
  }

  async getDashboard() {
    return this.request("GET", "/api/v1/account/dashboard");
  }

  async getPlan() {
    return this.request("GET", "/api/v1/account/plan");
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  async setWebhook(params: { url: string; events: string[] }) {
    return this.request("POST", "/api/v1/webhooks", params);
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  async validateKey() {
    // Use a lightweight account endpoint for key validation
    return this.request("GET", "/api/v1/account/me");
  }
}

export const client = new PurpleToadClient();
