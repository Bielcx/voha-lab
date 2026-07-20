export const INSTAGRAM_OAUTH_COOKIE = "voha_instagram_oauth";
export const INSTAGRAM_OAUTH_MAX_AGE_SECONDS = 10 * 60;

export type InstagramOAuthCookie = {
  state: string;
  clientId: string;
  userId: string;
  workspaceId: string;
};

export function serializeOAuthCookie(value: InstagramOAuthCookie) {
  return [value.state, value.clientId, value.userId, value.workspaceId].join(".");
}

export function parseOAuthCookie(value: string | undefined): InstagramOAuthCookie | null {
  if (!value) return null;
  const [state, clientId, userId, workspaceId, extra] = value.split(".");
  if (!state || !clientId || !userId || !workspaceId || extra !== undefined) return null;
  return { state, clientId, userId, workspaceId };
}
