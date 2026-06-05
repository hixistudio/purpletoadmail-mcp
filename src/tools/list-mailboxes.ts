import { client } from "../client.js";

export const listMailboxesTool = {
  name: "list_mailboxes",
  description: `List all mailboxes with quota and status. Optionally filter by domain.

Example: list_mailboxes(domain_id="uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      domain_id: {
        type: "string",
        description: "Filter by domain ID (optional)",
      },
    },
    required: [],
  },

  async handler(args: Record<string, unknown>) {
    const result = await client.listMailboxes(args.domain_id as string | undefined);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "LIST_FAILED",
        message: result.error?.message || "Failed to list mailboxes",
      };
    }

    const data = result.data as Record<string, unknown>;
    const mailboxes = (data.mailboxes || []) as Array<Record<string, unknown>>;

    return {
      success: true,
      mailboxes: mailboxes.map((m) => ({
        id: m.id,
        email: m.email,
        display_name: m.display_name,
        status: m.status,
        quota_mb: m.quota_mb,
        quota_used_mb: m.quota_used_mb,
        last_login_at: m.last_login_at,
      })),
      total: mailboxes.length,
    };
  },
};
