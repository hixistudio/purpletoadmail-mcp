import { client } from "../client.js";

export const setWebhookTool = {
  name: "set_webhook",
  description: `Configure an inbound webhook for push delivery of new emails.

Example: set_webhook(url="https://myagent.com/webhook", events=["inbound_email"])`,
  inputSchema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "The webhook URL to receive events",
      },
      events: {
        type: "array",
        items: { type: "string" },
        description: "Events to subscribe to (e.g., ['inbound_email'])",
        default: ["inbound_email"],
      },
    },
    required: ["url"],
  },

  async handler(args: Record<string, unknown>) {
    const url = args.url as string;
    if (!url) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'url' is required.",
      };
    }

    const events = (args.events as string[]) || ["inbound_email"];
    const result = await client.setWebhook(url, events);

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "WEBHOOK_FAILED",
        message: result.error?.message || "Failed to set webhook",
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      webhook_id: data.id || data.webhook_id,
      secret: data.secret,
      url,
      events,
      active: data.active ?? true,
    };
  },
};
