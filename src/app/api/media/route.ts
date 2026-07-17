import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/media/access";
import type { MediaAssetSummary } from "@/lib/media/types";
import { mediaStorage } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  cursor: z.iso.datetime().optional(),
  clientId: z.uuid().optional(),
  kind: z.enum(["image", "video"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

type MediaRow = {
  id: string;
  client_id: string | null;
  original_name: string;
  mime_type: string;
  kind: "image" | "video";
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  storage_key: string;
  created_at: string;
  clients: { name: string } | { name: string }[] | null;
};

function getClientName(relation: MediaRow["clients"]) {
  if (Array.isArray(relation)) return relation[0]?.name ?? null;
  return relation?.name ?? null;
}

export async function GET(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") || undefined,
    clientId: url.searchParams.get("clientId") || undefined,
    kind: url.searchParams.get("kind") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Os filtros informados são inválidos." },
      { status: 400 },
    );
  }

  let query = access.supabase
    .from("media_assets")
    .select(
      "id, client_id, original_name, mime_type, kind, size_bytes, width, height, duration_ms, storage_key, created_at, clients(name)",
    )
    .eq("workspace_id", access.workspaceId)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit + 1);

  if (parsed.data.cursor) {
    query = query.lt("created_at", parsed.data.cursor);
  }
  if (parsed.data.clientId) {
    query = query.eq("client_id", parsed.data.clientId);
  }
  if (parsed.data.kind) {
    query = query.eq("kind", parsed.data.kind);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível carregar sua biblioteca." },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as MediaRow[];
  const hasMore = rows.length > parsed.data.limit;
  const pageRows = hasMore ? rows.slice(0, parsed.data.limit) : rows;

  try {
    const items: MediaAssetSummary[] = await Promise.all(
      pageRows.map(async (row) => ({
        id: row.id,
        clientId: row.client_id,
        clientName: getClientName(row.clients),
        originalName: row.original_name,
        mimeType: row.mime_type,
        kind: row.kind,
        sizeBytes: row.size_bytes ?? 0,
        width: row.width,
        height: row.height,
        durationMs: row.duration_ms,
        createdAt: row.created_at,
        url: await mediaStorage.createDownloadUrl(row.storage_key),
      })),
    );

    return NextResponse.json({
      items,
      nextCursor: hasMore ? pageRows.at(-1)?.created_at ?? null : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível autorizar o acesso às mídias." },
      { status: 503 },
    );
  }
}
