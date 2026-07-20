import { NextResponse } from "next/server";
import { z } from "zod";

import { getInstagramEnv } from "@/lib/env/server";
import { decryptAccessToken, encryptAccessToken } from "@/lib/instagram/crypto";
import { refreshLongLivedToken } from "@/lib/instagram/meta-api";
import { requireWorkspaceAccess } from "@/lib/media/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const idSchema = z.uuid();
type RouteContext = { params: Promise<{ clientId: string }> };

async function getAccount(context: RouteContext) {
  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access;

  const { clientId } = await context.params;
  const parsedId = idSchema.safeParse(clientId);
  if (!parsedId.success) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Cliente inválido." }, { status: 400 }),
    };
  }

  const { data: account, error } = await access.supabase
    .from("instagram_accounts")
    .select("id, token_expires_at")
    .eq("workspace_id", access.workspaceId)
    .eq("client_id", parsedId.data)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Não foi possível consultar a conexão." },
        { status: 500 },
      ),
    };
  }
  if (!account) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Nenhuma conta do Instagram está conectada." },
        { status: 404 },
      ),
    };
  }

  return { ok: true as const, access, account };
}

export async function POST(_request: Request, context: RouteContext) {
  const result = await getAccount(context);
  if (!result.ok) return result.response;

  const admin = createAdminClient();
  const { data: credential, error: credentialError } = await admin
    .from("instagram_credentials")
    .select("access_token_ciphertext")
    .eq("instagram_account_id", result.account.id)
    .maybeSingle();

  if (credentialError || !credential) {
    return NextResponse.json(
      { error: "A conexão precisa ser refeita." },
      { status: 409 },
    );
  }

  try {
    const encryptionKey = getInstagramEnv().META_TOKEN_ENCRYPTION_KEY;
    const currentToken = await decryptAccessToken(
      credential.access_token_ciphertext,
      encryptionKey,
    );
    const refreshed = await refreshLongLivedToken(currentToken);
    const encryptedToken = await encryptAccessToken(
      refreshed.access_token,
      encryptionKey,
    );
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    const { error: updateCredentialError } = await admin
      .from("instagram_credentials")
      .update({
        access_token_ciphertext: encryptedToken,
        encryption_key_version: 1,
      })
      .eq("instagram_account_id", result.account.id);
    if (updateCredentialError) throw new Error("credential_update_failed");

    const { error: accountError } = await result.access.supabase
      .from("instagram_accounts")
      .update({
        connection_status: "connected",
        token_expires_at: expiresAt,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", result.account.id)
      .eq("workspace_id", result.access.workspaceId);
    if (accountError) throw new Error("account_update_failed");

    return NextResponse.json({ expiresAt });
  } catch {
    const expired = result.account.token_expires_at
      ? new Date(result.account.token_expires_at).getTime() <= Date.now()
      : false;
    await result.access.supabase
      .from("instagram_accounts")
      .update({ connection_status: expired ? "expired" : "error" })
      .eq("id", result.account.id)
      .eq("workspace_id", result.access.workspaceId);
    return NextResponse.json(
      { error: expired ? "A conexão expirou. Conecte novamente." : "Não foi possível renovar a conexão." },
      { status: 502 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const result = await getAccount(context);
  if (!result.ok) return result.response;

  const admin = createAdminClient();
  const { error: credentialError } = await admin
    .from("instagram_credentials")
    .delete()
    .eq("instagram_account_id", result.account.id);
  if (credentialError) {
    return NextResponse.json(
      { error: "Não foi possível remover a credencial com segurança." },
      { status: 500 },
    );
  }

  const { error: accountError } = await result.access.supabase
    .from("instagram_accounts")
    .update({ connection_status: "disconnected", token_expires_at: null })
    .eq("id", result.account.id)
    .eq("workspace_id", result.access.workspaceId);
  if (accountError) {
    return NextResponse.json(
      { error: "Não foi possível concluir a desconexão." },
      { status: 500 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
