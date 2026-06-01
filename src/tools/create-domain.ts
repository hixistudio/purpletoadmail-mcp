import { client } from "../client.js";

export const createDomainTool = {
  name: "create_domain",
  description: `Create a new email domain on PurpleToad. Returns DNS records (MX, SPF, DKIM, DMARC) that must be added at your DNS provider. After adding DNS records, verification happens automatically within minutes.

Example: create_domain(domain="mycompany.com")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      domain: {
        type: "string",
        description: "The domain name to add (e.g., 'mycompany.com')",
      },
    },
    required: ["domain"],
  },

  async handler(args: Record<string, unknown>) {
    const domain = args.domain as string;
    if (!domain || typeof domain !== "string") {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'domain' is required and must be a string.",
      };
    }

    const result = await client.createDomain(domain);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "CREATE_FAILED",
        message: result.error?.message || "Failed to create domain",
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      domain_id: data.id,
      domain: data.name || domain,
      status: data.status,
      dns_records: data.dns_records,
      instructions:
        "Add the 4 DNS records at your DNS provider, then the domain will be verified automatically within a few minutes.",
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    DOMAIN_LIMIT_EXCEEDED:
      "You have reached the maximum number of domains on your plan. Upgrade at https://app.purpletoadmail.com/upgrade",
    DOMAIN_ALREADY_EXISTS: "This domain is already registered on PurpleToad.",
    INVALID_DOMAIN: "The domain name format is invalid. Use a valid domain like 'mycompany.com'.",
    RATE_LIMIT_EXCEEDED: "Too many requests. Wait a moment and retry.",
  };
  return suggestions[code || ""] || "Check the error details and retry. Contact support if the issue persists.";
}
