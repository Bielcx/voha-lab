import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createApprovalToken,
  hashApprovalToken,
  requestApprovalSchema,
} from "@/lib/approvals/policy";
import type { RequestApprovalResponse } from "@/lib/approvals/types";
import { getPublicEnv } from "@/lib/env/public";
import { requireWorkspaceAccess } from "@/lib/media/access";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: RouteContext<"/api/posts/[id]/approval">,
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

  const body = await request.json().catch(() => null);
  const parsed = requestApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revise os dados da aprovação e tente novamente." },
      { status: 400 },
    );
  }

  const { data: post, error: postError } = await access.supabase
    .from("posts")
    .select("id, status, post_media(media_asset_id)")
    .eq("id", id)
    .eq("workspace_id", access.workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (postError) {
    return NextResponse.json(
      { error: "Não foi possível validar o conteúdo." },
      { status: 500 },
    );
  }
  if (!post) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }
  if (post.status !== "draft" && post.status !== "pending_approval") {
    return NextResponse.json(
      { error: "Este conteúdo não pode ser enviado para aprovação agora." },
      { status: 409 },
    );
  }
  if (!post.post_media?.length) {
    return NextResponse.json(
      { error: "Adicione pelo menos uma mídia antes de pedir aprovação." },
      { status: 400 },
    );
  }

  const rawToken = createApprovalToken();
  const tokenHash = await hashApprovalToken(rawToken);
  const expiresAt = new Date(
    Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1_000,
  ).toISOString();
  const { data: approvalId, error } = await access.supabase.rpc(
    "request_post_approval",
    {
      target_post_id: id,
      target_token_hash: tokenHash,
      target_approver_name: parsed.data.approverName,
      target_approver_email: parsed.data.approverEmail,
      target_expires_at: expiresAt,
    },
  );

  if (error || !approvalId) {
    return NextResponse.json(
      { error: "Não foi possível criar o link de aprovação." },
      { status: 409 },
    );
  }

  const baseUrl = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const response: RequestApprovalResponse = {
    approvalId: approvalId as string,
    approvalUrl: `${baseUrl}/aprovar/${rawToken}`,
    expiresAt,
  };
  return NextResponse.json(response, {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
}
