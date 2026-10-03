// CHECKPOINT: PRD-06 FR-6.2.6 Tool: reply_to_message — replies to an existing message, preserving thread continuity.

import { client } from "../client.js";
import { config } from "../config.js";
import { isValidEmail, validateSubject } from "../lib/validation.js";

export const replyToMessageTool = {
  name: "reply_to_message",
  description: `Reply to a received email, preserving the original thread. The reply is sent from the mailbox that received the original message.

Example: reply_to_message(original_message_id="msg_uuid", text="2pm works perfectly. See you then!")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      original_message_id: {
        type: "string",
        description: "The ID of the message you are replying to",
      },
      text: {
        type: "string",
        description: "Plain text reply body",
      },
      html: {
        type: "string",
        description: "HTML reply body (optional)",
      },
      cc: {
        type: "array",
        items: { type: "string" },
        description: "Additional CC recipients (optional)",
        default: [],
      },
      bcc: {
        type: "array",
        items: { type: "string" },
        description: "Additional BCC recipients (optional)",
        default: [],
      },
      attachments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            filename: { type: "string" },
            content: {
              type: "string",
              description: "Base64-encoded file content",
            },
            content_type: { type: "string" },
            disposition: {
              type: "string",
              enum: ["attachment", "inline"],
              default: "attachment",
            },
            content_id: { type: "string" },
          },
          required: ["filename", "content", "content_type"],
        },
        description: "Base64-encoded attachments (optional, max 10)",
        default: [],
      },
    },
    required: ["original_message_id", "text"],
  },

  async handler(args: Record<string, unknown>) {
    const originalMessageId = args.original_message_id as string;
    if (!originalMessageId) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'original_message_id' is required.",
      };
    }

    const text = args.text as string;
    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'text' is required and must be a non-empty string.",
      };
    }

    // Fetch the original message to determine the recipient mailbox and sender.
    const originalResult = await client.getMessage(originalMessageId);
    if (!originalResult.success) {
      return {
        success: false,
        error: originalResult.error?.code || "NOT_FOUND",
        details: originalResult.error?.details,
        http_status: originalResult.error?.http_status,
        retry_after: originalResult.error?.retry_after,
        message: originalResult.error?.message || "Original message not found",
        suggestion: "Use list_messages to find valid message IDs.",
      };
    }

    const original = originalResult.data as Record<string, unknown>;
    const fromObj = (original.from || {}) as Record<string, unknown>;
    const originalSenderEmail = (fromObj.email as string) || "";
    if (!originalSenderEmail || !isValidEmail(originalSenderEmail)) {
      return {
        success: false,
        error: "INVALID_ORIGINAL_MESSAGE",
        message: "Could not determine the original sender email address.",
      };
    }

    // CHECKPOINT: PRD-06 FR-6.2.6 Use the API-authoritative receiving mailbox.
    const replyFrom = (original.mailbox as string) || config.defaultFrom || "";

    if (!replyFrom || !isValidEmail(replyFrom)) {
      return {
        success: false,
        error: "NO_REPLY_FROM",
        message: "Could not determine a valid 'from' address for the reply.",
        suggestion:
          "Set PURPLETOAD_DEFAULT_FROM or ensure the original message has a valid recipient address.",
      };
    }

    const originalSubject = (original.subject as string) || "";
    let subject = originalSubject;
    if (!subject.toLowerCase().startsWith("re:")) {
      subject = `Re: ${originalSubject}`;
    }

    const subjectValidation = validateSubject(subject);
    if (!subjectValidation.valid) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: subjectValidation.error,
      };
    }

    const cc = (args.cc as string[] | undefined) || [];
    const bcc = (args.bcc as string[] | undefined) || [];

    const attachments =
      (args.attachments as Array<Record<string, unknown>> | undefined) || [];
    if (attachments.length > 10) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "A maximum of 10 attachments is allowed per email.",
      };
    }

    // Build explicit reply threading fields from the original Message-ID when available.
    const originalMessageHeader = (original.message_id_header as string) || "";
    const originalHeaders = (original.headers || {}) as Record<string, unknown>;
    const referencesHeader = Object.entries(originalHeaders).find(
      ([key]) => key.toLowerCase() === "references",
    )?.[1];
    const references: string[] =
      typeof referencesHeader === "string"
        ? referencesHeader.match(/<[^<>\s]+@[^<>\s]+>/g) || []
        : [];
    if (originalMessageHeader && !references.includes(originalMessageHeader))
      references.push(originalMessageHeader);

    const result = await client.sendEmail({
      from_email: replyFrom,
      to: [originalSenderEmail],
      cc,
      bcc,
      subject: subjectValidation.subject,
      text,
      html: args.html as string | undefined,
      thread_id: (original.thread_id as string) || undefined,
      attachments: attachments.map((a) => ({
        filename: String(a.filename),
        content: String(a.content),
        content_type: String(a.content_type),
        disposition: (a.disposition as string) || "attachment",
        content_id: a.content_id as string | undefined,
      })),
      in_reply_to: originalMessageHeader || undefined,
      references: references.length ? references.slice(-100) : undefined,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "SEND_FAILED",
        details: result.error?.details,
        http_status: result.error?.http_status,
        retry_after: result.error?.retry_after,
        message: result.error?.message || "Failed to send reply",
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      message_id: data.message_id || data.id,
      status: data.status,
      thread_id: original.thread_id || null,
      to: [originalSenderEmail],
      subject: subjectValidation.subject,
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    TIMEOUT:
      "The API may have accepted the message. Check outbound status before retrying to avoid duplicates.",
    REQUEST_FAILED:
      "Check API connectivity and outbound status before retrying to avoid duplicates.",
    INVALID_FROM: "The reply 'from' address must be a mailbox you own.",
    RATE_LIMIT_EXCEEDED:
      "API rate limit reached. Respect retry_after when provided and check current account usage.",
    INSUFFICIENT_SCOPE: "Your API key needs 'send' scope to reply to messages.",
    DOMAIN_NOT_ACTIVE:
      "The sender domain is not verified. Add DNS records and wait for verification.",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
