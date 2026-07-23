import type { NotificationMetadata } from "@/lib/notifications/types";

const RETRYABLE_EMAIL_CODES = new Set([
  "E_RATE_LIMIT_EXCEEDED",
  "E_DELIVERY_FAILED",
  "E_INTERNAL_SERVER_ERROR",
]);

const KNOWN_EMAIL_CODES = new Set([
  ...RETRYABLE_EMAIL_CODES,
  "E_VALIDATION_ERROR",
  "E_FIELD_MISSING",
  "E_TOO_MANY_RECIPIENTS",
  "E_SENDER_NOT_VERIFIED",
  "E_RECIPIENT_NOT_ALLOWED",
  "E_RECIPIENT_SUPPRESSED",
  "E_SENDER_DOMAIN_NOT_AVAILABLE",
  "E_CONTENT_TOO_LARGE",
  "E_DAILY_LIMIT_EXCEEDED",
  "E_HEADER_NOT_ALLOWED",
  "E_HEADER_USE_API_FIELD",
  "E_HEADER_VALUE_INVALID",
  "E_HEADER_VALUE_TOO_LONG",
  "E_HEADER_NAME_INVALID",
  "E_HEADERS_TOO_LARGE",
  "E_HEADERS_TOO_MANY",
]);

export function escapeNotificationHtml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] ?? character);
}

export function notificationTargetView(metadata: NotificationMetadata) {
  return metadata.view === "clients" ? "clients" as const : "calendar" as const;
}

export function buildNotificationEmail(input: {
  title: string;
  body: string;
  appUrl: string;
}) {
  const title = escapeNotificationHtml(input.title);
  const body = escapeNotificationHtml(input.body);
  const appUrl = escapeNotificationHtml(new URL(input.appUrl).toString());

  return {
    subject: `[Voha] ${input.title}`,
    text: `${input.title}\n\n${input.body}\n\nAbra o Voha para revisar: ${input.appUrl}`,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f2ee;color:#252329;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 18px"><div style="border:1px solid #252329;background:#fff;box-shadow:4px 4px 0 #252329"><div style="padding:18px 20px;border-bottom:1px solid #ddd6ce;color:#ff5c45;font-weight:700">VOHA</div><div style="padding:24px 20px"><h1 style="margin:0 0 12px;font-size:20px">${title}</h1><p style="margin:0 0 22px;color:#625e66;line-height:1.55">${body}</p><a href="${appUrl}" style="display:inline-block;border:1px solid #252329;background:#ff5c45;color:#fff;padding:11px 15px;text-decoration:none;font-weight:700;box-shadow:2px 2px 0 #252329">Abrir no Voha</a></div></div></div></body></html>`,
  };
}

export function sanitizeEmailError(error: unknown) {
  const providerCode = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  const code = KNOWN_EMAIL_CODES.has(providerCode) ? providerCode : "email_send_failed";
  return {
    code,
    retryable: RETRYABLE_EMAIL_CODES.has(code),
  };
}
