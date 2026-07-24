import "server-only";

import { getApprovalAvailability, hashApprovalToken, isApprovalToken } from "@/lib/approvals/policy";
import type { ApprovalMedia, ApprovalReview, ApprovalStatus, RespondApprovalRequest, RespondApprovalResponse } from "@/lib/approvals/types";
import type { PostFormat } from "@/lib/posts/types";
import { mediaStorage } from "@/lib/storage/r2";
import { createAdminClient } from "@/lib/supabase/admin";

type ClientRelation = { name: string; instagram_handle: string | null; brand_color: string | null };
type MediaRelation = { id: string; original_name: string; storage_key: string; kind: "image" | "video" };
type PostMediaRelation = { position: number; media_assets: MediaRelation | MediaRelation[] | null };
type PostRelation = {
  format: PostFormat;
  caption: string;
  first_comment: string;
  clients: ClientRelation | ClientRelation[] | null;
  post_media: PostMediaRelation[] | null;
};
type ApprovalRow = {
  approver_name: string | null;
  status: ApprovalStatus;
  comment: string | null;
  expires_at: string;
  responded_at: string | null;
  revoked_at: string | null;
  posts: PostRelation | PostRelation[] | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

export async function getApprovalReview(rawToken: string): Promise<ApprovalReview | null> {
  if (!isApprovalToken(rawToken)) return null;
  const admin = createAdminClient();
  const tokenHash = await hashApprovalToken(rawToken);
  const { data, error } = await admin
    .from("post_approvals")
    .select("approver_name, status, comment, expires_at, responded_at, revoked_at, posts(format, caption, first_comment, clients(name, instagram_handle, brand_color), post_media(position, media_assets(id, original_name, storage_key, kind)))")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;

  const approval = data as unknown as ApprovalRow;
  const post = firstRelation(approval.posts);
  if (!post) return null;
  const client = firstRelation(post.clients);
  if (!client) return null;

  const availability = getApprovalAvailability({
    status: approval.status,
    expiresAt: approval.expires_at,
    revokedAt: approval.revoked_at,
  });
  const mediaRows = availability === "pending"
    ? [...(post.post_media ?? [])]
        .sort((left, right) => left.position - right.position)
        .map((item) => firstRelation(item.media_assets))
        .filter((item): item is MediaRelation => Boolean(item))
    : [];
  const media = (await Promise.all(mediaRows.map(async (item): Promise<ApprovalMedia | null> => {
    try {
      return { id: item.id, originalName: item.original_name, kind: item.kind, url: await mediaStorage.createDownloadUrl(item.storage_key, 30 * 60) };
    } catch {
      return null;
    }
  }))).filter((item): item is ApprovalMedia => Boolean(item));

  return {
    availability,
    approverName: approval.approver_name,
    clientName: client.name,
    clientHandle: client.instagram_handle,
    clientColor: client.brand_color ?? "#747078",
    format: post.format,
    caption: availability === "pending" ? post.caption : "",
    firstComment: availability === "pending" ? post.first_comment : "",
    media,
    expiresAt: approval.expires_at,
    respondedAt: approval.responded_at,
    responseComment: approval.comment,
  };
}

export async function respondToApproval(rawToken: string, response: RespondApprovalRequest): Promise<RespondApprovalResponse | null> {
  if (!isApprovalToken(rawToken)) return null;
  const admin = createAdminClient();
  const tokenHash = await hashApprovalToken(rawToken);
  const { data, error } = await admin.rpc("respond_to_post_approval", {
    target_token_hash: tokenHash,
    target_decision: response.decision,
    target_comment: response.comment?.trim() || "",
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return null;
  return { decision: row.decision as RespondApprovalResponse["decision"], respondedAt: row.responded_at as string };
}
