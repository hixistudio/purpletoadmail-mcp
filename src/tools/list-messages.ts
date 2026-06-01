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
    const params: Record<string, string | boolean | number> = {};
    if (args.mailbox) params.mailbox = args.mailbox as string;
    if (args.unread_only) params.unread_only = true;
    if (args.from) params.from = args.from as string;
    if (args.since) params.since = args.since as string;
    if (args.limit) params.limit = Math.min(args.limit as number, 100);
    if (args.thread_id) params.thread_id = args.thread_id as string;

    const result = await client.listMessages(params);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "LIST_FAILED",
        message: result.error?.message || "Failed to list messages",
      };
    }

    const data = result.data as Record<string, unknown>;
    const messages = (data.messages || data.items || []) as Array<Record<string, unknown>>;
    const total = (data.total || messages.length) as number;
    const unreadCount = (data.unread_count ?? data.unread ?? 0) as number;

    return {
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        from: { name: m.from_name, email: m.from_email },
        subject: m.subject,
        body_preview: m.body_preview,
        is_read: m.is_read,
        has_attachments: m.has_attachments,
        date: m.email_date || m.created_at,
        thread_id: m.thread_id,
      })),
      total,
      unread_count: unreadCount,
    };
  },
};
