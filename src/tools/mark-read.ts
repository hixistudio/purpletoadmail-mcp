import { client } from "../client.js";

export const markReadTool = {
  name: "mark_read",
  description: `Mark an email as read. Returns the message ID and read status.

Example: mark_read(message_id="msg_uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      message_id: {
        type: "string",
        description: "The message ID to mark as read",
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

    const result = await client.markRead(messageId);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "MARK_FAILED",
        message: result.error?.message || "Failed to mark message as read",
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      message_id: messageId,
      is_read: data.is_read ?? true,
    };
  },
};
