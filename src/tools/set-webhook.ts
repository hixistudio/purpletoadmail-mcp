// CHECKPOINT: PRD-06 FR-6.2.9 Tool: set_webhook — configures inbound webhook for push delivery.

import { client } from "../client.js";

const VALID_WEBHOOK_EVENTS = ["inbound_email", "delivery_status", "bounce", "complaint"];

export const setWebhookTool = {
  name: "set_webhook",
  description: `Configure a webhook endpoint for push delivery of PurpleToad Mail events. The webhook will receive signed POST requests for each subscribed event type.

Requires 'manage' scope on your API key.

Example: set_webhook(url="https://myagent.com/webhook", events=["inbound_email"])`,
  inputSchema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "The HTTPS URL that PurpleToad Mail will POST events to",
      },
      events: {
        type: "array",
        items: { type: "string" },
        description: "Event types to subscribe to: inbound_email, delivery_status, bounce, complaint",
      },
    },
    required: ["url", "events"],
  },

  async handler(args: Record<string, unknown>) {
    const url = args.url as string;
    const events = args.events as string[];

    if (!url || typeof url !== "string") {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'url' is required and must be a string.",
      };
    }

    if (!Array.isArray(events) || events.length === 0) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: "'events' is required and must be a non-empty array of event types.",
      };
    }

    const invalidEvents = events.filter((e) => !VALID_WEBHOOK_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return {
        success: false,
        error: "INVALID_ARGUMENT",
        message: `Invalid event types: ${invalidEvents.join(", ")}. Valid: ${VALID_WEBHOOK_EVENTS.join(", ")}`,
      };
    }

    const result = await client.setWebhook({ url, events });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.code || "CREATE_FAILED",
        message: result.error?.message || "Failed to configure webhook",
        suggestion: _getSuggestion(result.error?.code),
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      webhook_id: data.id,
      secret: data.secret,
      url: data.url,
      events: data.events,
      active: data.active ?? true,
    };
  },
};

function _getSuggestion(code?: string): string {
  const suggestions: Record<string, string> = {
    WEBHOOK_LIMIT_EXCEEDED:
      "You have reached the maximum number of webhooks on your plan. Upgrade at https://app.purpletoadmail.com/upgrade",
    INVALID_URL: "The webhook URL must be a valid HTTPS URL.",
    INSUFFICIENT_SCOPE:
      "Your API key needs 'manage' scope to configure webhooks. Create a new key with manage permission at https://app.purpletoadmail.com/settings/api-keys",
  };
  return suggestions[code || ""] || "Check the error details and retry.";
}
