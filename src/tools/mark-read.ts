// CHECKPOINT: PRD-06 FR-6.2.7 Tool: mark_read — marks one or more messages as read.

import { client } from "../client.js";

export const markReadTool = {
  name: "mark_read",
  description: `Mark one or more received emails as read.

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
        message: "'message_ids' is required and must be a non-empty array.",
      };
    }

    let marked = 0;
    const errors: string[] = [];

    await Promise.all(
      messageIds.map(async (messageId) => {
        const result = await client.markRead(messageId);
        if (result.success) {
          marked += 1;
        } else {
          errors.push(`${messageId}: ${result.error?.message || "Failed"}`);
        }
      })
    );

    if (marked === 0) {
      return {
        success: false,
        error: "MARK_FAILED",
        message: `Failed to mark messages as read. ${errors.join("; ")}`,
      };
    }

    // Best-effort remaining unread count: query unread total for a representative mailbox
    // if all messages belong to the same thread/mailbox. We keep it simple and return null.
    return {
      success: true,
      marked_read: marked,
      remaining_unread: null,
      failed: errors.length > 0 ? errors : undefined,
    };
  },
};
