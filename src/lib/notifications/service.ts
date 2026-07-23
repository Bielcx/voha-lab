import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import { getNotificationEmailEnv } from "@/lib/env/server";
import {
  buildNotificationEmail,
  sanitizeEmailError,
} from "@/lib/notifications/policy";
import { createAdminClient } from "@/lib/supabase/admin";

const emailClaimSchema = z.object({
  notification_id: z.uuid(),
  user_id: z.uuid(),
  title: z.string(),
  body: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  claim_token: z.uuid(),
  attempt_number: z.number().int().min(1).max(3),
});

type EmailClaim = z.infer<typeof emailClaimSchema>;

async function finishEmail(
  admin: ReturnType<typeof createAdminClient>,
  claim: EmailClaim,
  input: { succeeded: boolean; errorCode?: string; retryable?: boolean },
) {
  const { data, error } = await admin.rpc("finish_notification_email", {
    target_notification_id: claim.notification_id,
    target_claim_token: claim.claim_token,
    target_succeeded: input.succeeded,
    target_error_code: input.errorCode ?? null,
    target_retryable: input.retryable ?? false,
  });
  if (error || data !== true) throw new Error("notification_email_completion_failed");
}

export async function generateConnectionExpiringNotifications() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("generate_connection_expiring_notifications", {
    threshold_days: 7,
  });
  if (error) throw new Error("connection_notification_generation_failed");
  return typeof data === "number" ? data : 0;
}

export async function deliverPendingNotificationEmails(requestedLimit = 3) {
  const emailEnv = getNotificationEmailEnv();
  if (!emailEnv.ALERT_EMAIL_FROM) {
    return { enabled: false, claimed: 0, sent: 0, failed: 0 };
  }
  if (!emailEnv.NEXT_PUBLIC_APP_URL) {
    throw new Error("notification_email_app_url_missing");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_emails", {
    requested_limit: requestedLimit,
  });
  if (error) throw new Error("notification_email_claim_failed");

  const claims = z.array(emailClaimSchema).parse(data ?? []);
  const { env } = await getCloudflareContext({ async: true });
  let sent = 0;
  let failed = 0;

  for (const claim of claims) {
    const userResult = await admin.auth.admin.getUserById(claim.user_id);
    const recipient = userResult.data.user?.email;
    if (!recipient) {
      await finishEmail(admin, claim, {
        succeeded: false,
        errorCode: "notification_recipient_missing",
        retryable: false,
      });
      failed += 1;
      continue;
    }

    const content = buildNotificationEmail({
      title: claim.title,
      body: claim.body,
      appUrl: emailEnv.NEXT_PUBLIC_APP_URL,
    });

    try {
      await env.EMAIL.send({
        to: recipient,
        from: { email: emailEnv.ALERT_EMAIL_FROM, name: "Voha" },
        subject: content.subject,
        text: content.text,
        html: content.html,
        headers: { "X-Voha-Notification-ID": claim.notification_id },
      });
      await finishEmail(admin, claim, { succeeded: true });
      sent += 1;
      console.log(JSON.stringify({
        event: "notification_email_sent",
        notificationId: claim.notification_id,
        attempt: claim.attempt_number,
      }));
    } catch (sendError) {
      const safeError = sanitizeEmailError(sendError);
      await finishEmail(admin, claim, {
        succeeded: false,
        errorCode: safeError.code,
        retryable: safeError.retryable,
      });
      failed += 1;
      console.error(JSON.stringify({
        event: "notification_email_failed",
        notificationId: claim.notification_id,
        attempt: claim.attempt_number,
        code: safeError.code,
        retryable: safeError.retryable,
      }));
    }
  }

  return {
    enabled: true,
    claimed: claims.length,
    sent,
    failed,
  };
}
