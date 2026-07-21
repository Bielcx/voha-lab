import { NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env/public";
import { saveInstagramConnection } from "@/lib/instagram/connection";
import { constantTimeEqual } from "@/lib/instagram/crypto";
import {
  exchangeAuthorizationCode,
  exchangeForLongLivedToken,
  getInstagramProfile,
  InstagramApiError,
} from "@/lib/instagram/meta-api";
import {
  INSTAGRAM_OAUTH_COOKIE,
  parseOAuthCookie,
} from "@/lib/instagram/oauth-cookie";
import { requireWorkspaceAccess, validateWorkspaceClient } from "@/lib/media/access";

export const dynamic = "force-dynamic";

function appRedirect(status: "connected" | "error", reason?: string) {
  const url = new URL("/", getPublicEnv().NEXT_PUBLIC_APP_URL);
  url.searchParams.set("instagram", status);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

function clearOAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: INSTAGRAM_OAUTH_COOKIE,
    value: "",
    httpOnly: true,
    secure: new URL(getPublicEnv().NEXT_PUBLIC_APP_URL).protocol === "https:",
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const oauthCookie = parseOAuthCookie(
    request.cookies.get(INSTAGRAM_OAUTH_COOKIE)?.value,
  );
  const state = request.nextUrl.searchParams.get("state");
  if (!oauthCookie || !state || !constantTimeEqual(oauthCookie.state, state)) {
    return clearOAuthCookie(appRedirect("error", "invalid_state"));
  }

  if (request.nextUrl.searchParams.has("error")) {
    return clearOAuthCookie(appRedirect("error", "access_denied"));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return clearOAuthCookie(appRedirect("error", "missing_code"));

  const access = await requireWorkspaceAccess({ editor: true });
  if (
    !access.ok ||
    access.user.id !== oauthCookie.userId ||
    access.workspaceId !== oauthCookie.workspaceId
  ) {
    return clearOAuthCookie(appRedirect("error", "session_mismatch"));
  }

  const clientExists = await validateWorkspaceClient(
    access.supabase,
    access.workspaceId,
    oauthCookie.clientId,
  );
  if (!clientExists) {
    return clearOAuthCookie(appRedirect("error", "client_not_found"));
  }

  try {
    const shortToken = await exchangeAuthorizationCode(code);
    const longToken = await exchangeForLongLivedToken(shortToken.access_token);
    const profile = await getInstagramProfile(longToken.access_token);
    await saveInstagramConnection({
      supabase: access.supabase,
      workspaceId: access.workspaceId,
      clientId: oauthCookie.clientId,
      profile,
      accessToken: longToken.access_token,
      expiresIn: longToken.expires_in,
    });
    return clearOAuthCookie(appRedirect("connected"));
  } catch (error) {
    const reason = error instanceof InstagramApiError ? error.code : "unexpected_error";
    return clearOAuthCookie(appRedirect("error", reason));
  }
}
