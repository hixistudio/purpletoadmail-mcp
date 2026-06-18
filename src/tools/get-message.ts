// CHECKPOINT: PRD-06 FR-6.2.4 Tool: get_message — gets full message details.

import { client } from "../client.js";

export const getMessageTool = {
  name: "get_message",
  description: `Get full details of a received email including body and attachments. Use list_messages first to find message IDs.

Example: get_message(message_id="msg_uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      message_id: {
        type: "string",
        description: "The message ID to retrieve",
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

    const result = await client.getMessage(messageId);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "NOT_FOUND",
        message: result.error?.message || "Message not found",
        suggestion: "Use list_messages to find valid message IDs.",
      };
    }

    const data = result.data as Record<string, unknown>;
    const fromObj = (data.from || data.from_addr || {}) as Record<string, unknown>;
    return {
      success: true,
      id: data.id,
      from: { name: fromObj.name, email: fromObj.email },
      to: data.to,
      subject: data.subject,
      date: data.email_date || data.created_at,
      text_body: data.text_body || data.body_text,
      html_body: data.html_body || data.body_html,
      body_preview: data.body_preview,
      attachments: data.attachments || [],
      thread_id: data.thread_id,
      is_read: data.is_read,
    };
  },
};
