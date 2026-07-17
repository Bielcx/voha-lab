export type UploadUrlInput = {
  workspaceId: string;
  fileName: string;
  contentType: string;
};

export type UploadUrlResult = {
  key: string;
  uploadUrl: string;
  expiresAt: Date;
};

export type StoredMediaMetadata = {
  sizeBytes: number;
  contentType: string | null;
  eTag: string | null;
};

export interface MediaStorage {
  createUploadUrl(input: UploadUrlInput): Promise<UploadUrlResult>;
  createDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getMetadata(key: string): Promise<StoredMediaMetadata>;
  delete(key: string): Promise<void>;
}
