import "server-only";

import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getR2Env } from "@/lib/env/server";
import type {
  MediaStorage,
  UploadUrlInput,
  UploadUrlResult,
} from "@/lib/storage/media-storage";

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

let client: S3Client | undefined;

function getClient() {
  if (client) return client;

  const env = getR2Env();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.slice(-100) || "media";
}

function createObjectKey({ workspaceId, fileName }: UploadUrlInput) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `workspaces/${workspaceId}/media/${year}/${month}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export class R2MediaStorage implements MediaStorage {
  async createUploadUrl(input: UploadUrlInput): Promise<UploadUrlResult> {
    const env = getR2Env();
    const key = createObjectKey(input);
    const uploadUrl = await getSignedUrl(
      getClient(),
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        ContentType: input.contentType,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return {
      key,
      uploadUrl,
      expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
    };
  }

  async createDownloadUrl(
    key: string,
    expiresInSeconds = DOWNLOAD_URL_TTL_SECONDS,
  ) {
    const env = getR2Env();

    return getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string) {
    const env = getR2Env();
    await getClient().send(
      new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
    );
  }
}

export const mediaStorage: MediaStorage = new R2MediaStorage();
