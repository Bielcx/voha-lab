"use client";

import {
  validateUploadCandidate,
  type MediaKind,
} from "@/lib/media/policy";
import type { MediaUploadAuthorization } from "@/lib/media/types";

type UploadStage = "preparing" | "uploading" | "confirming";

type UploadOptions = {
  file: File;
  clientId: string | null;
  allowedKinds?: MediaKind[];
  onProgress?: (progress: number) => void;
  onStage?: (stage: UploadStage) => void;
};

export type UploadedMedia = {
  assetId: string;
  file: File;
  kind: MediaKind;
};

export class MediaUploadError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "MediaUploadError";
    this.status = status;
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mp4: "video/mp4",
  png: "image/png",
  webp: "image/webp",
};

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

function fileExtension(fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension && extension !== fileName.toLowerCase() ? extension : "";
}

export function inferMediaContentType(fileName: string, contentType: string) {
  const normalizedType = contentType.trim().toLowerCase();
  if (normalizedType) return normalizedType;
  return MIME_BY_EXTENSION[fileExtension(fileName)] ?? "";
}

function isHeicFile(file: File) {
  return HEIC_TYPES.has(file.type.toLowerCase())
    || HEIC_EXTENSIONS.has(fileExtension(file.name));
}

function replaceExtension(fileName: string, extension: string) {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return `${baseName}.${extension}`;
}

async function convertHeicToJpeg(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("HEIC_DECODE_FAILED"));
      element.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("HEIC_DECODE_FAILED");
    context.drawImage(image, 0, 0);
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!jpeg) throw new Error("HEIC_DECODE_FAILED");

    return new File([jpeg], replaceExtension(file.name, "jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    throw new MediaUploadError(
      "Esta foto está em HEIC/HEIF e o navegador não conseguiu convertê-la. No iPhone, escolha “Mais Compatível” em Ajustes > Câmera > Formatos ou envie uma versão JPEG.",
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareMediaFile(file: File) {
  if (isHeicFile(file)) return convertHeicToJpeg(file);

  const contentType = inferMediaContentType(file.name, file.type);
  if (!contentType || contentType === file.type) return file;

  return new File([file], file.name, {
    type: contentType,
    lastModified: file.lastModified,
  });
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    payload
    && typeof payload === "object"
    && "error" in payload
    && typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

async function getMediaMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    if (file.type.startsWith("image/")) {
      return await new Promise<{
        width: number;
        height: number;
        durationMs: null;
      }>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () =>
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
            durationMs: null,
          });
        image.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        image.src = objectUrl;
      });
    }

    return await new Promise<{
      width: number;
      height: number;
      durationMs: number;
    }>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          durationMs: Math.round(video.duration * 1000),
        });
      video.onerror = () => reject(new Error("Não foi possível ler o vídeo."));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function uploadToSignedUrl(
  file: File,
  uploadUrl: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new MediaUploadError("O R2 recusou o envio do arquivo.", xhr.status));
      }
    };
    xhr.onerror = () =>
      reject(
        new MediaUploadError(
          "Não foi possível enviar o arquivo. Confira a conexão e tente novamente.",
        ),
      );
    xhr.send(file);
  });
}

export async function uploadMediaFile({
  file: originalFile,
  clientId,
  allowedKinds,
  onProgress = () => undefined,
  onStage = () => undefined,
}: UploadOptions): Promise<UploadedMedia> {
  onStage("preparing");
  const file = await prepareMediaFile(originalFile);
  const validation = validateUploadCandidate({
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  if (!validation.valid) throw new MediaUploadError(validation.error);
  if (allowedKinds && !allowedKinds.includes(validation.kind)) {
    throw new MediaUploadError(
      allowedKinds.length === 1 && allowedKinds[0] === "video"
        ? "Para Reel, escolha um vídeo MP4."
        : "Para uma publicação de imagem, escolha uma foto.",
    );
  }

  let assetId: string | null = null;

  try {
    const metadata = await getMediaMetadata(file);
    onStage("uploading");
    onProgress(1);
    const authorizationResponse = await fetch("/api/media/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        clientId,
      }),
    });
    const authorizationPayload = await readJson(authorizationResponse);
    if (!authorizationResponse.ok) {
      throw new MediaUploadError(
        getErrorMessage(authorizationPayload, "Não foi possível autorizar o upload."),
        authorizationResponse.status,
      );
    }

    const authorization = authorizationPayload as MediaUploadAuthorization;
    assetId = authorization.assetId;
    await uploadToSignedUrl(file, authorization.uploadUrl, onProgress);

    onStage("confirming");
    const confirmationResponse = await fetch(
      `/api/media/${authorization.assetId}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      },
    );
    const confirmationPayload = await readJson(confirmationResponse);
    if (!confirmationResponse.ok) {
      throw new MediaUploadError(
        getErrorMessage(confirmationPayload, "Não foi possível confirmar a mídia."),
        confirmationResponse.status,
      );
    }

    window.dispatchEvent(new Event("voha:media-usage-changed"));
    return { assetId: authorization.assetId, file, kind: validation.kind };
  } catch (error) {
    if (assetId) {
      await fetch(`/api/media/${assetId}`, { method: "DELETE" }).catch(
        () => undefined,
      );
    }
    throw error;
  }
}
