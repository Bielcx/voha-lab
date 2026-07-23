import { NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/lib/media/access";
import type {
  NotificationMetadata,
  NotificationSeverity,
  NotificationType,
  OperationalNotification,
} from "@/lib/notifications/types";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  metadata: NotificationMetadata | null;
  read_at: string | null;
  created_at: string;
};

function toNotification(row: NotificationRow): OperationalNotification {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    body: row.body,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    access.supabase
      .from("notifications")
      .select("id, type, severity, title, body, metadata, read_at, created_at")
      .eq("workspace_id", access.workspaceId)
      .eq("user_id", access.user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    access.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", access.workspaceId)
      .eq("user_id", access.user.id)
      .is("read_at", null),
  ]);

  if (error || countError) {
    return NextResponse.json({ error: "Não foi possível carregar as notificações." }, { status: 500 });
  }

  return NextResponse.json({
    items: ((data ?? []) as NotificationRow[]).map(toNotification),
    unreadCount: count ?? 0,
  });
}

export async function PATCH() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { error } = await access.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", access.workspaceId)
    .eq("user_id", access.user.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ error: "Não foi possível marcar as notificações como lidas." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
