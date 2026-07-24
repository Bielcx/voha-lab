export type WorkspaceClientSummary = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  color: string;
  posts: number;
  published: number;
  status: "Demo" | "Conectado" | "Expirando" | "Expirado" | "Erro" | "Desconectado" | "Pausado" | "Arquivado";
  clientStatus: "active" | "paused" | "archived";
  contactName: string | null;
  contactEmail: string | null;
};

export type WorkspaceBootstrapResult = {
  workspaceId: string;
  workspace: {
    name: string;
    timezone: string;
  };
  profile: {
    fullName: string;
    email: string;
  };
  mediaUsage: {
    usedBytes: number;
    limitBytes: number;
    freeTierBytes: number;
  };
  clients: WorkspaceClientSummary[];
};
