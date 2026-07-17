import "server-only";

import { NextResponse } from "next/server";

import {
  canEditMedia,
  type WorkspaceRole,
} from "@/lib/media/policy";
import { createClient } from "@/lib/supabase/server";

export async function requireWorkspaceAccess(options?: {
  editor?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      ),
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Não foi possível consultar seu workspace." },
        { status: 500 },
      ),
    };
  }

  if (!membership) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Nenhum workspace foi encontrado para esta conta." },
        { status: 403 },
      ),
    };
  }

  const role = membership.role as WorkspaceRole;
  if (options?.editor && !canEditMedia(role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Você não possui permissão para alterar mídias." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    supabase,
    user,
    workspaceId: membership.workspace_id as string,
    role,
  };
}

export async function validateWorkspaceClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  clientId: string | null | undefined,
) {
  if (!clientId) return true;

  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  return !error && Boolean(data);
}
