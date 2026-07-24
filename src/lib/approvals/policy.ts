import { z } from "zod";

import {
  APPROVAL_DECISIONS,
  type ApprovalAvailability,
  type ApprovalStatus,
} from "@/lib/approvals/types";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const requestApprovalSchema = z.object({
  approverName: z.string().trim().max(100).optional().default(""),
  approverEmail: z.union([z.literal(""), z.email()]).optional().default(""),
  expiresInDays: z.number().int().min(1).max(30).optional().default(7),
});

export const respondApprovalSchema = z
  .object({
    decision: z.enum(APPROVAL_DECISIONS),
    comment: z.string().trim().max(1_000).optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.decision === "changes_requested" && value.comment.length < 3) {
      context.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Conte o que precisa ser ajustado.",
      });
    }
  });

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function createApprovalToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function isApprovalToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export async function hashApprovalToken(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getApprovalAvailability(input: {
  status: ApprovalStatus;
  expiresAt: string;
  revokedAt: string | null;
  now?: Date;
}): ApprovalAvailability {
  if (input.revokedAt) return "revoked";
  if (input.status !== "pending") return input.status;
  if (new Date(input.expiresAt).getTime() <= (input.now ?? new Date()).getTime()) {
    return "expired";
  }
  return "pending";
}
