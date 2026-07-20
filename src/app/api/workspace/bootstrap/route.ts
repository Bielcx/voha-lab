import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const WORKSPACE = {
  name: "Larissa Cruz",
  slug: "larissa-cruz",
  timezone: "America/Sao_Paulo",
} as const;

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
    return NextResponse.json({
      workspaceId: existingMembership.workspace_id,
      clients: [],
    });
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

  return NextResponse.json(
    { workspaceId: workspace.id, clients: [] },
    { status: 201 },
  );
}
