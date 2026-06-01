import { client } from "../client.js";

export const getMailboxStatusTool = {
  name: "get_mailbox_status",
  description: `Get unread count and quota usage for a mailbox.

Example: get_mailbox_status(mailbox="agent@mycompany.com")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      mailbox: {
        type: "string",
        description: "The mailbox email address",
      },
    },
    required: ["mailbox"],
  },

  async handler(args: Record<string, unknown>) {
    const mailbox = args.mailbox as string;
    if (!mailbox) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'mailbox' is required.",
      };
    }

    const result = await client.getMailboxStatus(mailbox);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "STATUS_FAILED",
        message: result.error?.message || "Failed to get mailbox status",
      };
    }

    const data = result.data as Record<string, unknown>;
    const totalMessages = (data.total_messages ?? data.total ?? 0) as number;
    const unreadCount = (data.unread_count ?? data.unread ?? 0) as number;
    const quotaUsed = (data.quota_used_mb ?? data.quota_used ?? 0) as number;
    const quotaLimit = (data.quota_limit_mb ?? data.quota_limit ?? data.quota ?? 0) as number;
    const quotaPercent = quotaLimit > 0 ? Math.round((quotaUsed / quotaLimit) * 1000) / 10 : 0;

    return {
      success: true,
      mailbox,
      total_messages: totalMessages,
      unread_count: unreadCount,
      quota_used_mb: quotaUsed,
      quota_limit_mb: quotaLimit,
      quota_percent: quotaPercent,
      last_received_at: data.last_received_at || data.last_email_at || null,
    };
  },
};
