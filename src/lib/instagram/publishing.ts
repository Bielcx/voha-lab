import "server-only";

import { z } from "zod";

import {
  publicMetaErrorMessage,
  sanitizeMetaError,
  type SafeMetaError,
} from "@/lib/instagram/publishing-policy";

const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com/v25.0";
const REQUEST_TIMEOUT_MS = 20_000;
const CONTAINER_POLL_INTERVAL_MS = 5_000;
const CONTAINER_POLL_ATTEMPTS = 12;

const idResponseSchema = z.object({ id: z.union([z.string(), z.number()]) });
const containerStatusSchema = z.object({
  status_code: z.enum(["IN_PROGRESS", "FINISHED", "ERROR", "EXPIRED", "PUBLISHED"]),
  status: z.string().optional(),
});

export type InstagramPublishingMedia = {
  kind: "image" | "video";
  url: string;
};

export type InstagramPublishingFormat = "image" | "carousel" | "reel";

export class InstagramPublishingError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly outcomeUnknown: boolean,
    public readonly providerResponse: SafeMetaError | Record<string, string | number | boolean | null>,
    message: string,
  ) {
    super(message);
    this.name = "InstagramPublishingError";
  }
}

async function instagramRequest(
  path: string,
  accessToken: string,
  options?: {
    method?: "GET" | "POST";
    body?: URLSearchParams;
    publishDispatch?: boolean;
  },
) {
  let response: Response;
  try {
    response = await fetch(`${INSTAGRAM_GRAPH_URL}/${path}`, {
      method: options?.method ?? "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(options?.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: options?.body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new InstagramPublishingError(
      options?.publishDispatch ? "publish_outcome_unknown" : "meta_network_error",
      !options?.publishDispatch,
      Boolean(options?.publishDispatch),
      { networkError: true },
      options?.publishDispatch
        ? "Não foi possível confirmar se a Meta publicou. Confira o Instagram antes de tentar novamente."
        : "Não foi possível acessar a Meta. O Voha tentará novamente.",
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const safeError = sanitizeMetaError(response.status, body);
    throw new InstagramPublishingError(
      `meta_${safeError.code ?? response.status}`,
      safeError.retryable,
      false,
      safeError,
      publicMetaErrorMessage(safeError),
    );
  }
  return body;
}

async function createContainer(
  instagramUserId: string,
  accessToken: string,
  body: URLSearchParams,
) {
  const response = await instagramRequest(`${instagramUserId}/media`, accessToken, {
    method: "POST",
    body,
  });
  const parsed = idResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new InstagramPublishingError(
      "invalid_container_response",
      true,
      false,
      { invalidResponse: true },
      "A Meta retornou uma resposta inesperada ao preparar a mídia.",
    );
  }
  return String(parsed.data.id);
}

export async function createInstagramContainer(input: {
  instagramUserId: string;
  accessToken: string;
  format: InstagramPublishingFormat;
  caption: string;
  media: InstagramPublishingMedia[];
}) {
  const { instagramUserId, accessToken, format, caption, media } = input;
  if (format === "image") {
    return createContainer(instagramUserId, accessToken, new URLSearchParams({
      image_url: media[0].url,
      caption,
    }));
  }

  if (format === "reel") {
    return createContainer(instagramUserId, accessToken, new URLSearchParams({
      media_type: "REELS",
      video_url: media[0].url,
      caption,
      share_to_feed: "true",
    }));
  }

  const children: string[] = [];
  for (const item of media) {
    const childBody = new URLSearchParams({ is_carousel_item: "true" });
    if (item.kind === "video") {
      childBody.set("media_type", "VIDEO");
      childBody.set("video_url", item.url);
    } else {
      childBody.set("image_url", item.url);
    }
    const childId = await createContainer(instagramUserId, accessToken, childBody);
    if (item.kind === "video") await waitForInstagramContainer(childId, accessToken);
    children.push(childId);
  }

  return createContainer(instagramUserId, accessToken, new URLSearchParams({
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
  }));
}

export async function getInstagramContainerStatus(
  containerId: string,
  accessToken: string,
) {
  const response = await instagramRequest(
    `${containerId}?fields=status_code,status`,
    accessToken,
  );
  const parsed = containerStatusSchema.safeParse(response);
  if (!parsed.success) {
    throw new InstagramPublishingError(
      "invalid_container_status",
      true,
      false,
      { invalidResponse: true },
      "A Meta não informou o estado de processamento da mídia.",
    );
  }
  return parsed.data;
}

export async function waitForInstagramContainer(
  containerId: string,
  accessToken: string,
) {
  for (let attempt = 0; attempt < CONTAINER_POLL_ATTEMPTS; attempt += 1) {
    const result = await getInstagramContainerStatus(containerId, accessToken);
    if (result.status_code === "FINISHED" || result.status_code === "PUBLISHED") return result;
    if (result.status_code === "ERROR" || result.status_code === "EXPIRED") {
      throw new InstagramPublishingError(
        `container_${result.status_code.toLowerCase()}`,
        result.status_code !== "EXPIRED",
        false,
        { containerStatus: result.status_code },
        result.status_code === "EXPIRED"
          ? "A preparação da mídia expirou. Tente agendar novamente."
          : "A Meta não conseguiu processar esta mídia. Revise o arquivo.",
      );
    }
    if (attempt < CONTAINER_POLL_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));
    }
  }

  throw new InstagramPublishingError(
    "container_processing_timeout",
    true,
    false,
    { processingTimeout: true },
    "A mídia ainda está sendo processada. O Voha tentará novamente.",
  );
}

export async function publishInstagramContainer(
  instagramUserId: string,
  containerId: string,
  accessToken: string,
) {
  const response = await instagramRequest(`${instagramUserId}/media_publish`, accessToken, {
    method: "POST",
    body: new URLSearchParams({ creation_id: containerId }),
    publishDispatch: true,
  });
  const parsed = idResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new InstagramPublishingError(
      "publish_outcome_unknown",
      false,
      true,
      { invalidResponse: true },
      "A Meta recebeu a publicação, mas não confirmou o resultado. Confira o Instagram.",
    );
  }
  return String(parsed.data.id);
}
