// CHECKPOINT: PRD-06 FR-6.2.2 Tool: create_mailbox — creates a new mailbox under a domain.

import { client } from "../client.js";

export const createMailboxTool = {
  name: "create_mailbox",
  description: `Create a new email mailbox under a domain on PurpleToad Mail. The auto-generated password is shown once and cannot be retrieved later — change it immediately via the dashboard.

Requires an API key with 'manage' scope.

Example: create_mailbox(domain="mycompany.com", local_part="agent", display_name="AI Agent", quota_mb=256)`,
  inputSchema: {
    type: "object" as const,
    properties: {
      domain: {
        type: "string",
        description: "The domain name to create the mailbox under (e.g., 'mycompany.com')",
      },
      domain_id: {
        type: "string",
        description: "Domain ID (alternative to domain name)",
      },
      local_part: {
        type: "string",
        description: "The local part of the email address (before @)",
      },
      display_name: {
        type: "string",
        description: "Display name for the mailbox (optional)",
      },
      password: {
        type: "string",
        description: "Custom password (optional; auto-generated if omitted)",
      },
      quota_mb: {
        type: "number",
        description: "Storage quota in MB (optional, default 100)",
      },
    },
    required: ["local_part"],
  },

  async handler(args: Record<string, unknown>) {
    const localPart = args.local_part as string;
    if (!localPart) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'local_part' is required.",
      };
    }

    let domainId = args.domain_id as string | undefined;
    const domainName = args.domain as string | undefined;

    if (!domainId && !domainName) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "Either 'domain' (domain name) or 'domain_id' is required.",
      };
    }

    if (!domainId && domainName) {
      const domainsResult = await client.listDomains();
      if (!domainsResult.success) {
        return {
          success: false,
          error: domainsResult.error?.code || "LIST_FAILED",
          message: domainsResult.error?.message || "Failed to list domains",
        };
      }

      const data = domainsResult.data as Record<string, unknown>;
      const domains = (data.domains || []) as Array<Record<string, unknown>>;
      const match = domains.find(
        (d) => d.name === domainName || d.domain === domainName
      );
      if (!match) {
        return {
          success: false,
          error: "DOMAIN_NOT_FOUND",
          message: `Domain '${domainName}' not found.`,
          suggestion: "Use list_domains to see available domains, or create the domain first with create_domain.",
        };
      }
      domainId = String(match.id);
    }

    const result = await client.createMailbox({
      domain_id: domainId as string,
      local_part: localPart,
      display_name: args.display_name as string | undefined,
      password: args.password as string | undefined,
      quota_mb: args.quota_mb as number | undefined,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "CREATE_FAILED",
        message: result.error?.message || "Failed to create mailbox",
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      mailbox_id: data.id,
      email: data.email,
      password: data.password,
      status: data.status,
      important: "This password is shown once only. Change it immediately via the dashboard.",
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    MAILBOX_LIMIT_EXCEEDED:
      "You have reached the maximum number of mailboxes on your plan. Upgrade at https://app.purpletoadmail.com/upgrade",
    MAILBOX_ALREADY_EXISTS: "A mailbox with this address already exists.",
    DOMAIN_NOT_ACTIVE: "The domain must be verified before creating mailboxes. Add DNS records and wait for verification.",
    INVALID_PASSWORD: "Password does not meet complexity requirements (12+ chars, upper/lower/digit/special).",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
