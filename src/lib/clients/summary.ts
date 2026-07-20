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
    | { connection_status: InstagramConnectionStatus; token_expires_at: string | null }[]
    | { connection_status: InstagramConnectionStatus; token_expires_at: string | null }
    | null;
};

const DEFAULT_CLIENT_COLOR = "#7568A8";
const TOKEN_EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function getClientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getConnection(row: ClientSummaryRow) {
  const account = Array.isArray(row.instagram_accounts)
    ? row.instagram_accounts[0]
    : row.instagram_accounts;
  return account ?? { connection_status: "disconnected" as const, token_expires_at: null };
}

export function getInstagramDisplayStatus(
  connectionStatus: InstagramConnectionStatus,
  tokenExpiresAt: string | null,
  now = Date.now(),
): WorkspaceClientSummary["status"] {
  if (connectionStatus === "expired") return "Expirado";
  if (connectionStatus === "error") return "Erro";
  if (connectionStatus !== "connected") return "Desconectado";

  if (tokenExpiresAt) {
    const expiresAt = new Date(tokenExpiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= now) return "Expirado";
    if (Number.isFinite(expiresAt) && expiresAt - now <= TOKEN_EXPIRING_WINDOW_MS) {
      return "Expirando";
    }
  }
  return "Conectado";
}

function getDisplayStatus(row: ClientSummaryRow): WorkspaceClientSummary["status"] {
  if (row.status === "archived") return "Arquivado";
  if (row.status === "paused") return "Pausado";

  const connection = getConnection(row);
  return getInstagramDisplayStatus(
    connection.connection_status,
    connection.token_expires_at,
  );
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
