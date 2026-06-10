import { client } from "../client.js";

export const updateMailboxPasswordTool = {
  name: "update_mailbox_password",
  description: `Update the password for a mailbox. The new password is required immediately for IMAP/POP3 and webmail access. Use with caution — the AI cannot recover a lost password.

Example: update_mailbox_password(mailbox_id="uuid", new_password="SecureP@ssw0rd123")`,
  inputSchema: {
    type: "object" as const,
    properties: {
      mailbox_id: {
        type: "string",
        description: "The mailbox ID to update",
      },
      new_password: {
        type: "string",
        description: "New password (min 8 characters, should include letters and numbers)",
      },
    },
    required: ["mailbox_id", "new_password"],
  },

  async handler(args: Record<string, unknown>) {
    const mailboxId = args.mailbox_id as string;
    const newPassword = args.new_password as string;

    if (!mailboxId) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'mailbox_id' is required.",
      };
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'new_password' must be at least 8 characters.",
        suggestion: "Use a longer password with a mix of letters, numbers, and symbols.",
      };
    }

    const result = await client.updateMailboxPassword(mailboxId, newPassword);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "UPDATE_FAILED",
        message: result.error?.message || "Failed to update mailbox password",
        suggestion: "Use list_mailboxes to find valid mailbox IDs.",
      };
    }

    return {
      success: true,
      mailbox_id: mailboxId,
      message: "Password updated successfully.",
    };
  },
};
