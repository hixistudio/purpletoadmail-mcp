// CHECKPOINT: PRD-06 FR-6.3.1 / FR-6.3.2 Shared validation helpers and structured error formatting used by all tools.

/**
 * Shared validation utilities for PurpleToad MCP tools.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return typeof email === "string" && email.length > 0 && email.length <= 254 && EMAIL_REGEX.test(email);
}

export function validateEmailList(emails: unknown, fieldName: string): { valid: true; emails: string[] } | { valid: false; error: string } {
  if (!Array.isArray(emails) || emails.length === 0) {
    return { valid: false, error: `'${fieldName}' must be a non-empty array of email addresses.` };
  }
  for (const email of emails) {
    if (!isValidEmail(email as string)) {
      return { valid: false, error: `Invalid email address in '${fieldName}': "${email}"` };
    }
  }
  return { valid: true, emails: emails as string[] };
}

export function validateSubject(subject: unknown): { valid: true; subject: string } | { valid: false; error: string } {
  if (typeof subject !== "string" || subject.length === 0) {
    return { valid: false, error: "'subject' is required and must be a non-empty string." };
  }
  if (subject.length > 998) {
    return { valid: false, error: "'subject' must not exceed 998 characters." };
  }
  return { valid: true, subject };
}
