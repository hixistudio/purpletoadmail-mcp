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
        const errObj = (err.error || {}) as Record<string, unknown>;
        return {
          success: false,
          error: {
            code: (errObj.code as string) || `HTTP_${response.status}`,
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

  // CHECKPOINT: PRD-06 FR-6.2.1 — Domain APIs
  async createDomain(domain: string) {
    return this.request("POST", "/api/v1/domains", { name: domain });
  }

  async listDomains() {
    return this.request("GET", "/api/v1/domains");
  }

  // CHECKPOINT: PRD-06 FR-6.2.2 — Mailbox APIs
  async createMailbox(params: {
    domain_id: string;
    local_part: string;
    display_name?: string;
    password?: string;
    quota_mb?: number;
  }) {
    return this.request("POST", "/api/v1/mailboxes", params);
  }

  async listMailboxes() {
    return this.request("GET", "/api/v1/mailboxes");
  }

  // CHECKPOINT: PRD-06 FR-6.2.3/6.2.4 — Message APIs
  async listMessages(params?: {
    mailbox?: string;
    unread_only?: boolean;
    from?: string;
    since?: string;
    limit?: number;
    thread_id?: string;
  }) {
    const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined);
    const qs = entries.length ? "?" + new URLSearchParams(entries as [string, string][]).toString() : "";
    return this.request("GET", `/api/v1/inbound/messages${qs}`);
  }

  async getMessage(messageId: string) {
    return this.request("GET", `/api/v1/inbound/messages/${messageId}`);
  }

  async markRead(messageIds: string[]) {
    return this.request("PATCH", "/api/v1/inbound/messages/read", { message_ids: messageIds });
  }

  // CHECKPOINT: PRD-06 FR-6.2.5/6.2.6 — Send / Reply APIs
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

  // CHECKPOINT: PRD-06 FR-6.2.8 — Mailbox status
  async getMailboxStatus(mailbox: string) {
    return this.request("GET", `/api/v1/mailboxes/status?mailbox=${encodeURIComponent(mailbox)}`);
  }

  // CHECKPOINT: PRD-06 FR-6.2.9 — Webhook APIs
  async setWebhook(url: string, events: string[]) {
    return this.request("POST", "/api/v1/webhooks", { url, events });
  }

  async listWebhooks() {
    return this.request("GET", "/api/v1/webhooks");
  }

  // CHECKPOINT: PRD-06 FR-6.1.4 — Validate API key on startup
  async validateKey() {
    return this.request("GET", "/api/v1/account/me");
  }
}

export const client = new PurpleToadClient();
