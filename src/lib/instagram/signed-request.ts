import { z } from "zod";

import { constantTimeEqual } from "@/lib/instagram/crypto";

const metaSignedRequestPayloadSchema = z.object({
  algorithm: z.string().optional(),
  user_id: z.union([z.string(), z.number()]).transform(String),
  issued_at: z.number().int().optional(),
});

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

export async function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
) {
  const [providedSignature, encodedPayload, extra] = signedRequest.split(".");
  if (!providedSignature || !encodedPayload || extra !== undefined) {
    throw new Error("meta_signed_request_invalid");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );
  const expectedSignature = bytesToBase64Url(new Uint8Array(signature));

  if (!constantTimeEqual(providedSignature, expectedSignature)) {
    throw new Error("meta_signed_request_signature_invalid");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    throw new Error("meta_signed_request_payload_invalid");
  }

  const parsed = metaSignedRequestPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error("meta_signed_request_payload_invalid");
  if (
    parsed.data.algorithm
    && parsed.data.algorithm.toUpperCase() !== "HMAC-SHA256"
  ) {
    throw new Error("meta_signed_request_algorithm_invalid");
  }

  return parsed.data;
}
