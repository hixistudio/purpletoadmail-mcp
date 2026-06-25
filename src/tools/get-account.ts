import { client } from "../client.js";

export const getAccountTool = {
  name: "get_account",
  description: `Get your PurpleToad Mail account profile, current plan, and usage statistics (domains, mailboxes, emails sent, storage).

Example: get_account()`,
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },

  async handler(_args: Record<string, unknown>) {
    const result = await client.getAccount();

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "FETCH_FAILED",
        message: result.error?.message || "Failed to get account info",
      };
    }

    const data = result.data as Record<string, unknown>;
    const usage = (data.usage || {}) as Record<string, unknown>;

    return {
      success: true,
      id: data.id,
      email: data.email,
      display_name: data.display_name,
      plan: data.plan,
      status: data.status,
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      email_verified: data.email_verified,
      usage: {
        domains_used: usage.domains_used,
        domains_limit: usage.domains_limit,
        mailboxes_used: usage.mailboxes_used,
        mailboxes_limit: usage.mailboxes_limit,
        emails_sent_this_year: usage.emails_sent_this_year,
        emails_limit: usage.emails_limit,
        storage_used_mb: usage.storage_used_mb,
        storage_limit_mb: usage.storage_limit_mb,
      },
      created_at: data.created_at,
    };
  },
};
