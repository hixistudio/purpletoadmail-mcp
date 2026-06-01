import { client } from "../client.js";

export const createMailboxTool = {
  name: "create_mailbox",
  description: `Create a new email mailbox under a domain on PurpleToad. The password is shown once and cannot be retrieved later.

Example: create_mailbox(domain_id="uuid", local_part="agent", display_name="AI Agent", quota_mb=256)`,
  inputSchema: {
    type: "object" as const,
    properties: {
      domain_id: {
        type: "string",
        description: "The domain ID to create the mailbox under",
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
        description: "Storage quota in MB (optional)",
      },
    },
    required: ["domain_id", "local_part"],
  },

  async handler(args: Record<string, unknown>) {
    const domainId = args.domain_id as string;
    const localPart = args.local_part as string;

    if (!domainId || !localPart) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'domain_id' and 'local_part' are required.",
      };
    }

    const result = await client.createMailbox({
      domain_id: domainId,
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
      setup_complete: true,
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    MAILBOX_LIMIT_EXCEEDED:
      "You have reached the maximum number of mailboxes on your plan. Upgrade at https://app.purpletoadmail.com/upgrade",
    MAILBOX_ALREADY_EXISTS: "A mailbox with this address already exists.",
    DOMAIN_NOT_VERIFIED: "The domain must be verified before creating mailboxes. Add DNS records and wait for verification.",
    INVALID_PASSWORD: "Password does not meet complexity requirements (12+ chars, upper/lower/digit/special).",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
