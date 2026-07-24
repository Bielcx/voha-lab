export const MEDIA_TYPE_CONFIG = {
  "image/jpeg": {
    kind: "image",
    extensions: ["jpg", "jpeg"],
    maxSizeBytes: 25 * 1024 * 1024,
  },
  "image/png": {
    kind: "image",
    extensions: ["png"],
    maxSizeBytes: 25 * 1024 * 1024,
  },
  "image/webp": {
    kind: "image",
    extensions: ["webp"],
    maxSizeBytes: 25 * 1024 * 1024,
  },
  "video/mp4": {
    kind: "video",
    extensions: ["mp4"],
    maxSizeBytes: 200 * 1024 * 1024,
  },
} as const;

export type AllowedMediaType = keyof typeof MEDIA_TYPE_CONFIG;
export type MediaKind = (typeof MEDIA_TYPE_CONFIG)[AllowedMediaType]["kind"];
export type WorkspaceRole = "owner" | "editor" | "approver";

export const R2_FREE_TIER_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
export const WORKSPACE_MEDIA_LIMIT_BYTES = 8 * 1024 * 1024 * 1024;

export type UploadCandidate = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type UploadValidationResult =
  | {
      valid: true;
      contentType: AllowedMediaType;
      kind: MediaKind;
      maxSizeBytes: number;
    }
  | { valid: false; error: string };

function getFileExtension(fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension && extension !== fileName.toLowerCase() ? extension : "";
}

export function validateUploadCandidate(
  candidate: UploadCandidate,
): UploadValidationResult {
  const normalizedName = candidate.fileName.trim();

  if (!normalizedName || normalizedName.length > 180) {
    return {
      valid: false,
      error: "O nome do arquivo deve ter entre 1 e 180 caracteres.",
    };
  }

  if (!Number.isSafeInteger(candidate.sizeBytes) || candidate.sizeBytes <= 0) {
    return { valid: false, error: "O arquivo está vazio ou possui tamanho inválido." };
  }

  if (!(candidate.contentType in MEDIA_TYPE_CONFIG)) {
    return {
      valid: false,
      error: "Formato não suportado. Use JPEG, PNG, WebP ou MP4.",
    };
  }

  const contentType = candidate.contentType as AllowedMediaType;
  const config = MEDIA_TYPE_CONFIG[contentType];
  const extension = getFileExtension(normalizedName);

  if (!(config.extensions as readonly string[]).includes(extension)) {
    return {
      valid: false,
      error: "A extensão do arquivo não corresponde ao formato informado.",
    };
  }

  if (candidate.sizeBytes > config.maxSizeBytes) {
    const limit = Math.round(config.maxSizeBytes / 1024 / 1024);
    return {
      valid: false,
      error: `O arquivo ultrapassa o limite de ${limit} MB.`,
    };
  }

  return {
    valid: true,
    contentType,
    kind: config.kind,
    maxSizeBytes: config.maxSizeBytes,
  };
}

export function canEditMedia(role: string): role is "owner" | "editor" {
  return role === "owner" || role === "editor";
}

export function validateWorkspaceUploadCapacity(
  currentUsageBytes: number,
  candidateSizeBytes: number,
) {
  if (
    !Number.isSafeInteger(currentUsageBytes)
    || currentUsageBytes < 0
    || !Number.isSafeInteger(candidateSizeBytes)
    || candidateSizeBytes <= 0
  ) {
    return { valid: false as const, error: "Não foi possível validar o espaço disponível." };
  }

  if (currentUsageBytes + candidateSizeBytes > WORKSPACE_MEDIA_LIMIT_BYTES) {
    return {
      valid: false as const,
      error: "O limite seguro de 8 GB foi atingido. Exclua mídias antes de enviar novos arquivos.",
    };
  }

  return { valid: true as const };
}

export function isWorkspaceMediaKey(key: string, workspaceId: string) {
  return (
    key.startsWith(`workspaces/${workspaceId}/media/`) &&
    !key.includes("..") &&
    !key.includes("\\")
  );
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(sizeBytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
