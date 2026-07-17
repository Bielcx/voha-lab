import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/media/access";

export const dynamic = "force-dynamic";

type PostMediaRow = {
  media_asset_id: string;
  position: number;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "A publicação informada é inválida." },
      { status: 400 },
    );
  }

  const { data: source, error: sourceError } = await access.supabase
    .from("posts")
    .select(
      "client_id, instagram_account_id, format, caption, first_comment, post_media(media_asset_id, position)",
    )
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (sourceError) {
    return NextResponse.json(
      { error: "Não foi possível consultar a publicação." },
      { status: 500 },
    );
  }
  if (!source) {
    return NextResponse.json(
      { error: "A publicação não foi encontrada." },
      { status: 404 },
    );
  }

  const { post_media: postMedia, ...postFields } = source as typeof source & {
    post_media: PostMediaRow[] | null;
  };
  const { data: duplicate, error: duplicateError } = await access.supabase
    .from("posts")
    .insert({
      ...postFields,
      workspace_id: access.workspaceId,
      created_by: access.user.id,
      status: "draft",
      scheduled_for: null,
      published_at: null,
      meta_media_id: null,
      failure_code: null,
      failure_message: null,
    })
    .select("id")
    .single();

  if (duplicateError) {
    return NextResponse.json(
      { error: "Não foi possível duplicar a publicação." },
      { status: 500 },
    );
  }

  const mediaRows = (postMedia ?? []).map((media) => ({
    post_id: duplicate.id,
    media_asset_id: media.media_asset_id,
    position: media.position,
  }));

  if (mediaRows.length > 0) {
    const { error: mediaError } = await access.supabase
      .from("post_media")
      .insert(mediaRows);

    if (mediaError) {
      await access.supabase.from("posts").delete().eq("id", duplicate.id);
      return NextResponse.json(
        { error: "Não foi possível copiar as mídias da publicação." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ id: duplicate.id }, { status: 201 });
}
