"use client";

import {
  Archive,
  Check,
  ChevronRight,
  CirclePause,
  MoreHorizontal,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import type { WorkspaceClientSummary } from "@/lib/types/workspace";

type ClientDraft = {
  name: string;
  instagramHandle: string;
  contactName: string;
  contactEmail: string;
  brandColor: string;
};

const brandColors = ["#FF5C45", "#64825C", "#7568A8", "#B66A3C", "#2476B8", "#B87C7C"];
const EMPTY_DRAFT: ClientDraft = {
  name: "",
  instagramHandle: "",
  contactName: "",
  contactEmail: "",
  brandColor: "#FF5C45",
};

function ClientAvatar({ client, size = "lg" }: { client: WorkspaceClientSummary; size?: "sm" | "lg" }) {
  return (
    <span className={`avatar avatar-${size}`} style={{ backgroundColor: client.color }}>
      {client.initials}
    </span>
  );
}

function toDraft(client: WorkspaceClientSummary): ClientDraft {
  return {
    name: client.name,
    instagramHandle: client.handle === "Sem Instagram conectado" ? "" : client.handle,
    contactName: client.contactName ?? "",
    contactEmail: client.contactEmail ?? "",
    brandColor: client.color,
  };
}

function connectionLabel(status: WorkspaceClientSummary["status"]) {
  if (status === "Conectado") return "Instagram conectado";
  if (status === "Reconectar") return "Reconectar Instagram";
  if (status === "Pausado") return "Cliente pausado";
  if (status === "Demo") return "Dados de demonstração";
  return "Instagram não conectado";
}

function connectionClass(status: WorkspaceClientSummary["status"]) {
  if (status === "Conectado") return "connection-ok";
  if (status === "Reconectar") return "connection-warning";
  if (status === "Demo") return "connection-demo";
  return "connection-muted";
}

type ClientsViewProps = {
  clients: WorkspaceClientSummary[];
  backendEnabled: boolean;
  onClientsChange: (clients: WorkspaceClientSummary[]) => void;
  onOpenCalendar: () => void;
  onNotice: (message: string) => void;
};

export function ClientManagement({
  clients,
  backendEnabled,
  onClientsChange,
  onOpenCalendar,
  onNotice,
}: ClientsViewProps) {
  const [editingClient, setEditingClient] = useState<WorkspaceClientSummary | null | undefined>(undefined);
  const [draft, setDraft] = useState<ClientDraft>(EMPTY_DRAFT);
  const [menuClientId, setMenuClientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setMenuClientId(null);
    setEditingClient(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function openEdit(client: WorkspaceClientSummary) {
    setMenuClientId(null);
    setEditingClient(client);
    setDraft(toDraft(client));
    setError(null);
  }

  function closeEditor() {
    if (saving) return;
    setEditingClient(undefined);
    setError(null);
  }

  const editorIsOpen = editingClient !== undefined;

  async function refreshClients() {
    const response = await fetch("/api/clients");
    const result = (await response.json().catch(() => null)) as
      | { clients?: WorkspaceClientSummary[]; error?: string }
      | null;
    if (!response.ok || !result?.clients) {
      throw new Error(result?.error ?? "Não foi possível atualizar seus clientes.");
    }
    onClientsChange(result.clients);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!backendEnabled) {
      setError("Conecte o Supabase para salvar clientes reais.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      name: draft.name,
      instagramHandle: draft.instagramHandle || null,
      contactName: draft.contactName || null,
      contactEmail: draft.contactEmail || null,
      brandColor: draft.brandColor || null,
    };
    const endpoint = editingClient ? `/api/clients/${editingClient.id}` : "/api/clients";
    const method = editingClient ? "PATCH" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Não foi possível salvar este cliente.");

      await refreshClients();
      setEditingClient(undefined);
      onNotice(editingClient ? "Cliente atualizado." : "Cliente criado.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar este cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(client: WorkspaceClientSummary, status: "active" | "paused") {
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Não foi possível alterar o status.");
      await refreshClients();
      onNotice(status === "paused" ? "Cliente pausado." : "Cliente reativado.");
    } catch (statusError) {
      onNotice(statusError instanceof Error ? statusError.message : "Não foi possível alterar o status.");
    }
  }

  async function archiveClient(client: WorkspaceClientSummary) {
    if (!window.confirm(`Arquivar ${client.name}? Os conteúdos existentes serão preservados.`)) return;

    try {
      const response = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Não foi possível arquivar este cliente.");
      await refreshClients();
      onNotice("Cliente arquivado.");
    } catch (archiveError) {
      onNotice(archiveError instanceof Error ? archiveError.message : "Não foi possível arquivar este cliente.");
    }
  }

  return (
    <main className="view clients-view">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{clients.length} CONTAS GERENCIADAS</span>
          <h1>Clientes</h1>
          <p>Organize perfis e acompanhe a conexão com o Instagram.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {!backendEnabled ? (
        <div className="clients-demo-notice">
          <span>Modo de demonstração</span>
          <p>Ao conectar o Supabase, você poderá salvar clientes reais neste workspace.</p>
        </div>
      ) : null}

      {clients.length === 0 ? (
        <section className="clients-empty">
          <span><Plus size={20} /></span>
          <h2>Seu primeiro cliente começa aqui</h2>
          <p>Cadastre o perfil, escolha uma cor e conecte o Instagram quando estiver pronto.</p>
          <button className="primary-button" onClick={openCreate}><Plus size={16} /> Criar cliente</button>
        </section>
      ) : (
        <section className="client-grid">
          {clients.map((client) => (
            <article className="client-card" key={client.id}>
              <div className="client-cover" style={{ backgroundColor: `${client.color}20` }}>
                <span style={{ backgroundColor: client.color }} />
                <button className="client-more" onClick={() => setMenuClientId(menuClientId === client.id ? null : client.id)} aria-label={`Opções de ${client.name}`} aria-expanded={menuClientId === client.id}>
                  <MoreHorizontal size={18} />
                </button>
                {menuClientId === client.id ? (
                  <div className="client-menu">
                    <button onClick={() => openEdit(client)}><Pencil size={14} /> Editar</button>
                    <button onClick={() => void updateStatus(client, client.clientStatus === "paused" ? "active" : "paused")}><CirclePause size={14} />{client.clientStatus === "paused" ? "Reativar" : "Pausar"}</button>
                    <button className="danger" onClick={() => void archiveClient(client)}><Archive size={14} /> Arquivar</button>
                  </div>
                ) : null}
              </div>
              <div className="client-info"><ClientAvatar client={client} /><div><h2>{client.name}</h2><p>{client.handle}</p></div></div>
              <div className="client-stats"><span><strong>{client.posts}</strong> agendados</span><span><strong>{client.published}</strong> publicados</span></div>
              <div className="client-footer"><span className={connectionClass(client.status)}><i />{connectionLabel(client.status)}</span><button onClick={onOpenCalendar}>Ver calendário <ChevronRight size={14} /></button></div>
            </article>
          ))}
        </section>
      )}

      {editorIsOpen ? (
        <div className="client-dialog-layer" role="presentation">
          <button className="client-dialog-backdrop" onClick={closeEditor} aria-label="Fechar formulário" />
          <section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="client-dialog-title">
            <div className="client-dialog-header">
              <div><span className="eyebrow">{editingClient ? "EDITAR CLIENTE" : "NOVO CLIENTE"}</span><h2 id="client-dialog-title">{editingClient ? editingClient.name : "Adicionar cliente"}</h2></div>
              <button className="icon-button" onClick={closeEditor} aria-label="Fechar"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <label>Nome do cliente<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Estúdio Aurora" required minLength={2} maxLength={80} /></label>
              <label>Instagram <input value={draft.instagramHandle} onChange={(event) => setDraft({ ...draft, instagramHandle: event.target.value })} placeholder="@estudioaurora" maxLength={31} /></label>
              <div className="client-form-two-columns"><label>Contato<input value={draft.contactName} onChange={(event) => setDraft({ ...draft, contactName: event.target.value })} placeholder="Nome da pessoa" maxLength={120} /></label><label>E-mail<input type="email" value={draft.contactEmail} onChange={(event) => setDraft({ ...draft, contactEmail: event.target.value })} placeholder="contato@cliente.com" maxLength={160} /></label></div>
              <fieldset><legend>Cor da marca</legend><div className="client-color-options">{brandColors.map((color) => <button type="button" key={color} className={draft.brandColor === color ? "selected" : ""} style={{ backgroundColor: color }} onClick={() => setDraft({ ...draft, brandColor: color })} aria-label={`Selecionar cor ${color}`}>{draft.brandColor === color ? <Check size={13} /> : null}</button>)}</div></fieldset>
              {error ? <p className="client-form-error" role="alert">{error}</p> : null}
              <div className="client-dialog-actions"><button type="button" className="secondary-button" onClick={closeEditor} disabled={saving}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Salvando…" : editingClient ? "Salvar alterações" : "Criar cliente"}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
