import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/media/access";
import { isWorkspaceMediaKey } from "@/lib/media/policy";
import { mediaStorage } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteParams) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Mídia inválida." }, { status: 400 });
  }

  const { data: asset, error: assetError } = await access.supabase
    .from("media_assets")
    .select("id, storage_key, deleted_at")
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();

  if (assetError) {
    return NextResponse.json(
      { error: "Não foi possível consultar a mídia." },
      { status: 500 },
    );
  }

  if (!asset) {
    return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
  }

  if (asset.deleted_at) {
    return NextResponse.json({ id: asset.id, deleted: true });
  }

  if (!isWorkspaceMediaKey(asset.storage_key, access.workspaceId)) {
    return NextResponse.json(
      { error: "A chave de armazenamento da mídia é inválida." },
      { status: 409 },
    );
  }

  const deletedAt = new Date().toISOString();
  const { error: updateError } = await access.supabase
    .from("media_assets")
    .update({ deleted_at: deletedAt })
    .eq("id", asset.id)
    .eq("workspace_id", access.workspaceId);

  if (updateError) {
    return NextResponse.json(
      { error: "Não foi possível remover a mídia da biblioteca." },
      { status: 500 },
    );
  }

  try {
    await mediaStorage.delete(asset.storage_key);
    return NextResponse.json({ id: asset.id, deleted: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "media_cleanup_pending",
        mediaAssetId: asset.id,
        workspaceId: access.workspaceId,
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );

    return NextResponse.json(
      { id: asset.id, deleted: true, cleanupPending: true },
      { status: 202 },
    );
  }
}
