import type { WorkspaceClientSummary } from "@/lib/types/workspace";

export type ClientStatus = "active" | "paused" | "archived";
export type InstagramConnectionStatus = "disconnected" | "connected" | "expired" | "error";

export type ClientSummaryRow = {
  id: string;
  name: string;
  instagram_handle: string | null;
  brand_color: string | null;
  status: ClientStatus;
  contact_name: string | null;
  contact_email: string | null;
  instagram_accounts:
    | { connection_status: InstagramConnectionStatus }[]
    | { connection_status: InstagramConnectionStatus }
    | null;
};

const DEFAULT_CLIENT_COLOR = "#7568A8";

export function getClientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getConnectionStatus(row: ClientSummaryRow) {
  const account = Array.isArray(row.instagram_accounts)
    ? row.instagram_accounts[0]
    : row.instagram_accounts;
  return account?.connection_status ?? "disconnected";
}

function getDisplayStatus(row: ClientSummaryRow): WorkspaceClientSummary["status"] {
  if (row.status === "archived") return "Arquivado";
  if (row.status === "paused") return "Pausado";

  const connectionStatus = getConnectionStatus(row);
  if (connectionStatus === "connected") return "Conectado";
  if (connectionStatus === "expired" || connectionStatus === "error") return "Reconectar";
  return "Desconectado";
}

export function toWorkspaceClientSummary(
  row: ClientSummaryRow,
  counts: { posts: number; published: number } = { posts: 0, published: 0 },
): WorkspaceClientSummary {
  return {
    id: row.id,
    name: row.name,
    handle: row.instagram_handle || "Sem Instagram conectado",
    initials: getClientInitials(row.name),
    color: row.brand_color || DEFAULT_CLIENT_COLOR,
    posts: counts.posts,
    published: counts.published,
    status: getDisplayStatus(row),
    clientStatus: row.status,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
  };
}
