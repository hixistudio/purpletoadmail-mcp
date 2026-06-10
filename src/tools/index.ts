import { createDomainTool } from "./create-domain.js";
import { listDomainsTool } from "./list-domains.js";
import { getDomainTool } from "./get-domain.js";
import { createMailboxTool } from "./create-mailbox.js";
import { listMailboxesTool } from "./list-mailboxes.js";
import { getMailboxTool } from "./get-mailbox.js";
import { updateMailboxPasswordTool } from "./update-mailbox-password.js";
import { createAliasTool } from "./create-alias.js";
import { listAliasesTool } from "./list-aliases.js";
import { listMessagesTool } from "./list-messages.js";
import { getMessageTool } from "./get-message.js";
import { searchMessagesTool } from "./search-messages.js";
import { markReadTool } from "./mark-read.js";
import { archiveMessageTool } from "./archive-message.js";
import { sendEmailTool } from "./send-email.js";
import { scheduleEmailTool } from "./schedule-email.js";
import { cancelScheduledTool } from "./cancel-scheduled.js";
import { listOutboundTool } from "./list-outbound.js";
import { getOutboundTool } from "./get-outbound.js";
import { getAccountTool } from "./get-account.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const rawTools: ToolDef[] = [
  // ─── Domain Setup ─────────────────────────────────────────────────────────
  createDomainTool as ToolDef,

  // ─── Infrastructure Management ────────────────────────────────────────────
  createMailboxTool as ToolDef,
  updateMailboxPasswordTool as ToolDef,
  createAliasTool as ToolDef,

  // ─── Read-Only Reference ──────────────────────────────────────────────────
  listDomainsTool as ToolDef,
  getDomainTool as ToolDef,
  listMailboxesTool as ToolDef,
  getMailboxTool as ToolDef,
  listAliasesTool as ToolDef,

  // ─── Core Email Operations ────────────────────────────────────────────────
  listMessagesTool as ToolDef,
  getMessageTool as ToolDef,
  searchMessagesTool as ToolDef,
  markReadTool as ToolDef,
  archiveMessageTool as ToolDef,
  sendEmailTool as ToolDef,
  scheduleEmailTool as ToolDef,
  cancelScheduledTool as ToolDef,
  listOutboundTool as ToolDef,
  getOutboundTool as ToolDef,
  getAccountTool as ToolDef,
];

// Runtime validation: hard-fail on malformed tools so issues are caught at startup
for (const tool of rawTools) {
  if (!tool || typeof tool.name !== "string" || !tool.name) {
    throw new Error(`Tool registration failed: missing or invalid tool name.`);
  }
  if (typeof tool.handler !== "function") {
    throw new Error(`Tool "${tool.name}" is missing a handler function.`);
  }
  if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
    throw new Error(`Tool "${tool.name}" is missing a valid inputSchema.`);
  }
}

export const tools: Record<string, ToolDef> = {};
for (const tool of rawTools) {
  tools[tool.name] = tool;
}
