import { client } from "../client.js";

export const markReadTool = {
  name: "mark_read",
  description: `Mark one or more emails as read. Returns the count of messages marked and remaining unread count.

Example: mark_read(message_ids=["msg_uuid_1", "msg_uuid_2"])`,
  inputSchema: {
    type: "object" as const,
    properties: {
      message_ids: {
        type: "array",
        items: { type: "string" },
        description: "Array of message IDs to mark as read",
      },
    },
    required: ["message_ids"],
  },

  async handler(args: Record<string, unknown>) {
    const messageIds = args.message_ids as string[];
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'message_ids' must be a non-empty array.",
      };
    }

    const result = await client.markRead(messageIds);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "MARK_FAILED",
        message: result.error?.message || "Failed to mark messages as read",
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      marked_read: data.marked_read || messageIds.length,
      remaining_unread: data.remaining_unread ?? null,
    };
  },
};
