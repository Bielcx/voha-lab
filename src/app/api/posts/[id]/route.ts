import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess, validateWorkspaceClient } from "@/lib/media/access";
import { savePostDraftSchema, validateDraftMedia } from "@/lib/posts/draft";
import type {
  PostDraft,
  PostDraftMedia,
  PostFormat,
  PostStatus,
  SavePostDraftResponse,
} from "@/lib/posts/types";
import { mediaStorage } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

type MediaRelation = {
  id: string;
  client_id: string | null;
  original_name: string;
  mime_type: string;
  kind: "image" | "video";
  width: number | null;
  height: number | null;
  duration_ms: number | null;
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
  created_at: string;
  updated_at: string;
  post_media: PostMediaRelation[] | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

async function readPostDraft(
  access: Extract<Awaited<ReturnType<typeof requireWorkspaceAccess>>, { ok: true }>,
  id: string,
) {
  const { data, error } = await access.supabase
    .from("posts")
    .select("id, client_id, format, status, caption, first_comment, created_at, updated_at, post_media(position, media_assets(id, client_id, original_name, mime_type, kind, width, height, duration_ms, storage_key))")
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { error: "Não foi possível carregar o rascunho." } as const;
  if (!data) return { missing: true } as const;

  const row = data as PostRow;
  const mediaRelations = [...(row.post_media ?? [])]
    .sort((left, right) => left.position - right.position)
    .map((item) => firstRelation(item.media_assets))
    .filter((item): item is MediaRelation => Boolean(item));

  try {
    const media: PostDraftMedia[] = await Promise.all(mediaRelations.map(async (item) => ({
      id: item.id,
      clientId: item.client_id,
      originalName: item.original_name,
      mimeType: item.mime_type,
      kind: item.kind,
      width: item.width,
      height: item.height,
      durationMs: item.duration_ms,
      url: await mediaStorage.createDownloadUrl(item.storage_key),
    })));

    const post: PostDraft = {
      id: row.id,
      clientId: row.client_id,
      format: row.format,
      status: row.status,
      caption: row.caption,
      firstComment: row.first_comment,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      media,
    };
    return { post } as const;
  } catch {
    return { error: "Não foi possível autorizar o acesso às mídias do rascunho." } as const;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "O rascunho informado é inválido." }, { status: 400 });
  }

  const result = await readPostDraft(access, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  if ("missing" in result) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  return NextResponse.json(result.post);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "O rascunho informado é inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = savePostDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados do rascunho e tente novamente." }, { status: 400 });
  }
  const draft = parsed.data;

  const { data: existing, error: existingError } = await access.supabase
    .from("posts")
    .select("id, status, post_media(media_asset_id, position)")
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Não foi possível consultar o rascunho." }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Somente rascunhos podem ser alterados neste fluxo." }, { status: 409 });
  }

  if (!await validateWorkspaceClient(access.supabase, access.workspaceId, draft.clientId)) {
    return NextResponse.json({ error: "O cliente selecionado não pertence a este workspace." }, { status: 400 });
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
  if (mediaError) return NextResponse.json({ error: "Não foi possível validar as mídias selecionadas." }, { status: 500 });

  const mediaValidationError = validateDraftMedia(draft, (mediaRows ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    kind: row.kind,
    mimeType: row.mime_type,
  })));
  if (mediaValidationError) return NextResponse.json({ error: mediaValidationError }, { status: 400 });

  const { data: account } = await access.supabase
    .from("instagram_accounts")
    .select("id")
    .eq("workspace_id", access.workspaceId)
    .eq("client_id", draft.clientId)
    .eq("connection_status", "connected")
    .maybeSingle();

  const oldMedia = (existing.post_media ?? []) as { media_asset_id: string; position: number }[];
  const { error: postError } = await access.supabase
    .from("posts")
    .update({
      client_id: draft.clientId,
      instagram_account_id: account?.id ?? null,
      format: draft.format,
      caption: draft.caption,
      first_comment: draft.firstComment,
    })
    .eq("id", id)
    .eq("workspace_id", access.workspaceId);
  if (postError) return NextResponse.json({ error: "Não foi possível salvar o rascunho." }, { status: 500 });

  const { error: deleteError } = await access.supabase.from("post_media").delete().eq("post_id", id);
  if (deleteError) return NextResponse.json({ error: "Não foi possível atualizar as mídias do rascunho." }, { status: 500 });

  if (draft.mediaIds.length > 0) {
    const { error: insertError } = await access.supabase.from("post_media").insert(
      draft.mediaIds.map((mediaAssetId, position) => ({ post_id: id, media_asset_id: mediaAssetId, position })),
    );
    if (insertError) {
      if (oldMedia.length > 0) {
        await access.supabase.from("post_media").insert(oldMedia.map((item) => ({ post_id: id, ...item })));
      }
      return NextResponse.json({ error: "Não foi possível ordenar as mídias do rascunho." }, { status: 500 });
    }
  }

  const { data: saved, error: savedError } = await access.supabase
    .from("posts")
    .select("updated_at")
    .eq("id", id)
    .single();
  if (savedError) return NextResponse.json({ error: "O rascunho foi salvo, mas não foi possível confirmar a atualização." }, { status: 500 });

  const response: SavePostDraftResponse = { id, updatedAt: saved.updated_at };
  return NextResponse.json(response);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "O rascunho informado é inválido." }, { status: 400 });
  }

  const { data: post, error: queryError } = await access.supabase
    .from("posts")
    .select("id, status")
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (queryError) return NextResponse.json({ error: "Não foi possível consultar o rascunho." }, { status: 500 });
  if (!post) return NextResponse.json({ error: "Rascunho não encontrado." }, { status: 404 });
  if (post.status !== "draft") {
    return NextResponse.json({ error: "Somente rascunhos podem ser excluídos por aqui." }, { status: 409 });
  }

  const { error: deleteError } = await access.supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .eq("status", "draft");
  if (deleteError) return NextResponse.json({ error: "Não foi possível excluir o rascunho." }, { status: 500 });

  return NextResponse.json({ id, deleted: true });
}
