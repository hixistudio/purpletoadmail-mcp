import { client } from "../client.js";

export const listDomainsTool = {
  name: "list_domains",
  description: `List all domains on your PurpleToad Mail account with DNS health and mailbox counts.

Example: list_domains()`,
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },

  async handler(_args: Record<string, unknown>) {
    const result = await client.listDomains();

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "LIST_FAILED",
        message: result.error?.message || "Failed to list domains",
      };
    }

    const data = result.data as Record<string, unknown>;
    const domains = (data.domains || []) as Array<Record<string, unknown>>;

    return {
      success: true,
      domains: domains.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        mailbox_count: d.mailbox_count,
        dns_health: d.dns_health,
        catch_all_enabled: d.catch_all_enabled,
        created_at: d.created_at,
      })),
      total: domains.length,
    };
  },
};
