// CHECKPOINT: PRD-06 FR-6.2.8 Paginated mailbox lookup and API-authoritative inbox counts.
import { client } from "../client.js";

export const getMailboxStatusTool = {
  name: "get_mailbox_status",
  description:
    "Get total/unread message counts and quota usage for a mailbox. Incomplete requests return an error with known values and null for unavailable counts.",
  inputSchema: {
    type: "object" as const,
    properties: {
      mailbox: { type: "string", description: "Full mailbox email address" },
    },
    required: ["mailbox"],
  },
  async handler(args: Record<string, unknown>) {
    let mailbox = args.mailbox as string;
    const lookup = await client.findResource("mailboxes", "email", mailbox);
    if (!lookup.success)
      return {
        success: false,
        error:
          lookup.error?.code === "NOT_FOUND"
            ? "MAILBOX_NOT_FOUND"
            : lookup.error?.code,
        message: lookup.error?.message,
        details: lookup.error?.details,
        http_status: lookup.error?.http_status,
        retry_after: lookup.error?.retry_after,
      };
    const match = lookup.data!;
    if (typeof match.email === "string") mailbox = match.email;
    const [totalResult, unreadResult] = await Promise.all([
      client.listMessages({ mailbox, limit: 1 }),
      client.listMessages({ mailbox, unread_only: true, limit: 1 }),
    ]);
    const count = (result: typeof totalResult) => {
      if (!result.success) return null;
      const data = result.data as Record<string, unknown>;
      const pagination = data.pagination as Record<string, unknown> | undefined;
      return typeof pagination?.total === "number" ? pagination.total : null;
    };
    const total = count(totalResult),
      unread = count(unreadResult);
    const messages = ((totalResult.data as Record<string, unknown> | undefined)
      ?.messages || []) as Record<string, unknown>[];
    const quota = typeof match.quota_mb === "number" ? match.quota_mb : null;
    const used =
      typeof match.quota_used_mb === "number" ? match.quota_used_mb : null;
    const complete = total !== null && unread !== null;
    return {
      success: complete,
      ...(complete
        ? {}
        : {
            error: "STATUS_INCOMPLETE",
            message: "Could not retrieve all mailbox counts",
            details: {
              total_error: totalResult.error,
              unread_error: unreadResult.error,
            },
          }),
      mailbox,
      total_messages: total,
      unread_count: unread,
      quota_used_mb: used,
      quota_limit_mb: quota,
      quota_percent:
        quota !== null && used !== null && quota > 0
          ? Number(((used / quota) * 100).toFixed(1))
          : null,
      last_received_at: messages[0]?.email_date ?? null,
    };
  },
};
