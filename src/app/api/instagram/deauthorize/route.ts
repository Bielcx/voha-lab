import { NextResponse } from "next/server";

import { getInstagramEnv } from "@/lib/env/server";
import { verifyMetaSignedRequest } from "@/lib/instagram/signed-request";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    !contentType.startsWith("application/x-www-form-urlencoded")
    || !Number.isFinite(contentLength)
    || contentLength > 10_000
  ) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  const signedRequest = form.get("signed_request");
  if (typeof signedRequest !== "string" || signedRequest.length > 8192) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  let instagramUserId: string;
  try {
    const payload = await verifyMetaSignedRequest(
      signedRequest,
      getInstagramEnv().META_INSTAGRAM_APP_SECRET,
    );
    instagramUserId = payload.user_id;
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: accounts, error: accountsError } = await admin
    .from("instagram_accounts")
    .select("id")
    .eq("instagram_user_id", instagramUserId);

  if (accountsError) {
    return NextResponse.json(
      { error: "Não foi possível concluir a desautorização." },
      { status: 500 },
    );
  }

  const accountIds = (accounts ?? []).map((account) => account.id);
  if (accountIds.length > 0) {
    const { error: credentialError } = await admin
      .from("instagram_credentials")
      .delete()
      .in("instagram_account_id", accountIds);
    if (credentialError) {
      return NextResponse.json(
        { error: "Não foi possível concluir a desautorização." },
        { status: 500 },
      );
    }

    const { error: accountError } = await admin
      .from("instagram_accounts")
      .update({
        connection_status: "disconnected",
        token_expires_at: null,
      })
      .in("id", accountIds);
    if (accountError) {
      return NextResponse.json(
        { error: "Não foi possível concluir a desautorização." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
