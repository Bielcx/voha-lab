export type NotificationType =
  | "publication_failed"
  | "approval_requested"
  | "approval_received"
  | "connection_expiring";

export type NotificationSeverity = "info" | "warning" | "critical";

export type NotificationMetadata = {
  postId?: string;
  clientId?: string;
  clientName?: string;
  failureCode?: string;
  expiresAt?: string;
  view?: "calendar" | "clients";
};

export type OperationalNotification = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  metadata: NotificationMetadata;
  readAt: string | null;
  createdAt: string;
};
