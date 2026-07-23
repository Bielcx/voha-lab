import "server-only";

import { z } from "zod";

import { decryptAccessToken } from "@/lib/instagram/crypto";
import {
  createInstagramContainer,
  InstagramPublishingError,
  publishInstagramContainer,
  waitForInstagramContainer,
  type InstagramPublishingFormat,
} from "@/lib/instagram/publishing";
import { canRetryPublicationAutomatically } from "@/lib/instagram/publishing-policy";
import { getInstagramEnv } from "@/lib/env/server";
import { mediaStorage } from "@/lib/storage/r2";
import { createAdminClient } from "@/lib/supabase/admin";

const claimSchema = z.object({
  post_id: z.uuid(),
  attempt_id: z.uuid(),
  claim_token: z.uuid(),
  attempt_number: z.number().int().positive().max(3),
});

type PublicationClaim = z.infer<typeof claimSchema>;

type MediaRelation = {
  id: string;
  kind: "image" | "video";
  mime_type: string;
  storage_key: string;
  status: "uploading" | "ready" | "failed";
  deleted_at: string | null;
};

type PostMediaRelation = {
  position: number;
  media_assets: MediaRelation | MediaRelation[] | null;
};

type PublicationPost = {
  id: string;
  format: InstagramPublishingFormat;
  caption: string;
  first_comment: string;
  instagram_account_id: string | null;
  post_media: PostMediaRelation[] | null;
};

type SafeProviderResponse = Record<string, string | number | boolean | null>;

class PublicationEngineError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    message: string,
    public readonly providerResponse: SafeProviderResponse = {},
  ) {
    super(message);
    this.name = "PublicationEngineError";
  }
}

function firstRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

async function markProgress(
  admin: ReturnType<typeof createAdminClient>,
  claim: PublicationClaim,
  phase: "container_created" | "processing" | "publish_dispatched",
  containerId?: string,
) {
  const { data, error } = await admin.rpc("mark_publication_attempt_progress", {
    target_attempt_id: claim.attempt_id,
    target_claim_token: claim.claim_token,
    target_phase: phase,
    target_meta_container_id: containerId ?? null,
    target_provider_response: { phase },
  });
  if (error || data !== true) {
    throw new PublicationEngineError(
      "attempt_progress_failed",
      false,
      "O Voha não conseguiu registrar o progresso da publicação.",
    );
  }
}

async function finishAttempt(
  admin: ReturnType<typeof createAdminClient>,
  claim: PublicationClaim,
  input: {
    succeeded: boolean;
    metaMediaId?: string;
    errorCode?: string;
    errorMessage?: string;
    providerResponse?: SafeProviderResponse;
    retryable?: boolean;
  },
) {
  const { data, error } = await admin.rpc("finish_publication_attempt", {
    target_attempt_id: claim.attempt_id,
    target_claim_token: claim.claim_token,
    target_succeeded: input.succeeded,
    target_meta_media_id: input.metaMediaId ?? null,
    target_error_code: input.errorCode ?? null,
    target_error_message: input.errorMessage ?? null,
    target_provider_response: input.providerResponse ?? {},
    target_retryable: input.retryable ?? false,
  });
  if (error || data !== true) {
    throw new Error("publication_attempt_completion_failed");
  }
}

