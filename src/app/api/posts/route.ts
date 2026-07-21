import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/media/access";
import { validateWorkspaceClient } from "@/lib/media/access";
import { mediaStorage } from "@/lib/storage/r2";
import { savePostDraftSchema, validateDraftMedia } from "@/lib/posts/draft";
import {
  POST_STATUSES,
  type OperationalPost,
  type OperationalPostMedia,
  type PostFormat,
  type PostListResponse,
  type PostStatus,
  type SavePostDraftResponse,
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
  kind: "image" | "video";
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

function orderedMedia(row: PostRow) {
  return [...(row.post_media ?? [])].sort(
    (left, right) => left.position - right.position,
  ).map((item) => firstRelation(item.media_assets)).filter((item): item is MediaRelation => Boolean(item));
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
      "id, client_id, format, status, caption, first_comment, scheduled_for, published_at, created_at, updated_at, failure_code, failure_message, clients(id, name, instagram_handle, brand_color), post_media(position, media_assets(id, original_name, storage_key, kind))",
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
      const mediaRows = orderedMedia(row);
      const media = (await Promise.all(mediaRows.map(async (item): Promise<OperationalPostMedia | null> => {
        try {
          return {
            id: item.id,
            originalName: item.original_name,
            kind: item.kind,
            url: await mediaStorage.createDownloadUrl(item.storage_key),
          };
        } catch {
          return null;
        }
      }))).filter((item): item is OperationalPostMedia => Boolean(item));
      const firstMedia = media[0] ?? null;

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
        thumbnailUrl: firstMedia?.url ?? null,
        mediaName: firstMedia?.originalName ?? null,
        media,
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

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null);
  const parsed = savePostDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revise os dados do rascunho e tente novamente." },
      { status: 400 },
    );
  }

  const draft = parsed.data;
  if (!await validateWorkspaceClient(access.supabase, access.workspaceId, draft.clientId)) {
    return NextResponse.json(
      { error: "O cliente selecionado não pertence a este workspace." },
      { status: 400 },
    );
  }

  const { data: mediaRows, error: mediaError } = draft.mediaIds.length > 0
    ? await access.supabase
        .from("media_assets")
        .select("id, client_id, kind, mime_type")
        .eq("workspace_id", access.workspaceId)
        .eq("status", "ready")
        .is("deleted_at", null)
        .in("id", draft.mediaIds)
    : { data: [], error: null };

  if (mediaError) {
    return NextResponse.json(
      { error: "Não foi possível validar as mídias selecionadas." },
      { status: 500 },
    );
  }

  const mediaValidationError = validateDraftMedia(
    draft,
    (mediaRows ?? []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      kind: row.kind,
      mimeType: row.mime_type,
    })),
  );
  if (mediaValidationError) {
    return NextResponse.json({ error: mediaValidationError }, { status: 400 });
  }

  const { data: account } = await access.supabase
    .from("instagram_accounts")
    .select("id")
    .eq("workspace_id", access.workspaceId)
    .eq("client_id", draft.clientId)
    .eq("connection_status", "connected")
    .maybeSingle();

  const { data: post, error: postError } = await access.supabase
    .from("posts")
    .insert({
      workspace_id: access.workspaceId,
      client_id: draft.clientId,
      instagram_account_id: account?.id ?? null,
      created_by: access.user.id,
      format: draft.format,
      status: "draft",
      caption: draft.caption,
      first_comment: draft.firstComment,
    })
    .select("id, updated_at")
    .single();

  if (postError) {
    return NextResponse.json(
      { error: "Não foi possível criar o rascunho." },
      { status: 500 },
    );
  }

  if (draft.mediaIds.length > 0) {
    const { error } = await access.supabase.from("post_media").insert(
      draft.mediaIds.map((mediaAssetId, position) => ({
        post_id: post.id,
        media_asset_id: mediaAssetId,
        position,
      })),
    );
    if (error) {
      await access.supabase.from("posts").delete().eq("id", post.id);
      return NextResponse.json(
        { error: "Não foi possível associar as mídias ao rascunho." },
        { status: 500 },
      );
    }
  }

  const response: SavePostDraftResponse = {
    id: post.id,
    updatedAt: post.updated_at,
  };
  return NextResponse.json(response, { status: 201 });
}
