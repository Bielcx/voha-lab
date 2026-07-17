import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/media/access";
import {
  isWorkspaceMediaKey,
  validateUploadCandidate,
} from "@/lib/media/policy";
import { mediaStorage } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const metadataSchema = z
  .object({
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    durationMs: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

type RouteParams = {
  params: Promise<{ id: string }>;
};

function isMissingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const metadata = "$metadata" in error ? error.$metadata : null;
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404
  );
}

export async function POST(request: Request, context: RouteParams) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Mídia inválida." }, { status: 400 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { error: "Os metadados da mídia são inválidos." },
      { status: 400 },
    );
  }

  const parsed = metadataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Os metadados da mídia são inválidos." },
      { status: 400 },
    );
  }

  const { data: asset, error: assetError } = await access.supabase
    .from("media_assets")
    .select(
      "id, workspace_id, storage_key, original_name, mime_type, size_bytes, status, deleted_at",
    )
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();

  if (assetError) {
    return NextResponse.json(
      { error: "Não foi possível consultar a mídia." },
      { status: 500 },
    );
  }

  if (!asset || asset.deleted_at) {
    return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
  }

  if (!isWorkspaceMediaKey(asset.storage_key, access.workspaceId)) {
    return NextResponse.json(
      { error: "A chave de armazenamento da mídia é inválida." },
      { status: 409 },
    );
  }

  try {
    const stored = await mediaStorage.getMetadata(asset.storage_key);
    const validation = validateUploadCandidate({
      fileName: asset.original_name,
      contentType: stored.contentType ?? asset.mime_type,
      sizeBytes: stored.sizeBytes,
    });

    if (
      !validation.valid ||
      stored.contentType !== asset.mime_type ||
      (asset.size_bytes !== null && stored.sizeBytes !== asset.size_bytes)
    ) {
      await mediaStorage.delete(asset.storage_key);
      await access.supabase
        .from("media_assets")
        .update({ status: "failed" })
        .eq("id", asset.id)
        .eq("workspace_id", access.workspaceId);

      return NextResponse.json(
        {
          error:
            validation.valid
              ? "O arquivo enviado não corresponde à autorização original."
              : validation.error,
        },
        { status: 422 },
      );
    }

    const { error: updateError } = await access.supabase
      .from("media_assets")
      .update({
        status: "ready",
        size_bytes: stored.sizeBytes,
        width: parsed.data.width ?? null,
        height: parsed.data.height ?? null,
        duration_ms: parsed.data.durationMs ?? null,
        checksum: stored.eTag,
      })
      .eq("id", asset.id)
      .eq("workspace_id", access.workspaceId);

    if (updateError) {
      return NextResponse.json(
        { error: "O upload terminou, mas não foi possível confirmar a mídia." },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: asset.id, status: "ready" });
  } catch (error) {
    return NextResponse.json(
      {
        error: isMissingObject(error)
          ? "O arquivo ainda não foi encontrado no armazenamento."
          : "Não foi possível confirmar o arquivo enviado.",
      },
      { status: isMissingObject(error) ? 409 : 503 },
    );
  }
}
