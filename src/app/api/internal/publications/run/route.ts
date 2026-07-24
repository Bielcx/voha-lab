import { NextResponse } from "next/server";

import { getPublicationEngineEnv } from "@/lib/env/server";
import { constantTimeEqual } from "@/lib/instagram/crypto";
import { runDuePublications } from "@/lib/instagram/publication-engine";
import {
  deliverPendingNotificationEmails,
  generateConnectionExpiringNotifications,
} from "@/lib/notifications/service";
import { runOperationalMaintenance } from "@/lib/operations/maintenance";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const providedSecret = request.headers.get("x-voha-cron-secret") ?? "";
  const expectedSecret = getPublicationEngineEnv().VOHA_CRON_SECRET;
  if (!constantTimeEqual(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const runId = crypto.randomUUID();
  const maintenanceRequested =
    new URL(request.url).searchParams.get("maintenance") === "1";
  const startedAt = Date.now();
  let stage = "publications";
  try {
    const result = await runDuePublications(3);
    stage = "connection_notifications";
    const connectionNotifications = await generateConnectionExpiringNotifications();
    stage = "notification_emails";
    const email = await deliverPendingNotificationEmails(3);
    stage = "maintenance";
    const maintenance = maintenanceRequested
      ? await runOperationalMaintenance()
      : null;
    console.log(JSON.stringify({
      event: "operational_cron_completed",
      runId,
      durationMs: Date.now() - startedAt,
      claimed: result.claimed,
      published: result.published,
      failed: result.failed,
      connectionNotifications,
      emailEnabled: email.enabled,
      emailsClaimed: email.claimed,
      emailsSent: email.sent,
      emailsFailed: email.failed,
      maintenance,
    }));
    return NextResponse.json({
      runId,
      claimed: result.claimed,
      published: result.published,
      failed: result.failed,
      notifications: connectionNotifications,
      emails: {
        enabled: email.enabled,
        claimed: email.claimed,
        sent: email.sent,
        failed: email.failed,
      },
      maintenance,
    });
  } catch {
    console.error(JSON.stringify({
      event: "operational_cron_failed",
      runId,
      stage,
      durationMs: Date.now() - startedAt,
    }));
    return NextResponse.json(
      { error: "Falha ao executar as rotinas operacionais.", runId },
      { status: 500 },
    );
  }
}
