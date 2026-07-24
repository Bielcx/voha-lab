import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireWorkspaceAccess,
  validateWorkspaceClient,
} from "@/lib/media/access";
import {
  validateUploadCandidate,
  validateWorkspaceUploadCapacity,
} from "@/lib/media/policy";
import { mediaStorage } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const uploadRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(180),
    contentType: z.string().trim().min(1).max(100),
    sizeBytes: z.number().int().positive(),
    clientId: z.uuid().nullable().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler os dados do arquivo." },
      { status: 400 },
    );
  }

  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Os dados do arquivo são inválidos." },
      { status: 400 },
    );
  }

  const validation = validateUploadCandidate(parsed.data);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const clientIsValid = await validateWorkspaceClient(
    access.supabase,
    access.workspaceId,
    parsed.data.clientId,
  );

  if (!clientIsValid) {
    return NextResponse.json(
      { error: "O cliente selecionado não pertence ao seu workspace." },
      { status: 422 },
    );
  }

  const { data: usageRows, error: usageError } = await access.supabase
    .from("media_assets")
    .select("size_bytes")
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .in("status", ["uploading", "ready"]);

  if (usageError) {
    return NextResponse.json(
      { error: "Não foi possível verificar o espaço disponível." },
      { status: 500 },
    );
  }

  const currentUsageBytes = (usageRows ?? []).reduce(
    (total, asset) => total + (asset.size_bytes ?? 0),
    0,
  );
  const capacity = validateWorkspaceUploadCapacity(
    currentUsageBytes,
    parsed.data.sizeBytes,
  );

  if (!capacity.valid) {
    return NextResponse.json({ error: capacity.error }, { status: 413 });
  }

  try {
    const authorization = await mediaStorage.createUploadUrl({
      workspaceId: access.workspaceId,
      fileName: parsed.data.fileName,
      contentType: validation.contentType,
    });

    const { data: asset, error: insertError } = await access.supabase
      .from("media_assets")
      .insert({
        workspace_id: access.workspaceId,
        client_id: parsed.data.clientId ?? null,
        created_by: access.user.id,
        storage_key: authorization.key,
        original_name: parsed.data.fileName,
        mime_type: validation.contentType,
        kind: validation.kind,
        size_bytes: parsed.data.sizeBytes,
        status: "uploading",
      })
      .select("id")
      .single();

    if (insertError || !asset) {
      console.error(
        JSON.stringify({
          event: "media_asset_insert_failed",
          code: insertError?.code ?? "missing_asset",
          message: insertError?.message ?? "Insert returned no asset",
          details: insertError?.details ?? null,
          hint: insertError?.hint ?? null,
        }),
      );

      return NextResponse.json(
        { error: "Não foi possível preparar o envio da mídia." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        assetId: asset.id,
        uploadUrl: authorization.uploadUrl,
        expiresAt: authorization.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "O armazenamento de mídias está temporariamente indisponível." },
      { status: 503 },
    );
  }
}
