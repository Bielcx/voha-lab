import "server-only";

import { getInstagramEnv } from "@/lib/env/server";
import { encryptAccessToken } from "@/lib/instagram/crypto";
import { InstagramApiError } from "@/lib/instagram/meta-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AuthenticatedSupabase = Awaited<ReturnType<typeof createClient>>;

type InstagramProfile = {
  id: string;
  username: string;
  profilePictureUrl: string | null;
};

type SaveConnectionInput = {
  supabase: AuthenticatedSupabase;
  workspaceId: string;
  clientId: string;
  profile: InstagramProfile;
  accessToken: string;
  expiresIn: number;
};

export async function saveInstagramConnection(input: SaveConnectionInput) {
  const { supabase, workspaceId, clientId, profile, accessToken, expiresIn } = input;
  const [byClientResult, byInstagramResult] = await Promise.all([
    supabase
      .from("instagram_accounts")
      .select("id, client_id")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("instagram_accounts")
      .select("id, client_id")
      .eq("workspace_id", workspaceId)
      .eq("instagram_user_id", profile.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (byClientResult.error || byInstagramResult.error) {
    throw new InstagramApiError("connection_lookup_failed");
  }

  if (
    byInstagramResult.data &&
    byInstagramResult.data.client_id !== clientId
  ) {
    throw new InstagramApiError("account_already_connected");
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const accountValues = {
    workspace_id: workspaceId,
    client_id: clientId,
    username: profile.username,
    instagram_user_id: profile.id,
    profile_picture_url: profile.profilePictureUrl,
    connection_status: "connected" as const,
    token_expires_at: expiresAt,
    last_synced_at: new Date().toISOString(),
  };

  const existingAccount = byClientResult.data ?? byInstagramResult.data;
  const accountResult = existingAccount
    ? await supabase
        .from("instagram_accounts")
        .update(accountValues)
        .eq("id", existingAccount.id)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single()
    : await supabase
        .from("instagram_accounts")
        .insert(accountValues)
        .select("id")
        .single();

  if (accountResult.error || !accountResult.data) {
    throw new InstagramApiError("account_store_failed");
  }

  const accountId = accountResult.data.id as string;
  const encryptedToken = await encryptAccessToken(
    accessToken,
    getInstagramEnv().META_TOKEN_ENCRYPTION_KEY,
  );
  const admin = createAdminClient();
  const { error: credentialError } = await admin
    .from("instagram_credentials")
    .upsert(
      {
        instagram_account_id: accountId,
        access_token_ciphertext: encryptedToken,
        encryption_key_version: 1,
      },
      { onConflict: "instagram_account_id" },
    );

  if (credentialError) {
    await supabase
      .from("instagram_accounts")
      .update({ connection_status: "error" })
      .eq("id", accountId)
      .eq("workspace_id", workspaceId);
    throw new InstagramApiError("credential_store_failed");
  }

  await supabase
    .from("clients")
    .update({ instagram_handle: `@${profile.username}` })
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  return { accountId, expiresAt };
}
