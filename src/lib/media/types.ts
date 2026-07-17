import type { MediaKind } from "@/lib/media/policy";

export type MediaAssetSummary = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  originalName: string;
  mimeType: string;
  kind: MediaKind;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  createdAt: string;
  url: string;
};

export type MediaListResponse = {
  items: MediaAssetSummary[];
  nextCursor: string | null;
};

export type MediaUploadAuthorization = {
  assetId: string;
  uploadUrl: string;
  expiresAt: string;
};
