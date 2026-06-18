// CHECKPOINT: PRD-06 FR-6.2.5 Tool: send_email — sends an email.

import { client } from "../client.js";
import { config } from "../config.js";
import { validateEmailList, validateSubject } from "../lib/validation.js";

export const sendEmailTool = {
  name: "send_email",
  description: `Send an email from a PurpleToad-managed mailbox. Returns a message ID for tracking delivery status.

Example: send_email(from="agent@mycompany.com", to=["john@example.com"], subject="Hello", text="Hello from my agent!")`,
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
        description: "Email subject line (max 998 chars)",
      },
      text: {
        type: "string",
        description: "Plain text body",
      },
      html: {
        type: "string",
        description: "HTML body (optional, text auto-generated if omitted)",
      },
      thread_id: {
        type: "string",
        description: "Thread ID for conversation grouping (optional)",
      },
      attachments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            filename: { type: "string" },
            content: { type: "string", description: "Base64-encoded file content" },
            content_type: { type: "string" },
            disposition: { type: "string", enum: ["attachment", "inline"], default: "attachment" },
            content_id: { type: "string" },
          },
          required: ["filename", "content", "content_type"],
        },
        description: "Base64-encoded attachments (optional, max 10)",
        default: [],
      },
    },
    required: ["to", "subject"],
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

    const toValidation = validateEmailList(args.to, "to");
    if (!toValidation.valid) {
      return { success: false, error: "INVALID_ARGUMENT", message: toValidation.error };
    }

    const cc = args.cc as string[] | undefined;
    if (cc && cc.length > 0) {
      const ccValidation = validateEmailList(cc, "cc");
      if (!ccValidation.valid) {
        return { success: false, error: "INVALID_ARGUMENT", message: ccValidation.error };
      }
    }

    const bcc = args.bcc as string[] | undefined;
    if (bcc && bcc.length > 0) {
      const bccValidation = validateEmailList(bcc, "bcc");
      if (!bccValidation.valid) {
        return { success: false, error: "INVALID_ARGUMENT", message: bccValidation.error };
      }
    }

    const subjectValidation = validateSubject(args.subject);
    if (!subjectValidation.valid) {
      return { success: false, error: "INVALID_ARGUMENT", message: subjectValidation.error };
    }

    const attachments = (args.attachments as Array<Record<string, unknown>> | undefined) || [];
    if (attachments.length > 10) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "A maximum of 10 attachments is allowed per email.",
      };
    }

    const result = await client.sendEmail({
      from_email: from,
      to: toValidation.emails,
      cc: cc || [],
      bcc: bcc || [],
      subject: subjectValidation.subject,
      text: args.text as string | undefined,
      html: args.html as string | undefined,
      thread_id: args.thread_id as string | undefined,
      attachments: attachments.map((a) => ({
        filename: String(a.filename),
        content: String(a.content),
        content_type: String(a.content_type),
        disposition: (a.disposition as string) || "attachment",
        content_id: a.content_id as string | undefined,
      })),
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "SEND_FAILED",
        message: result.error?.message || "Failed to send email",
        details: result.error?.details,
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    const rateLimit = (data.rate_limit || {}) as Record<string, unknown>;
    return {
      success: true,
      message_id: data.message_id || data.id,
      status: data.status,
      estimated_delivery: data.estimated_delivery,
      from,
      to: toValidation.emails,
      subject: args.subject,
      thread_id: args.thread_id || null,
      rate_limit: {
        remaining_today: rateLimit.remaining_today,
        limit: rateLimit.limit,
        resets_at: rateLimit.resets_at,
      },
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    INVALID_FROM: "The 'from' address must be a mailbox you own. Use list_mailboxes to see available addresses.",
    RATE_LIMIT_EXCEEDED: "Daily email limit reached. Wait until tomorrow or upgrade your plan.",
    SUPPRESSED_ADDRESS: "The recipient address has been suppressed due to hard bounces. Use a different address.",
    INSUFFICIENT_SCOPE: "Your API key needs 'send' scope. Create a new key with send permission.",
    DOMAIN_NOT_ACTIVE: "The sender domain is not verified. Add DNS records and wait for verification.",
  };
  return suggestions[code || ""] || "Check the error details and retry. Contact support if the issue persists.";
}
