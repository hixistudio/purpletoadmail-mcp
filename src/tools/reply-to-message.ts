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

    const originalTo = (original.to || []) as Array<Record<string, unknown>>;
    let replyFrom = config.defaultFrom || "";

    if (!replyFrom && originalTo.length > 0) {
      const firstTo = originalTo[0];
      replyFrom = (firstTo.email as string) || "";
    }

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
      return { success: false, error: "INVALID_ARGUMENT", message: subjectValidation.error };
    }

    const cc = (args.cc as string[] | undefined) || [];
    const bcc = (args.bcc as string[] | undefined) || [];

    const result = await client.sendEmail({
      from_email: replyFrom,
      to: [originalSenderEmail],
      cc,
      bcc,
      subject: subjectValidation.subject,
      text,
      html: args.html as string | undefined,
      thread_id: (original.thread_id as string) || undefined,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "SEND_FAILED",
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
    INVALID_FROM: "The reply 'from' address must be a mailbox you own.",
    RATE_LIMIT_EXCEEDED: "Daily email limit reached. Wait until tomorrow or upgrade your plan.",
    INSUFFICIENT_SCOPE: "Your API key needs 'send' scope to reply to messages.",
    DOMAIN_NOT_ACTIVE: "The sender domain is not verified. Add DNS records and wait for verification.",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
