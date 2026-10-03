import { client } from "../client.js";

export const listDomainsTool = {
  name: "list_domains",
  description: `List a page of domains on your PurpleToad Mail account with DNS health and mailbox counts.

Example: list_domains()`,
  inputSchema: {
    type: "object" as const,
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      per_page: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    },
    required: [],
  },

  async handler(args: Record<string, unknown>) {
    const result = await client.listDomains(args.page as number | undefined, args.per_page as number | undefined);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "LIST_FAILED",
        details: result.error?.details,
        http_status: result.error?.http_status,
        retry_after: result.error?.retry_after,
        message: result.error?.message || "Failed to list domains",
      };
    }

    const data = result.data as Record<string, unknown>;
    const pagination = (data.pagination || {}) as Record<string, unknown>;
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
      total: pagination.total ?? domains.length,
      page: pagination.page ?? 1,
      per_page: pagination.per_page ?? 20,
      total_pages: pagination.total_pages ?? 1,
    };
  },
};
