import "server-only";

import { z } from "zod";

import { getInstagramEnv } from "@/lib/env/server";
import { getPublicEnv } from "@/lib/env/public";

const INSTAGRAM_AUTHORIZATION_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";
const REQUEST_TIMEOUT_MS = 15_000;

const shortTokenSchema = z.object({
  access_token: z.string().min(1),
  user_id: z.union([z.string(), z.number()]).optional(),
});

const longTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().optional(),
});

const profileSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    user_id: z.union([z.string(), z.number()]).optional(),
    username: z.string().min(1),
    name: z.string().optional(),
    profile_picture_url: z.url().optional(),
  })
  .refine((profile) => profile.id !== undefined || profile.user_id !== undefined);

export class InstagramApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "InstagramApiError";
  }
}

export function getInstagramRedirectUri() {
  return new URL("/api/instagram/callback", getPublicEnv().NEXT_PUBLIC_APP_URL).toString();
}

export function buildInstagramAuthorizationUrl(state: string) {
  const env = getInstagramEnv();
  const url = new URL(INSTAGRAM_AUTHORIZATION_URL);
  url.searchParams.set("client_id", env.META_INSTAGRAM_APP_ID);
  url.searchParams.set("redirect_uri", getInstagramRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "instagram_business_basic,instagram_business_content_publish",
  );
  url.searchParams.set("force_reauth", "true");
  url.searchParams.set("state", state);
  return url;
}

async function parseInstagramResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
  errorCode: string,
) {
  const body: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!response.ok || !parsed.success) throw new InstagramApiError(errorCode);
  return parsed.data;
}

export async function exchangeAuthorizationCode(code: string) {
  const env = getInstagramEnv();
  const body = new URLSearchParams({
    client_id: env.META_INSTAGRAM_APP_ID,
    client_secret: env.META_INSTAGRAM_APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: getInstagramRedirectUri(),
    code,
  });
  const response = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  return parseInstagramResponse(response, shortTokenSchema, "code_exchange_failed");
}

export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const env = getInstagramEnv();
  const url = new URL("/access_token", INSTAGRAM_GRAPH_URL);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", env.META_INSTAGRAM_APP_SECRET);
  url.searchParams.set("access_token", shortLivedToken);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  return parseInstagramResponse(response, longTokenSchema, "long_token_exchange_failed");
}

export async function refreshLongLivedToken(accessToken: string) {
  const url = new URL("/refresh_access_token", INSTAGRAM_GRAPH_URL);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  return parseInstagramResponse(response, longTokenSchema, "token_refresh_failed");
}

export async function getInstagramProfile(accessToken: string) {
  const url = new URL("/me", INSTAGRAM_GRAPH_URL);
  url.searchParams.set("fields", "user_id,username,name,profile_picture_url");
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  const profile = await parseInstagramResponse(response, profileSchema, "profile_fetch_failed");
  return {
    id: String(profile.user_id ?? profile.id),
    username: profile.username,
    name: profile.name ?? null,
    profilePictureUrl: profile.profile_picture_url ?? null,
  };
}