async function loadPublication(claim: PublicationClaim) {
  const admin = createAdminClient();
  const { data: postData, error: postError } = await admin
    .from("posts")
    .select("id, format, caption, first_comment, instagram_account_id, post_media(position, media_assets(id, kind, mime_type, storage_key, status, deleted_at))")
    .eq("id", claim.post_id)
    .eq("status", "publishing")
    .is("deleted_at", null)
    .maybeSingle();

  if (postError || !postData) {
    throw new PublicationEngineError("post_unavailable", false, "A publicação não está mais disponível.");
  }
  const post = postData as PublicationPost;
  if (!post.instagram_account_id) {
    throw new PublicationEngineError("instagram_account_missing", false, "Conecte o Instagram deste cliente novamente.");
  }

  const [{ data: account, error: accountError }, { data: credential, error: credentialError }] = await Promise.all([
    admin
      .from("instagram_accounts")
      .select("id, instagram_user_id, connection_status, token_expires_at")
      .eq("id", post.instagram_account_id)
      .maybeSingle(),
    admin
      .from("instagram_credentials")
      .select("access_token_ciphertext")
      .eq("instagram_account_id", post.instagram_account_id)
      .maybeSingle(),
  ]);

  if (accountError || credentialError || !account || !credential || !account.instagram_user_id) {
    throw new PublicationEngineError("instagram_credentials_missing", false, "Reconecte a conta do Instagram.");
  }
  if (
    account.connection_status !== "connected"
    || !account.token_expires_at
    || new Date(account.token_expires_at).getTime() <= Date.now()
  ) {
    await admin.from("instagram_accounts").update({ connection_status: "expired" }).eq("id", account.id);
    throw new PublicationEngineError("instagram_token_expired", false, "A conexão do Instagram expirou. Reconecte a conta.");
  }

  let accessToken: string;
  try {
    accessToken = await decryptAccessToken(
      credential.access_token_ciphertext,
      getInstagramEnv().META_TOKEN_ENCRYPTION_KEY,
    );
  } catch {
    throw new PublicationEngineError("instagram_token_decryption_failed", false, "Reconecte a conta do Instagram.");
  }

  const mediaRows = [...(post.post_media ?? [])]
    .sort((left, right) => left.position - right.position)
    .map((item) => firstRelation(item.media_assets))
    .filter((item): item is MediaRelation => Boolean(item));
  if (mediaRows.length === 0 || mediaRows.some((item) => item.status !== "ready" || item.deleted_at)) {
    throw new PublicationEngineError("media_unavailable", false, "Uma ou mais mídias não estão disponíveis.");
  }

  const media = await Promise.all(mediaRows.map(async (item) => ({
    kind: item.kind,
    url: await mediaStorage.createDownloadUrl(item.storage_key, 60 * 60),
  })));

  return {
    admin,
    post,
    account,
    accessToken,
    media,
  };
}

async function processClaim(claim: PublicationClaim) {
  const startedAt = Date.now();
  let admin = createAdminClient();
  let publishDispatched = false;
  try {
    const publication = await loadPublication(claim);
    admin = publication.admin;
    const containerId = await createInstagramContainer({
      instagramUserId: publication.account.instagram_user_id,
      accessToken: publication.accessToken,
      format: publication.post.format,
      caption: publication.post.caption,
      media: publication.media,
    });
    await markProgress(admin, claim, "container_created", containerId);
    await markProgress(admin, claim, "processing", containerId);
    const containerStatus = await waitForInstagramContainer(containerId, publication.accessToken);

    // Persist before dispatch. If the Worker stops after this point, stale recovery
    // refuses an automatic retry and avoids creating a duplicate Instagram post.
    await markProgress(admin, claim, "publish_dispatched", containerId);
    publishDispatched = true;
    const metaMediaId = await publishInstagramContainer(
      publication.account.instagram_user_id,
      containerId,
      publication.accessToken,
    );

    await finishAttempt(admin, claim, {
      succeeded: true,
      metaMediaId,
      providerResponse: {
        containerStatus: containerStatus.status_code,
        firstCommentPending: Boolean(publication.post.first_comment.trim()),
      },
    });
    console.log(JSON.stringify({
      event: "instagram_publication_succeeded",
      postId: claim.post_id,
      attemptId: claim.attempt_id,
      attempt: claim.attempt_number,
      durationMs: Date.now() - startedAt,
    }));
    return { postId: claim.post_id, status: "published" as const };
  } catch (error) {
    const knownError = error instanceof InstagramPublishingError || error instanceof PublicationEngineError;
    const code = knownError ? error.code : "publication_internal_error";
    const message = knownError ? error.message : "Ocorreu uma falha interna durante a publicação.";
    const retryable = error instanceof InstagramPublishingError
      ? canRetryPublicationAutomatically(error.retryable, publishDispatched)
      : error instanceof PublicationEngineError
        ? error.retryable
        : !publishDispatched;
    const providerResponse = error instanceof InstagramPublishingError
      ? error.providerResponse
      : error instanceof PublicationEngineError
        ? error.providerResponse
        : { internalError: true };

    await finishAttempt(admin, claim, {
      succeeded: false,
      errorCode: code,
      errorMessage: message,
      providerResponse,
      retryable,
    });
    console.error(JSON.stringify({
      event: "instagram_publication_failed",
      postId: claim.post_id,
      attemptId: claim.attempt_id,
      code,
      retryable,
      attempt: claim.attempt_number,
      durationMs: Date.now() - startedAt,
    }));
    return { postId: claim.post_id, status: "failed" as const, code, retryable };
  }
}

export async function runDuePublications(requestedLimit = 3) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_due_publications", {
    requested_limit: requestedLimit,
  });
  if (error) throw new Error("publication_claim_failed");

  const parsed = z.array(claimSchema).safeParse(data ?? []);
  if (!parsed.success) throw new Error("publication_claim_response_invalid");

  const results = [];
  for (const claim of parsed.data) {
    results.push(await processClaim(claim));
  }
  return {
    claimed: parsed.data.length,
    published: results.filter((item) => item.status === "published").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
}
