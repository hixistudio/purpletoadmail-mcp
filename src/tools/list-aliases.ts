import { client } from "../client.js";

export const listAliasesTool = {
  name: "list_aliases",
  description: `List a page of email aliases with their source addresses and target mailboxes. Optionally filter by domain.

Example: list_aliases(domain_id="uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      per_page: { type: "integer", minimum: 1, maximum: 200, default: 50 },
      domain_id: {
        type: "string",
        description: "Filter by domain ID (optional)",
      },
    },
    required: [],
  },

  async handler(args: Record<string, unknown>) {
    const result = await client.listAliases(args.domain_id as string | undefined, args.page as number | undefined, args.per_page as number | undefined);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "LIST_FAILED",
        details: result.error?.details,
        http_status: result.error?.http_status,
        retry_after: result.error?.retry_after,
        message: result.error?.message || "Failed to list aliases",
      };
    }

    const data = result.data as Record<string, unknown>;
    const pagination = (data.pagination || {}) as Record<string, unknown>;
    const aliases = (data.aliases || []) as Array<Record<string, unknown>>;

    return {
      success: true,
      aliases: aliases.map((a) => ({
        id: a.id,
        source: a.source,
        targets: a.targets,
        is_catch_all: a.is_catch_all,
        enabled: a.enabled,
        created_at: a.created_at,
      })),
      total: pagination.total ?? aliases.length,
      page: pagination.page ?? 1,
      per_page: pagination.per_page ?? 50,
      total_pages: pagination.total_pages ?? 1,
    };
  },
};
