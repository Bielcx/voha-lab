"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  Share2,
  UserCheck,
  X,
} from "lucide-react";
import { useState } from "react";

import type { RequestApprovalResponse } from "@/lib/approvals/types";

function errorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return "Não foi possível criar o link de aprovação.";
}

export function ApprovalRequestDialog({
  postId,
  onClose,
  onCreated,
}: {
  postId: string;
  onClose: (completed: boolean) => void;
  onCreated: () => void;
}) {
  const [approverName, setApproverName] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<RequestApprovalResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function createLink() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch(`/api/posts/${postId}/approval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approverName, approverEmail, expiresInDays }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(result));
      setCreated(result as RequestApprovalResponse);
      onCreated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : errorMessage(null));
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    await navigator.clipboard.writeText(created.approvalUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  async function shareLink() {
    if (!created) return;
    if (!navigator.share) {
      await copyLink();
      return;
    }
    await navigator.share({
      title: "Conteúdo para aprovação · Voha",
      text: "Preparei este conteúdo para sua aprovação:",
      url: created.approvalUrl,
    });
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !creating) onClose(Boolean(created));
    }}>
      <section className="approval-request-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-request-title">
        <header>
          <span className="dialog-pixel-icon"><UserCheck size={19} /></span>
          <div>
            <span className="eyebrow">LINK PRIVADO</span>
            <h2 id="approval-request-title">{created ? "Pronto para compartilhar" : "Enviar para aprovação"}</h2>
          </div>
          <button className="icon-button" onClick={() => onClose(Boolean(created))} aria-label="Fechar"><X size={18} /></button>
        </header>

        {created ? (
          <div className="approval-link-result">
            <span className="approval-created-check"><Check size={22} /></span>
            <div>
              <strong>Conteúdo aguardando aprovação</strong>
              <p>O link é individual, expira automaticamente e aceita uma única resposta.</p>
            </div>
            <label htmlFor="approval-link">Link de aprovação</label>
            <div className="approval-link-field">
              <Link2 size={16} />
              <input id="approval-link" value={created.approvalUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <button onClick={() => void copyLink()}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
            </div>
            <small>Válido até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(created.expiresAt))}.</small>
          </div>
        ) : (
          <div className="approval-request-form">
            <p>Gere um link para o cliente revisar a mídia, a legenda e o primeiro comentário sem precisar entrar no Voha.</p>
            <label htmlFor="approver-name">Nome de quem vai revisar <span>Opcional</span></label>
            <input id="approver-name" value={approverName} maxLength={100} placeholder="Ex.: Marina" onChange={(event) => setApproverName(event.target.value)} />
            <label htmlFor="approver-email">E-mail de referência <span>Opcional · não enviaremos e-mail</span></label>
            <input id="approver-email" type="email" value={approverEmail} placeholder="cliente@empresa.com" onChange={(event) => setApproverEmail(event.target.value)} />
            <label htmlFor="approval-expiry">Validade do link</label>
            <select id="approval-expiry" value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))}>
              <option value={1}>1 dia</option>
              <option value={3}>3 dias</option>
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
            <div className="approval-safety-note"><UserCheck size={16} /><span>Ao gerar um novo link, qualquer convite anterior pendente é invalidado.</span></div>
          </div>
        )}

        {error ? <p className="inline-error">{error}</p> : null}

        <footer>
          {created ? (
            <>
              <button className="secondary-button" onClick={() => window.open(created.approvalUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={16} /> Visualizar</button>
              <button className="primary-button" onClick={() => void shareLink()}><Share2 size={16} /> Compartilhar</button>
              <button className="approval-done-button" onClick={() => onClose(true)}>Concluir</button>
            </>
          ) : (
            <>
              <button className="secondary-button" disabled={creating} onClick={() => onClose(false)}>Cancelar</button>
              <button className="primary-button" disabled={creating} onClick={() => void createLink()}>
                {creating ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />}
                Gerar link
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
