import { client } from "../client.js";

export const getOutboundTool = {
  name: "get_outbound_message",
  description: `Get full details of a sent email including delivery status, SMTP response, and status history. Use list_outbound_messages to find message IDs.

Example: get_outbound_message(message_id="msg_uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      message_id: {
        type: "string",
        description: "The outbound message ID to retrieve",
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

    const result = await client.getOutboundMessage(messageId);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "NOT_FOUND",
        message: result.error?.message || "Message not found",
        suggestion: "Use list_outbound_messages to find valid message IDs.",
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      id: data.id,
      status: data.status,
      status_history: data.status_history,
      from_email: data.from_email,
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      subject: data.subject,
      body_preview: data.body_preview,
      attachments: data.attachments || [],
      thread_id: data.thread_id,
      sent_at: data.sent_at,
      delivered_at: data.delivered_at,
      smtp_code: data.smtp_code,
      smtp_response: data.smtp_response,
    };
  },
};
