import { NextResponse } from "next/server";

import {
  R2_FREE_TIER_STORAGE_BYTES,
  WORKSPACE_MEDIA_LIMIT_BYTES,
} from "@/lib/media/policy";
import { requireWorkspaceAccess } from "@/lib/media/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { data, error } = await access.supabase
    .from("media_assets")
    .select("size_bytes")
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .in("status", ["uploading", "ready"]);

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível calcular o uso de armazenamento." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    usedBytes: (data ?? []).reduce(
      (total, asset) => total + (asset.size_bytes ?? 0),
      0,
    ),
    limitBytes: WORKSPACE_MEDIA_LIMIT_BYTES,
    freeTierBytes: R2_FREE_TIER_STORAGE_BYTES,
  });
}
