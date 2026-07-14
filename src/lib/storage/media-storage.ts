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

export interface MediaStorage {
  createUploadUrl(input: UploadUrlInput): Promise<UploadUrlResult>;
  createDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}
