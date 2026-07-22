import { z } from "zod";

import type { PostFormat } from "@/lib/posts/types";

export const schedulePostSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("now") }),
  z.object({ mode: z.literal("schedule"), scheduledFor: z.iso.datetime() }),
]);

export type PublicationMediaCandidate = {
  id: string;
  kind: "image" | "video";
  mimeType: string;
};

export type PublicationValidationInput = {
  format: PostFormat;
  media: PublicationMediaCandidate[];
  accountConnected: boolean;
  tokenExpiresAt: string | null;
  now?: Date;
};

export function validatePostForPublication(input: PublicationValidationInput) {
  const now = input.now ?? new Date();
  if (!input.accountConnected) {
    return "Conecte a conta profissional do Instagram antes de agendar.";
  }

  if (!input.tokenExpiresAt || new Date(input.tokenExpiresAt).getTime() <= now.getTime() + 5 * 60_000) {
    return "A conexão com o Instagram expirou ou está prestes a expirar. Reconecte a conta.";
  }

  if (input.format === "image") {
    if (input.media.length !== 1 || input.media[0]?.kind !== "image") {
      return "Uma publicação de imagem precisa de exatamente uma imagem.";
    }
    if (input.media[0].mimeType !== "image/jpeg") {
      return "A Meta aceita JPEG neste fluxo. Converta a imagem para JPG antes de publicar.";
    }
  }

  if (input.format === "carousel") {
    if (input.media.length < 2 || input.media.length > 10) {
      return "Um carrossel precisa ter entre 2 e 10 mídias.";
    }
    if (input.media.some((item) => item.kind === "image" && item.mimeType !== "image/jpeg")) {
      return "Imagens do carrossel precisam estar em JPEG para a Meta.";
    }
    if (input.media.some((item) => item.kind === "video" && item.mimeType !== "video/mp4")) {
      return "Vídeos do carrossel precisam estar em MP4.";
    }
  }

  if (input.format === "reel") {
    if (
      input.media.length !== 1
      || input.media[0]?.kind !== "video"
      || input.media[0].mimeType !== "video/mp4"
    ) {
      return "Um Reel precisa de exatamente um vídeo MP4.";
    }
  }

  return null;
}

export function resolveScheduledFor(
  input: z.infer<typeof schedulePostSchema>,
  now = new Date(),
) {
  if (input.mode === "now") return now.toISOString();
  const scheduledFor = new Date(input.scheduledFor);
  if (scheduledFor.getTime() < now.getTime() + 60_000) {
    return null;
  }
  return scheduledFor.toISOString();
}
