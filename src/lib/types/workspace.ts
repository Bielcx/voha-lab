export type WorkspaceClientSummary = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  color: string;
  posts: number;
  published: number;
  status: "Demo" | "Conectado" | "Reconectar" | "Desconectado" | "Pausado" | "Arquivado";
  clientStatus: "active" | "paused" | "archived";
  contactName: string | null;
  contactEmail: string | null;
};

export type WorkspaceBootstrapResult = {
  workspaceId: string;
  clients: WorkspaceClientSummary[];
};
