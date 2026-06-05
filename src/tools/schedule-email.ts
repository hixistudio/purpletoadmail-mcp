import { client } from "../client.js";
import { config } from "../config.js";

export const scheduleEmailTool = {
  name: "schedule_email",
  description: `Schedule an email to be sent at a future time. The scheduled email can be cancelled until shortly before delivery.

Example: schedule_email(from="agent@mycompany.com", to=["john@example.com"], subject="Reminder", text="Meeting at 3pm", send_at="2026-06-05T15:00:00Z")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      from: {
        type: "string",
        description: "Sender email address (must be a PurpleToad mailbox). Uses PURPLETOAD_DEFAULT_FROM if omitted.",
      },
      to: {
        type: "array",
        items: { type: "string" },
        description: "Recipient email addresses",
      },
      cc: {
        type: "array",
        items: { type: "string" },
        description: "CC recipients (optional)",
        default: [],
      },
      bcc: {
        type: "array",
        items: { type: "string" },
        description: "BCC recipients (optional)",
        default: [],
      },
      subject: {
        type: "string",
        description: "Email subject line",
      },
      text: {
        type: "string",
        description: "Plain text body",
      },
      html: {
        type: "string",
        description: "HTML body (optional)",
      },
      send_at: {
        type: "string",
        description: "ISO 8601 timestamp when to send the email",
      },
    },
    required: ["to", "subject", "send_at"],
  },

  async handler(args: Record<string, unknown>) {
    const from = (args.from as string) || config.defaultFrom;
    if (!from) {
      return {
        success: false,
        error: "NO_DEFAULT_FROM",
        message: "No 'from' address provided and no PURPLETOAD_DEFAULT_FROM configured.",
        suggestion: "Set default_from in ~/.purpletoad/config.json or provide from in each call.",
      };
    }

    const to = args.to as string[];
    if (!Array.isArray(to) || to.length === 0) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'to' must be a non-empty array of email addresses.",
      };
    }

    const sendAt = args.send_at as string;
    if (!sendAt) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'send_at' is required.",
      };
    }

    const result = await client.scheduleEmail({
      from_email: from,
      to,
      cc: (args.cc as string[]) || [],
      bcc: (args.bcc as string[]) || [],
      subject: args.subject as string,
      text: args.text as string | undefined,
      html: args.html as string | undefined,
      send_at: sendAt,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "SCHEDULE_FAILED",
        message: result.error?.message || "Failed to schedule email",
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      message_id: data.message_id,
      status: data.status,
      scheduled_at: data.scheduled_at,
      can_cancel_until: data.can_cancel_until,
      from,
      to,
      subject: args.subject,
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    INVALID_FROM: "The 'from' address must be a mailbox you own. Use list_mailboxes to see available addresses.",
    RATE_LIMIT_EXCEEDED: "Daily email limit reached. Wait until tomorrow or upgrade your plan.",
    DOMAIN_NOT_ACTIVE: "The sender domain is not verified. Add DNS records and wait for verification.",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
