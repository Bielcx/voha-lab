import { NextResponse } from "next/server";

import {
  R2_FREE_TIER_STORAGE_BYTES,
  WORKSPACE_MEDIA_LIMIT_BYTES,
} from "@/lib/media/policy";
import { createClient } from "@/lib/supabase/server";

const WORKSPACE = {
  name: "Larissa Cruz",
  slug: "larissa-cruz",
  timezone: "America/Sao_Paulo",
} as const;

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function buildBootstrapResult(
  supabase: ServerSupabaseClient,
  user: { id: string; email?: string },
  workspaceId: string,
) {
  const [
    { data: workspace, error: workspaceError },
    { data: profile, error: profileError },
    { data: mediaRows, error: mediaError },
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name, timezone")
      .eq("id", workspaceId)
      .single(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("media_assets")
      .select("size_bytes")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("status", ["uploading", "ready"]),
  ]);

  if (workspaceError || profileError || mediaError || !workspace || !profile) {
    throw new Error("workspace_bootstrap_read_failed");
  }

  const usedBytes = (mediaRows ?? []).reduce(
    (total, asset) => total + (asset.size_bytes ?? 0),
    0,
  );

  return {
    workspaceId,
    workspace: {
      name: workspace.name,
      timezone: workspace.timezone,
    },
    profile: {
      fullName: profile.full_name || workspace.name,
      email: user.email ?? "",
    },
    mediaUsage: {
      usedBytes,
      limitBytes: WORKSPACE_MEDIA_LIMIT_BYTES,
      freeTierBytes: R2_FREE_TIER_STORAGE_BYTES,
    },
    clients: [],
  };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sua sessão expirou. Entre novamente." },
      { status: 401 },
    );
  }

  const { data: existingMembership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json(
      { error: "Não foi possível consultar seu workspace." },
      { status: 500 },
    );
  }

  if (existingMembership) {
    try {
      return NextResponse.json(
        await buildBootstrapResult(
          supabase,
          user,
          existingMembership.workspace_id,
        ),
      );
    } catch {
      return NextResponse.json(
        { error: "Não foi possível carregar seu workspace." },
        { status: 500 },
      );
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: WORKSPACE.name })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json(
      { error: "Não foi possível preparar seu perfil." },
      { status: 500 },
    );
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      ...WORKSPACE,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (workspaceError) {
    return NextResponse.json(
      { error: "Não foi possível criar seu workspace." },
      { status: 500 },
    );
  }

  try {
    return NextResponse.json(
      await buildBootstrapResult(supabase, user, workspace.id),
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "O workspace foi criado, mas não pôde ser carregado." },
      { status: 500 },
    );
  }
}
