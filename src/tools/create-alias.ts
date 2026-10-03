import { client } from "../client.js";

export const createAliasTool = {
  name: "create_alias",
  description: `Create an email alias that forwards messages to one or more target mailboxes. Useful for team inboxes, support addresses, or role-based emails.

Requires an API key with 'manage' scope.

Example: create_alias(domain_id="uuid", source="support", targets=["alice@mycompany.com", "bob@mycompany.com"])`,
  inputSchema: {
    type: "object" as const,
    properties: {
      domain_id: {
        type: "string",
        description: "The domain ID to create the alias under",
      },
      source: {
        type: "string",
        description: "The alias local part (before @) or full email address",
      },
      targets: {
        type: "array",
        items: { type: "string" },
        description: "Target mailbox email addresses to forward to",
      },
      enabled: {
        type: "boolean",
        description: "Whether the alias is active (default: true)",
        default: true,
      },
    },
    required: ["domain_id", "source", "targets"],
  },

  async handler(args: Record<string, unknown>) {
    const domainId = args.domain_id as string;
    const source = args.source as string;
    const targets = args.targets as string[];

    if (!domainId || !source || !Array.isArray(targets) || targets.length === 0) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'domain_id', 'source', and 'targets' (non-empty array) are required.",
      };
    }

    const result = await client.createAlias({
      domain_id: domainId,
      source,
      targets,
      enabled: args.enabled !== false,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "CREATE_FAILED",
        details: result.error?.details,
        http_status: result.error?.http_status,
        retry_after: result.error?.retry_after,
        message: result.error?.message || "Failed to create alias",
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      alias_id: data.id,
      source: data.source,
      targets: data.targets,
      enabled: data.enabled,
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    domain_not_found: "Domain not found. Use list_domains to see available domains.",
    domain_not_active: "The domain must be verified before creating aliases.",
    alias_exists: "An alias with this source address already exists.",
    alias_limit_reached: "You have reached the maximum number of aliases on your plan.",
    target_not_found: "One or more target mailboxes do not exist.",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
