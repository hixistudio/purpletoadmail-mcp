import { client } from "../client.js";

export const getMailboxTool = {
  name: "get_mailbox",
  description: `Get detailed information about a specific mailbox including quota usage and alternate email.

Example: get_mailbox(mailbox_id="uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      mailbox_id: {
        type: "string",
        description: "The mailbox ID to retrieve",
      },
    },
    required: ["mailbox_id"],
  },

  async handler(args: Record<string, unknown>) {
    const mailboxId = args.mailbox_id as string;
    if (!mailboxId) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'mailbox_id' is required.",
      };
    }

    const result = await client.getMailbox(mailboxId);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "NOT_FOUND",
        message: result.error?.message || "Mailbox not found",
        suggestion: "Use list_mailboxes to see available mailbox IDs.",
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      id: data.id,
      email: data.email,
      display_name: data.display_name,
      status: data.status,
      quota_mb: data.quota_mb,
      quota_used_mb: data.quota_used_mb,
      alternate_email: data.alternate_email,
      last_login_at: data.last_login_at,
      created_at: data.created_at,
    };
  },
};
