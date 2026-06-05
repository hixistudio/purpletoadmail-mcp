import { client } from "../client.js";

export const cancelScheduledTool = {
  name: "cancel_scheduled_email",
  description: `Cancel a scheduled email before it is sent.

Example: cancel_scheduled_email(message_id="msg_uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      message_id: {
        type: "string",
        description: "The scheduled message ID to cancel",
      },
    },
    required: ["message_id"],
  },

  async handler(args: Record<string, unknown>) {
    const messageId = args.message_id as string;
    if (!messageId) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'message_id' is required.",
      };
    }

    const result = await client.cancelScheduled(messageId);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "CANCEL_FAILED",
        message: result.error?.message || "Failed to cancel scheduled email",
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      message_id: data.message_id,
      status: data.status,
      cancelled_at: data.cancelled_at,
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    MESSAGE_NOT_FOUND: "Message not found. Use list_outbound_messages with status='scheduled' to find scheduled emails.",
    ALREADY_SENT: "This email has already been sent and cannot be cancelled.",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
