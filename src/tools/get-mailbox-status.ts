// CHECKPOINT: PRD-06 FR-6.2.8 Tool: get_mailbox_status — unread count and quota usage for a mailbox.

import { client } from "../client.js";
import { isValidEmail } from "../lib/validation.js";

export const getMailboxStatusTool = {
  name: "get_mailbox_status",
  description: `Get unread count, total messages, and quota usage for a PurpleToad mailbox.

Example: get_mailbox_status(mailbox="agent@mycompany.com")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      mailbox: {
        type: "string",
        description: "The full mailbox email address (e.g., 'agent@mycompany.com')",
      },
    },
    required: ["mailbox"],
  },

  async handler(args: Record<string, unknown>) {
    const mailbox = args.mailbox as string;
    if (!mailbox || !isValidEmail(mailbox)) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'mailbox' is required and must be a valid email address.",
      };
    }

    // Find the mailbox ID and quota from the mailbox list.
    const listResult = await client.listMailboxes();
    if (!listResult.success) {
      return {
        success: false,
        error: listResult.error?.code || "LIST_FAILED",
        message: listResult.error?.message || "Failed to list mailboxes",
      };
    }

    const data = listResult.data as Record<string, unknown>;
    const mailboxes = (data.mailboxes || []) as Array<Record<string, unknown>>;
    const match = mailboxes.find((m) => m.email === mailbox);
    if (!match) {
      return {
        success: false,
        error: "MAILBOX_NOT_FOUND",
        message: `Mailbox '${mailbox}' not found.`,
        suggestion: "Use list_mailboxes to see available mailbox addresses.",
      };
    }

    const quotaMb = typeof match.quota_mb === "number" ? match.quota_mb : 0;
    const quotaUsedMb = typeof match.quota_used_mb === "number" ? match.quota_used_mb : 0;

    // Count total messages for this mailbox.
    const totalResult = await client.listMessages({ mailbox, limit: 1 });
    const totalMessages = totalResult.success
      ? ((totalResult.data as Record<string, unknown>).total as number) || 0
      : 0;

    // Count unread messages for this mailbox.
    const unreadResult = await client.listMessages({ mailbox, unread_only: true, limit: 1 });
    const unreadCount = unreadResult.success
      ? ((unreadResult.data as Record<string, unknown>).total as number) || 0
      : 0;

    // Find last received message date.
    let lastReceivedAt: string | null = null;
    if (totalResult.success) {
      const totalData = totalResult.data as Record<string, unknown>;
      const messages = (totalData.messages || []) as Array<Record<string, unknown>>;
      if (messages.length > 0 && messages[0].date) {
        lastReceivedAt = String(messages[0].date);
      }
    }

    return {
      success: true,
      mailbox,
      total_messages: totalMessages,
      unread_count: unreadCount,
      quota_used_mb: quotaUsedMb,
      quota_limit_mb: quotaMb,
      quota_percent: quotaMb > 0 ? parseFloat(((quotaUsedMb / quotaMb) * 100).toFixed(1)) : 0,
      last_received_at: lastReceivedAt,
    };
  },
};
