import { client } from "../client.js";

export const listOutboundTool = {
  name: "list_outbound_messages",
  description: `List sent/outbound emails with delivery status and tracking. Filter by status, domain, date range, or thread.

Example: list_outbound_messages(status="delivered", limit=20)`,
  inputSchema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        description: "Filter by status: queued, sent, delivered, bounced, failed (optional)",
      },
      domain_id: {
        type: "string",
        description: "Filter by domain ID (optional)",
      },
      thread_id: {
        type: "string",
        description: "Filter by thread ID (optional)",
      },
      date_from: {
        type: "string",
        description: "ISO 8601 date — only messages sent on or after (optional)",
      },
      date_to: {
        type: "string",
        description: "ISO 8601 date — only messages sent on or before (optional)",
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
    required: [],
  },

  async handler(args: Record<string, unknown>) {
    const result = await client.listOutboundMessages({
      status: args.status as string | undefined,
      domain_id: args.domain_id as string | undefined,
      thread_id: args.thread_id as string | undefined,
      date_from: args.date_from as string | undefined,
      date_to: args.date_to as string | undefined,
      page: args.page as number | undefined,
      per_page: args.per_page as number | undefined,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "LIST_FAILED",
        message: result.error?.message || "Failed to list outbound messages",
      };
    }

    const data = result.data as Record<string, unknown>;
    const messages = (data.messages || data.items || []) as Array<Record<string, unknown>>;
    const total = (data.total || messages.length) as number;

    return {
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        from_email: m.from_email,
        to: m.to,
        subject: m.subject,
        status: m.status,
        sent_at: m.sent_at,
        delivered_at: m.delivered_at,
        body_preview: m.body_preview,
        thread_id: m.thread_id,
      })),
      total,
      page: args.page || 1,
      per_page: Math.min(args.per_page as number || 20, 100),
    };
  },
};
