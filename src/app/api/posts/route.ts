import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/media/access";
import { mediaStorage } from "@/lib/storage/r2";
import {
  POST_STATUSES,
  type OperationalPost,
  type PostFormat,
  type PostListResponse,
  type PostStatus,
} from "@/lib/posts/types";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
    clientId: z.uuid().optional(),
    status: z.enum(POST_STATUSES).optional(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .refine((value) => Boolean(value.from) === Boolean(value.to), {
    message: "O intervalo precisa de início e fim.",
  });

type ClientRelation = {
  id: string;
  name: string;
  instagram_handle: string | null;
  brand_color: string | null;
};

type MediaRelation = {
  id: string;
  original_name: string;
  storage_key: string;
};

type PostMediaRelation = {
  position: number;
  media_assets: MediaRelation | MediaRelation[] | null;
};

type PostRow = {
  id: string;
  client_id: string;
  format: PostFormat;
  status: PostStatus;
  caption: string;
  first_comment: string;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  failure_code: string | null;
  failure_message: string | null;
  clients: ClientRelation | ClientRelation[] | null;
  post_media: PostMediaRelation[] | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

function firstMedia(row: PostRow) {
  const sorted = [...(row.post_media ?? [])].sort(
    (left, right) => left.position - right.position,
  );
  return firstRelation(sorted[0]?.media_assets);
}

export async function GET(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    clientId: url.searchParams.get("clientId") || undefined,
    status: url.searchParams.get("status") || undefined,
    offset: url.searchParams.get("offset") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Os filtros de publicações são inválidos." },
      { status: 400 },
    );
  }

  const { from, to, clientId, status, offset, limit } = parsed.data;
  let query = access.supabase
    .from("posts")
    .select(
      "id, client_id, format, status, caption, first_comment, scheduled_for, published_at, created_at, updated_at, failure_code, failure_message, clients(id, name, instagram_handle, brand_color), post_media(position, media_assets(id, original_name, storage_key))",
      { count: "exact" },
    )
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (clientId) query = query.eq("client_id", clientId);
  if (status) query = query.eq("status", status);
  if (from && to) {
    query = query.or(
      `and(scheduled_for.gte.${from},scheduled_for.lt.${to}),and(published_at.gte.${from},published_at.lt.${to}),and(created_at.gte.${from},created_at.lt.${to})`,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível carregar suas publicações." },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as PostRow[];
  const items: OperationalPost[] = await Promise.all(
    rows.map(async (row) => {
      const client = firstRelation(row.clients);
      const media = firstMedia(row);
      let thumbnailUrl: string | null = null;

      if (media) {
        try {
          thumbnailUrl = await mediaStorage.createDownloadUrl(media.storage_key);
        } catch {
          // A post remains useful when a temporary thumbnail URL cannot be signed.
        }
      }

      return {
        id: row.id,
        clientId: row.client_id,
        clientName: client?.name ?? "Cliente removido",
        clientHandle: client?.instagram_handle ?? null,
        clientColor: client?.brand_color ?? "#747078",
        format: row.format,
        status: row.status,
        caption: row.caption,
        firstComment: row.first_comment,
        scheduledFor: row.scheduled_for,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        failureCode: row.failure_code,
        failureMessage: row.failure_message,
        thumbnailUrl,
        mediaName: media?.original_name ?? null,
      };
    }),
  );

  const total = count ?? items.length;
  const response: PostListResponse = {
    items,
    nextOffset: offset + items.length < total ? offset + items.length : null,
    total,
  };

  return NextResponse.json(response);
}
