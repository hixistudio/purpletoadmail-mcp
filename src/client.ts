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
          "X-API-Key": this.apiKey,
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
    const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined);
    const qs = entries.length ? "?" + new URLSearchParams(entries as [string, string][]).toString() : "";
    return this.request("GET", `/api/v1/inbound/messages${qs}`);
  }

  async getMessage(messageId: string) {
    return this.request("GET", `/api/v1/inbound/messages/${encodeURIComponent(messageId)}`);
  }

  async markRead(messageIds: string[]) {
    return this.request("PATCH", "/api/v1/inbound/messages/read", { message_ids: messageIds });
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
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text?: string;
    html?: string;
    thread_id?: string;
  }) {
    return this.request("POST", "/api/v1/outbound/send", params);
  }

  async replyToMessage(originalMessageId: string, text: string, html?: string) {
    return this.request("POST", "/api/v1/outbound/send/reply", {
      original_message_id: originalMessageId,
      text,
      html,
    });
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
    from: string;
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

  // ─── Mailbox Status ───────────────────────────────────────────────────────

  async getMailboxStatus(mailbox: string) {
    return this.request("GET", `/api/v1/mailboxes/status?mailbox=${encodeURIComponent(mailbox)}`);
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  async listWebhooks() {
    return this.request("GET", "/api/v1/webhooks");
  }

  async getWebhook(webhookId: string) {
    return this.request("GET", `/api/v1/webhooks/${encodeURIComponent(webhookId)}`);
  }

  async createWebhook(url: string, events: string[]) {
    return this.request("POST", "/api/v1/webhooks", { url, events });
  }

  async updateWebhook(webhookId: string, params: { url?: string; events?: string[]; active?: boolean }) {
    return this.request("PUT", `/api/v1/webhooks/${encodeURIComponent(webhookId)}`, params);
  }

  async deleteWebhook(webhookId: string) {
    return this.request("DELETE", `/api/v1/webhooks/${encodeURIComponent(webhookId)}`);
  }

  async testWebhook(webhookId: string) {
    return this.request("POST", `/api/v1/webhooks/${encodeURIComponent(webhookId)}/test`);
  }

  async getWebhookDeliveries(webhookId: string, limit?: number) {
    const qs = limit ? `?limit=${limit}` : "";
    return this.request("GET", `/api/v1/webhooks/${encodeURIComponent(webhookId)}/deliveries${qs}`);
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  async listApiKeys() {
    return this.request("GET", "/api/v1/api-keys");
  }

  async createApiKey(params: {
    name: string;
    scopes?: string[];
    restricted_domains?: string[];
    allowed_ips?: string[];
    rate_limit_daily?: number;
  }) {
    return this.request("POST", "/api/v1/api-keys", params);
  }

  async revokeApiKey(keyId: string, reason?: string) {
    return this.request("DELETE", `/api/v1/api-keys/${encodeURIComponent(keyId)}`, reason ? { reason } : undefined);
  }

  async updateApiKey(
    keyId: string,
    params: {
      scopes?: string[];
      restricted_domains?: string[];
      allowed_ips?: string[];
      rate_limit_daily?: number;
      name?: string;
    }
  ) {
    return this.request("PUT", `/api/v1/api-keys/${encodeURIComponent(keyId)}`, params);
  }

  async getApiKeyUsage(keyId: string) {
    return this.request("GET", `/api/v1/api-keys/${encodeURIComponent(keyId)}/usage`);
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

  // ─── Deliverability ───────────────────────────────────────────────────────

  async getDeliverability() {
    return this.request("GET", "/api/v1/deliverability");
  }

  async getDomainDeliverability(domainId: string) {
    return this.request("GET", `/api/v1/deliverability/domains/${encodeURIComponent(domainId)}`);
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  async validateKey() {
    return this.request("GET", "/api/v1/account/me");
  }
}

export const client = new PurpleToadClient();
