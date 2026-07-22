import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/media/access";
import {
  resolveScheduledFor,
  schedulePostSchema,
  validatePostForPublication,
} from "@/lib/posts/scheduling";
import type { PostFormat } from "@/lib/posts/types";

export const dynamic = "force-dynamic";

type MediaRelation = {
  id: string;
  kind: "image" | "video";
  mime_type: string;
  status: "uploading" | "ready" | "failed";
  deleted_at: string | null;
};

type PostMediaRelation = {
  position: number;
  media_assets: MediaRelation | MediaRelation[] | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/posts/[id]/schedule">,
) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "A publicação informada é inválida." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schedulePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Escolha publicar agora ou informe uma data válida." }, { status: 400 });
  }

  const scheduledFor = resolveScheduledFor(parsed.data);
  if (!scheduledFor) {
    return NextResponse.json({ error: "Escolha um horário pelo menos um minuto no futuro." }, { status: 400 });
  }

  const { data, error } = await access.supabase
    .from("posts")
    .select("id, client_id, format, status, publication_cycle, post_media(position, media_assets(id, kind, mime_type, status, deleted_at))")
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Não foi possível validar a publicação." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
  if (data.status !== "draft" && data.status !== "failed") {
    return NextResponse.json({ error: "Somente rascunhos ou publicações com falha podem ser agendados." }, { status: 409 });
  }

  const { data: account, error: accountError } = await access.supabase
    .from("instagram_accounts")
    .select("id, connection_status, token_expires_at")
    .eq("workspace_id", access.workspaceId)
    .eq("client_id", data.client_id)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json({ error: "Não foi possível validar a conexão do Instagram." }, { status: 500 });
  }

  const media = [...((data.post_media ?? []) as PostMediaRelation[])]
    .sort((left, right) => left.position - right.position)
    .map((item) => firstRelation(item.media_assets))
    .filter((item): item is MediaRelation => Boolean(item));

  if (media.some((item) => item.status !== "ready" || item.deleted_at !== null)) {
    return NextResponse.json({ error: "Uma ou mais mídias ainda não estão disponíveis para publicação." }, { status: 400 });
  }

  const validationError = validatePostForPublication({
    format: data.format as PostFormat,
    media: media.map((item) => ({ id: item.id, kind: item.kind, mimeType: item.mime_type })),
    accountConnected: account?.connection_status === "connected",
    tokenExpiresAt: account?.token_expires_at ?? null,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: updated, error: updateError } = await access.supabase
    .from("posts")
    .update({
      instagram_account_id: account?.id,
      status: "scheduled",
      scheduled_for: scheduledFor,
      published_at: null,
      meta_media_id: null,
      failure_code: null,
      failure_message: null,
      next_retry_at: null,
      publication_cycle: data.status === "failed" ? data.publication_cycle + 1 : data.publication_cycle,
    })
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .in("status", ["draft", "failed"])
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: "Não foi possível agendar a publicação." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "A publicação mudou de estado. Atualize a página e tente novamente." }, { status: 409 });
  }

  return NextResponse.json({
    id,
    status: "scheduled",
    scheduledFor,
    mode: parsed.data.mode,
  });
}
