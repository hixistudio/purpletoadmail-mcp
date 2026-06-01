import { client } from "../client.js";

export const replyToMessageTool = {
  name: "reply_to_message",
  description: `Reply to an existing email message, maintaining thread continuity. Automatically sets Reply-To and In-Reply-To headers.

Example: reply_to_message(original_message_id="msg_uuid", text="2pm works perfectly. See you then!")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      original_message_id: {
        type: "string",
        description: "The message ID to reply to",
      },
      text: {
        type: "string",
        description: "Plain text reply body",
      },
      html: {
        type: "string",
        description: "HTML reply body (optional)",
      },
    },
    required: ["original_message_id", "text"],
  },

  async handler(args: Record<string, unknown>) {
    const originalMessageId = args.original_message_id as string;
    const text = args.text as string;

    if (!originalMessageId || !text) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'original_message_id' and 'text' are required.",
      };
    }

    const result = await client.replyToMessage(originalMessageId, text, args.html as string | undefined);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "REPLY_FAILED",
        message: result.error?.message || "Failed to send reply",
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      message_id: data.id || data.message_id,
      status: data.status,
      thread_id: data.thread_id,
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    MESSAGE_NOT_FOUND: "The original message was not found. Use list_messages to find valid message IDs.",
    INVALID_FROM: "The reply-from mailbox is not available. Check your mailboxes.",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
