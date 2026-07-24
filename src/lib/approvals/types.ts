import type { PostFormat } from "@/lib/posts/types";

export const APPROVAL_DECISIONS = ["approved", "changes_requested"] as const;

export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
export type ApprovalStatus = "pending" | ApprovalDecision;
export type ApprovalAvailability =
  | "pending"
  | "approved"
  | "changes_requested"
  | "expired"
  | "revoked";

export type ApprovalMedia = {
  id: string;
  originalName: string;
  kind: "image" | "video";
  url: string;
};

export type ApprovalReview = {
  availability: ApprovalAvailability;
  approverName: string | null;
  clientName: string;
  clientHandle: string | null;
  clientColor: string;
  format: PostFormat;
  caption: string;
  firstComment: string;
  media: ApprovalMedia[];
  expiresAt: string;
  respondedAt: string | null;
  responseComment: string | null;
};

export type RequestApprovalRequest = {
  approverName?: string;
  approverEmail?: string;
  expiresInDays?: number;
};

export type RequestApprovalResponse = {
  approvalId: string;
  approvalUrl: string;
  expiresAt: string;
};

export type RespondApprovalRequest = {
  decision: ApprovalDecision;
  comment?: string;
};

export type RespondApprovalResponse = {
  decision: ApprovalDecision;
  respondedAt: string;
};
