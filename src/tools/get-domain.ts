import { client } from "../client.js";

export const getDomainTool = {
  name: "get_domain",
  description: `Get detailed information about a specific domain including DNS records and verification status.

Example: get_domain(domain_id="uuid")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      domain_id: {
        type: "string",
        description: "The domain ID to retrieve",
      },
    },
    required: ["domain_id"],
  },

  async handler(args: Record<string, unknown>) {
    const domainId = args.domain_id as string;
    if (!domainId) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'domain_id' is required.",
      };
    }

    const result = await client.getDomain(domainId);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "NOT_FOUND",
        message: result.error?.message || "Domain not found",
        suggestion: "Use list_domains to see available domain IDs.",
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      id: data.id,
      name: data.name,
      status: data.status,
      dns_records: data.dns_records,
      dns_health: data.dns_health,
      mailbox_count: data.mailbox_count,
      aliases_count: data.aliases_count,
      catch_all_enabled: data.catch_all_enabled,
      catch_all_target: data.catch_all_target,
      created_at: data.created_at,
    };
  },
};
