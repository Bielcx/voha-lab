export type WorkspaceClientSummary = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  color: string;
  posts: number;
  published: number;
  status: "Demo" | "Conectado" | "Reconectar";
};

export type WorkspaceBootstrapResult = {
  workspaceId: string;
  clients: WorkspaceClientSummary[];
};
