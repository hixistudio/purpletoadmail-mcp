import { createDomainTool } from "./create-domain.js";
import { createMailboxTool } from "./create-mailbox.js";
import { listMessagesTool } from "./list-messages.js";
import { getMessageTool } from "./get-message.js";
import { sendEmailTool } from "./send-email.js";
import { replyToMessageTool } from "./reply-to-message.js";
import { markReadTool } from "./mark-read.js";
import { getMailboxStatusTool } from "./get-mailbox-status.js";
import { setWebhookTool } from "./set-webhook.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export const tools: Record<string, ToolDef> = {
  [createDomainTool.name]: createDomainTool as ToolDef,
  [createMailboxTool.name]: createMailboxTool as ToolDef,
  [listMessagesTool.name]: listMessagesTool as ToolDef,
  [getMessageTool.name]: getMessageTool as ToolDef,
  [sendEmailTool.name]: sendEmailTool as ToolDef,
  [replyToMessageTool.name]: replyToMessageTool as ToolDef,
  [markReadTool.name]: markReadTool as ToolDef,
  [getMailboxStatusTool.name]: getMailboxStatusTool as ToolDef,
  [setWebhookTool.name]: setWebhookTool as ToolDef,
};
