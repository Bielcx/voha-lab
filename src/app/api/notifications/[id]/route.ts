import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAccess } from "@/lib/media/access";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Notificação inválida." }, { status: 400 });
  }

  const { data, error } = await access.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .eq("user_id", access.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Não foi possível atualizar a notificação." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
