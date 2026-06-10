import { client } from "../client.js";

export const archiveMessageTool = {
  name: "archive_message",
  description: `Archive an inbound email to keep your inbox clean. Archived messages can still be found via search.

Example: archive_message(message_id="msg_uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      message_id: {
        type: "string",
        description: "The message ID to archive",
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

    const result = await client.archiveMessage(messageId);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "ARCHIVE_FAILED",
        message: result.error?.message || "Failed to archive message",
        suggestion: "Use list_messages or search_messages to find valid message IDs.",
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      message_id: messageId,
      is_archived: data.is_archived ?? true,
    };
  },
};
