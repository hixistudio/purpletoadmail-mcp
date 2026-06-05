import { client } from "../client.js";

export const searchMessagesTool = {
  name: "search_messages",
  description: `Full-text search across all inbound emails using PostgreSQL GIN index. Returns matching message previews.

Example: search_messages(query="invoice", mailbox="billing@mycompany.com", limit=20)`,
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search query string",
      },
      mailbox: {
        type: "string",
        description: "Filter by mailbox address (optional)",
      },
      page: {
        type: "number",
        description: "Page number (default: 1)",
        default: 1,
      },
      per_page: {
        type: "number",
        description: "Results per page (default: 20, max: 100)",
        default: 20,
      },
    },
    required: ["query"],
  },

  async handler(args: Record<string, unknown>) {
    const query = args.query as string;
    if (!query || typeof query !== "string") {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'query' is required and must be a string.",
      };
    }

    const result = await client.searchMessages(
      query,
      args.mailbox as string | undefined,
      args.page as number | undefined,
      args.per_page as number | undefined
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "SEARCH_FAILED",
        message: result.error?.message || "Failed to search messages",
      };
    }

    const data = result.data as Record<string, unknown>;
    const messages = (data.messages || data.items || []) as Array<Record<string, unknown>>;
    const total = (data.total || messages.length) as number;

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
      page: args.page || 1,
      per_page: Math.min(args.per_page as number || 20, 100),
    };
  },
};
