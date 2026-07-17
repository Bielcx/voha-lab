export const POST_STATUSES = [
  "draft",
  "pending_approval",
  "scheduled",
  "publishing",
  "published",
  "failed",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export type PostFormat = "image" | "carousel" | "reel";

export type OperationalPost = {
  id: string;
  clientId: string;
  clientName: string;
  clientHandle: string | null;
  clientColor: string;
  format: PostFormat;
  status: PostStatus;
  caption: string;
  firstComment: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  failureCode: string | null;
  failureMessage: string | null;
  thumbnailUrl: string | null;
  mediaName: string | null;
};

export type PostListResponse = {
  items: OperationalPost[];
  nextOffset: number | null;
  total: number;
};

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Rascunho",
  pending_approval: "Aguardando aprovação",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falhou",
};

export const POST_FORMAT_LABELS: Record<PostFormat, string> = {
  image: "Imagem",
  carousel: "Carrossel",
  reel: "Reel",
};
