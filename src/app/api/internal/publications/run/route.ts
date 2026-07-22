import { NextResponse } from "next/server";

import { constantTimeEqual } from "@/lib/instagram/crypto";
import { getPublicationEngineEnv } from "@/lib/env/server";
import { runDuePublications } from "@/lib/instagram/publication-engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const providedSecret = request.headers.get("x-voha-cron-secret") ?? "";
  const expectedSecret = getPublicationEngineEnv().VOHA_CRON_SECRET;
  if (!constantTimeEqual(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runDuePublications(3);
    console.log(JSON.stringify({
      event: "publication_cron_completed",
      claimed: result.claimed,
      published: result.published,
      failed: result.failed,
    }));
    return NextResponse.json({
      claimed: result.claimed,
      published: result.published,
      failed: result.failed,
    });
  } catch {
    console.error(JSON.stringify({ event: "publication_cron_failed" }));
    return NextResponse.json({ error: "Falha ao executar a fila de publicações." }, { status: 500 });
  }
}
