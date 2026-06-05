import { createDomainTool } from "./create-domain.js";
import { listDomainsTool } from "./list-domains.js";
import { getDomainTool } from "./get-domain.js";
import { listMailboxesTool } from "./list-mailboxes.js";
import { getMailboxTool } from "./get-mailbox.js";
import { listAliasesTool } from "./list-aliases.js";
import { listMessagesTool } from "./list-messages.js";
import { getMessageTool } from "./get-message.js";
import { searchMessagesTool } from "./search-messages.js";
import { markReadTool } from "./mark-read.js";
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

export const tools: Record<string, ToolDef> = {
  // ─── Domain Setup (selling point) ─────────────────────────────────────────
  [createDomainTool.name]: createDomainTool as ToolDef,

  // ─── Read-Only Reference ──────────────────────────────────────────────────
  [listDomainsTool.name]: listDomainsTool as ToolDef,
  [getDomainTool.name]: getDomainTool as ToolDef,
  [listMailboxesTool.name]: listMailboxesTool as ToolDef,
  [getMailboxTool.name]: getMailboxTool as ToolDef,
  [listAliasesTool.name]: listAliasesTool as ToolDef,

  // ─── Core Email Operations ────────────────────────────────────────────────
  [listMessagesTool.name]: listMessagesTool as ToolDef,
  [getMessageTool.name]: getMessageTool as ToolDef,
  [searchMessagesTool.name]: searchMessagesTool as ToolDef,
  [markReadTool.name]: markReadTool as ToolDef,
  [sendEmailTool.name]: sendEmailTool as ToolDef,
  [scheduleEmailTool.name]: scheduleEmailTool as ToolDef,
  [cancelScheduledTool.name]: cancelScheduledTool as ToolDef,
  [listOutboundTool.name]: listOutboundTool as ToolDef,
  [getOutboundTool.name]: getOutboundTool as ToolDef,
  [getAccountTool.name]: getAccountTool as ToolDef,
};
