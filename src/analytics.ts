import { PostHog } from "posthog-node";

const POSTHOG_KEY = process.env.POSTHOG_KEY;
const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";
const DISABLED = process.env.POSTHOG_DISABLE === "1" || process.env.POSTHOG_DISABLE === "true";

class NoOpAnalytics {
  capture(_: object) {}
  shutdown() {}
}

let client: PostHog | NoOpAnalytics | null = null;

export function getAnalytics() {
  if (client) return client;
  if (DISABLED || !POSTHOG_KEY) {
    client = new NoOpAnalytics();
    return client;
  }
  client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
  return client;
}

export async function shutdownAnalytics() {
  if (client instanceof PostHog) {
    await client.shutdown();
  }
}

export function captureToolCall(
  distinctId: string,
  toolName: string,
  result: { success: boolean; error?: string },
  transport: string
) {
  if (DISABLED) return;
  const analytics = getAnalytics();
  analytics.capture({
    distinctId,
    event: "tool_called",
    properties: {
      tool_name: toolName,
      success: result.success,
      error_type: result.error,
      transport,
    },
  });
}
