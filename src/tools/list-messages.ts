import { client } from "../client.js";

export const listMessagesTool = {
  name: "list_messages",
  description: `List received emails with optional filters. Returns message previews (not full bodies). Use get_message for full body and attachments.

Example: list_messages(mailbox="agent@mycompany.com", unread_only=true, limit=20)`,
  inputSchema: {
    type: "object" as const,
    properties: {
      mailbox: {
        type: "string",
        description: "Filter by mailbox address (optional)",
      },
      unread_only: {
        type: "boolean",
        description: "Only return unread messages (default: false)",
        default: false,
      },
      from: {
        type: "string",
        description: "Filter by sender email address (optional)",
      },
      since: {
        type: "string",
        description: "ISO 8601 timestamp — only messages received after this time (optional)",
      },
      limit: {
        type: "number",
        description: "Max messages to return (default: 20, max: 100)",
        default: 20,
      },
      thread_id: {
        type: "string",
        description: "Filter by thread ID (optional)",
      },
    },
    required: [],
  },

  async handler(args: Record<string, unknown>) {
    const result = await client.listMessages({
      mailbox: args.mailbox as string | undefined,
      unread_only: args.unread_only as boolean | undefined,
      from: args.from as string | undefined,
      since: args.since as string | undefined,
      limit: args.limit as number | undefined,
      thread_id: args.thread_id as string | undefined,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "LIST_FAILED",
        message: result.error?.message || "Failed to list messages",
      };
    }

    const data = result.data as Record<string, unknown>;
    const messages = (data.messages || data.items || []) as Array<Record<string, unknown>>;
    const pagination = (data.pagination || {}) as Record<string, unknown>;
    const total = (pagination.total || messages.length) as number;

    return {
      success: true,
      messages: messages.map((m) => {
        const fromObj = (m.from || m.from_addr || {}) as Record<string, unknown>;
        return {
          id: m.id,
          from: { name: fromObj.name, email: fromObj.email },
          subject: m.subject,
          body_preview: m.body_preview,
          is_read: m.is_read,
          has_attachments: m.has_attachments,
          date: m.email_date || m.created_at,
          thread_id: m.thread_id,
        };
      }),
      total,
      page: pagination.page || 1,
      per_page: pagination.per_page || 20,
    };
  },
};
