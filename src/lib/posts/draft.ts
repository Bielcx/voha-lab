import { z } from "zod";

import type { PostFormat, SavePostDraftRequest } from "@/lib/posts/types";

export const savePostDraftSchema = z.object({
  clientId: z.uuid(),
  format: z.enum(["image", "carousel", "reel"]),
  caption: z.string().max(2200),
  firstComment: z.string().max(2200),
  mediaIds: z.array(z.uuid()).max(10),
}).superRefine((value, context) => {
  if (new Set(value.mediaIds).size !== value.mediaIds.length) {
    context.addIssue({
      code: "custom",
      path: ["mediaIds"],
      message: "Uma mídia não pode aparecer duas vezes no mesmo post.",
    });
  }
});

export type DraftMediaCandidate = {
  id: string;
  clientId: string | null;
  kind: "image" | "video";
  mimeType: string;
};

export function validateDraftMedia(
  draft: Pick<SavePostDraftRequest, "clientId" | "format" | "mediaIds">,
  media: DraftMediaCandidate[],
) {
  if (media.length !== draft.mediaIds.length) {
    return "Uma ou mais mídias não estão disponíveis neste workspace.";
  }

  const byId = new Map(media.map((item) => [item.id, item]));
  const ordered = draft.mediaIds.map((id) => byId.get(id));
  if (ordered.some((item) => !item)) {
    return "Uma ou mais mídias não estão disponíveis neste workspace.";
  }

  if (ordered.some((item) => item?.clientId && item.clientId !== draft.clientId)) {
    return "Selecione apenas mídias do cliente escolhido.";
  }

  if (draft.format === "image") {
    if (ordered.length > 1) return "Uma publicação de imagem aceita somente uma mídia.";
    if (ordered.some((item) => item?.kind !== "image")) {
      return "O formato Imagem aceita somente arquivos de imagem.";
    }
  }

  if (draft.format === "carousel" && ordered.length > 10) {
    return "Um carrossel aceita no máximo 10 mídias.";
  }

  if (draft.format === "reel") {
    if (ordered.length > 1) return "Um Reel aceita somente um vídeo.";
    if (ordered.some((item) => item?.kind !== "video" || item.mimeType !== "video/mp4")) {
      return "O formato Reel aceita somente um vídeo MP4.";
    }
  }

  return null;
}

export function formatAllowsMedia(
  format: PostFormat,
  media: Pick<DraftMediaCandidate, "kind" | "mimeType">,
) {
  if (format === "image") return media.kind === "image";
  if (format === "reel") return media.kind === "video" && media.mimeType === "video/mp4";
  return true;
}

export function formatMediaLimit(format: PostFormat) {
  return format === "carousel" ? 10 : 1;
}
