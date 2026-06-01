import { client } from "../client.js";
import { config } from "../config.js";

export const sendEmailTool = {
  name: "send_email",
  description: `Send an email from a PurpleToad-managed mailbox. Returns a message ID for tracking delivery status.

Example: send_email(from="agent@mycompany.com", to=["john@example.com"], subject="Hello", text="Hello from my agent!")

Rate limits: Starter 200/day, Builder 1000/day. Check remaining in response headers.`,
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

    const to = args.to as string[];
    if (!Array.isArray(to) || to.length === 0) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'to' must be a non-empty array of email addresses.",
      };
    }

    const result = await client.sendEmail({
      from,
      to,
      cc: (args.cc as string[]) || [],
      bcc: (args.bcc as string[]) || [],
      subject: args.subject as string,
      text: args.text as string | undefined,
      html: args.html as string | undefined,
      thread_id: args.thread_id as string | undefined,
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
    return {
      success: true,
      message_id: data.id || data.message_id,
      status: data.status,
      estimated_delivery: data.estimated_delivery,
      from,
      to,
      subject: args.subject,
      thread_id: args.thread_id || null,
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    INVALID_FROM: "The 'from' address must be a mailbox you own. Use list_mailboxes to see available addresses.",
    RATE_LIMIT_EXCEEDED: "Daily email limit reached. Wait until tomorrow or upgrade your plan.",
    SUPPRESSED_ADDRESS: "The recipient address has been suppressed due to hard bounces. Use a different address.",
    INSUFFICIENT_SCOPE: "Your API key needs 'send' scope. Create a new key with send permission.",
    DOMAIN_NOT_VERIFIED: "The sender domain is not verified. Add DNS records and wait for verification.",
  };
  return suggestions[code || ""] || "Check the error details and retry. Contact support if the issue persists.";
}
