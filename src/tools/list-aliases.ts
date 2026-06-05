import { client } from "../client.js";

export const listAliasesTool = {
  name: "list_aliases",
  description: `List all email aliases with their source addresses and target mailboxes. Optionally filter by domain.

Example: list_aliases(domain_id="uuid")`,
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
    const result = await client.listAliases(args.domain_id as string | undefined);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "LIST_FAILED",
        message: result.error?.message || "Failed to list aliases",
      };
    }

    const data = result.data as Record<string, unknown>;
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
      total: aliases.length,
    };
  },
};
