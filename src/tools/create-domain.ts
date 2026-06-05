import { client } from "../client.js";

export const createDomainTool = {
  name: "create_domain",
  description: `Create a new email domain on PurpleToad. Returns the exact DNS records you must add at your domain registrar or DNS provider. After adding the records, domain verification happens automatically within a few minutes.

Requires 'manage' scope on your API key. If your key only has 'read' + 'send', create a separate key with 'manage' scope for domain setup, or use the dashboard at https://app.purpletoadmail.com.

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
    const dns = (data.dns_records || {}) as Record<string, Record<string, unknown>>;

    const mx = dns.mx || {};
    const spf = dns.spf || {};
    const dkim = dns.dkim || {};
    const dmarc = dns.dmarc || {};

    // Build a clean, copy-pasteable DNS table
    const records = [
      {
        type: String(mx.type || "MX"),
        host: String(mx.host || "@"),
        value: String(mx.value || "mx.purpletoadmail.com"),
        priority: String(mx.priority || "10"),
        ttl: String(mx.ttl || "3600"),
      },
      {
        type: String(spf.type || "TXT"),
        host: String(spf.host || "@"),
        value: String(spf.value || ""),
        priority: "—",
        ttl: String(spf.ttl || "3600"),
      },
      {
        type: String(dkim.type || "TXT"),
        host: String(dkim.host || ""),
        value: String(dkim.value || ""),
        priority: "—",
        ttl: String(dkim.ttl || "3600"),
      },
      {
        type: String(dmarc.type || "TXT"),
        host: String(dmarc.host || "_dmarc"),
        value: String(dmarc.value || ""),
        priority: "—",
        ttl: String(dmarc.ttl || "3600"),
      },
    ];

    const dnsTable = records
      .map(
        (r) =>
          `| ${r.type.padEnd(5)} | ${r.host.padEnd(28)} | ${r.value.padEnd(55)} | ${r.priority.padEnd(9)} | ${r.ttl.padEnd(6)} |`
      )
      .join("\n");

    return {
      success: true,
      domain_id: data.id,
      domain: data.name || domain,
      status: data.status,
      dns_records_table: `| Type  | Host (Name)                  | Value / Points to                                     | Priority  | TTL    |
|-------|------------------------------|-------------------------------------------------------|-----------|--------|
${dnsTable}`,
      dns_records_copy_paste: records.map((r) => `${r.type}\t${r.host}\t"${r.value}"\t${r.priority}\t${r.ttl}`).join("\n"),
      next_steps: [
        "1. Log in to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.)",
        "2. Add the 4 DNS records above exactly as shown",
        "3. Wait 2–10 minutes for propagation",
        `4. Check status with: get_domain(domain_id="${data.id}")`,
      ],
      important_notes: [
        "MX record: Some providers show 'Priority' as a separate field; enter 10 there.",
        "TXT records: Some providers automatically wrap values in quotes — do NOT add extra quotes.",
        "DKIM host: If your provider requires the full name, use the complete host value shown above.",
      ],
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
    INSUFFICIENT_SCOPE:
      "Your API key needs 'manage' scope to create domains. Create a new key with manage permission at https://app.purpletoadmail.com/settings/api-keys",
  };
  return suggestions[code || ""] || "Check the error details and retry. Contact support if the issue persists.";
}
