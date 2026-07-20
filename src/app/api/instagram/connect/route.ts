import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createOAuthState } from "@/lib/instagram/crypto";
import { buildInstagramAuthorizationUrl } from "@/lib/instagram/meta-api";
import {
  INSTAGRAM_OAUTH_COOKIE,
  INSTAGRAM_OAUTH_MAX_AGE_SECONDS,
  serializeOAuthCookie,
} from "@/lib/instagram/oauth-cookie";
import { requireWorkspaceAccess, validateWorkspaceClient } from "@/lib/media/access";

export const dynamic = "force-dynamic";

const querySchema = z.object({ clientId: z.uuid() });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    clientId: request.nextUrl.searchParams.get("clientId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const access = await requireWorkspaceAccess({ editor: true });
  if (!access.ok) return access.response;

  const clientExists = await validateWorkspaceClient(
    access.supabase,
    access.workspaceId,
    parsed.data.clientId,
  );
  if (!clientExists) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const state = createOAuthState();
  const response = NextResponse.redirect(buildInstagramAuthorizationUrl(state));
  response.cookies.set({
    name: INSTAGRAM_OAUTH_COOKIE,
    value: serializeOAuthCookie({
      state,
      clientId: parsed.data.clientId,
      userId: access.user.id,
      workspaceId: access.workspaceId,
    }),
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: INSTAGRAM_OAUTH_MAX_AGE_SECONDS,
  });
  return response;
}
