"use client";

import {
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import type {
  ApprovalAvailability,
  ApprovalDecision,
  ApprovalReview,
  RespondApprovalResponse,
} from "@/lib/approvals/types";
import { POST_FORMAT_LABELS } from "@/lib/posts/types";

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

const terminalCopy: Record<Exclude<ApprovalAvailability, "pending">, {
  title: string;
  description: string;
}> = {
  approved: {
    title: "Conteúdo aprovado",
    description: "A resposta já foi registrada. Quem criou o conteúdo foi avisado.",
  },
  changes_requested: {
    title: "Ajustes enviados",
    description: "Seu comentário já foi registrado para a próxima versão.",
  },
  expired: {
    title: "Este link expirou",
    description: "Peça um novo link para quem enviou o conteúdo.",
  },
  revoked: {
    title: "Este link foi substituído",
    description: "Uma nova versão pode estar disponível. Peça o link mais recente.",
  },
};

export function ApprovalReviewClient({
  token,
  initialReview,
}: {
  token: string;
  initialReview: ApprovalReview;
}) {
  const [availability, setAvailability] = useState(initialReview.availability);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [comment, setComment] = useState("");
  const [changesOpen, setChangesOpen] = useState(false);
  const [submitting, setSubmitting] = useState<ApprovalDecision | null>(null);
  const [error, setError] = useState("");
  const media = initialReview.media[mediaIndex] ?? null;
  const accountHandle = initialReview.clientHandle?.replace(/^@/, "") || "instagram";
  const greeting = useMemo(
    () => initialReview.approverName?.trim()
      ? `Olá, ${initialReview.approverName.trim().split(" ")[0]}`
      : "Olá",
    [initialReview.approverName],
  );

  async function respond(decision: ApprovalDecision) {
    if (decision === "changes_requested" && comment.trim().length < 3) {
      setError("Conte brevemente o que precisa ser ajustado.");
      return;
    }

    setSubmitting(decision);
    setError("");
    try {
      const response = await fetch(`/api/approvals/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      const result = await response.json().catch(() => null) as
        | (RespondApprovalResponse & { error?: string })
        | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "Não foi possível registrar sua resposta.");
      }
      setAvailability(result?.decision ?? decision);
      setChangesOpen(false);
    } catch (responseError) {
      setError(responseError instanceof Error
        ? responseError.message
        : "Não foi possível registrar sua resposta.");
    } finally {
      setSubmitting(null);
    }
  }

  if (availability !== "pending") {
    const copy = terminalCopy[availability];
    const positive = availability === "approved";
    return (
      <main className="approval-page">
        <section className="approval-result">
          <span className="approval-brand"><i /> VOHA</span>
          <div className={`approval-result-icon ${positive ? "positive" : ""}`}>
            {positive ? <CheckCircle2 size={32} /> : <MessageSquareText size={30} />}
          </div>
          <span className="approval-result-client">{initialReview.clientName}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          {initialReview.responseComment ? <blockquote>{initialReview.responseComment}</blockquote> : null}
          <small>Você já pode fechar esta página.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="approval-page approval-review-page">
      <header className="approval-topbar">
        <span className="approval-brand"><i /> VOHA</span>
        <span><ShieldCheck size={15} /> revisão segura</span>
      </header>

      <section className="approval-intro">
        <span className="approval-kicker">APROVAÇÃO DE CONTEÚDO</span>
        <h1>{greeting}. Vamos revisar?</h1>
        <p>Confira a mídia e o texto exatamente na ordem preparada para o Instagram.</p>
      </section>

      <div className="approval-layout">
        <section className="approval-phone" aria-label="Prévia do conteúdo no Instagram">
          <header>
            <span className="approval-avatar" style={{ backgroundColor: initialReview.clientColor }}>
              {initials(initialReview.clientName)}
            </span>
            <span><strong>{accountHandle}</strong><small>Instagram</small></span>
            <b>•••</b>
          </header>

          <div className="approval-media">
            {media?.kind === "image"
              ? <Image src={media.url} alt={media.originalName} fill sizes="(max-width: 640px) 100vw, 520px" priority unoptimized />
              : media?.kind === "video"
                ? <video src={media.url} controls playsInline preload="metadata" />
                : <div className="approval-media-empty">Mídia indisponível</div>}
            {initialReview.media.length > 1 ? (
              <>
                <button
                  className="carousel-nav previous"
                  onClick={() => setMediaIndex((mediaIndex - 1 + initialReview.media.length) % initialReview.media.length)}
                  aria-label="Ver mídia anterior"
                ><ChevronLeft size={19} /></button>
                <button
                  className="carousel-nav next"
                  onClick={() => setMediaIndex((mediaIndex + 1) % initialReview.media.length)}
                  aria-label="Ver próxima mídia"
                ><ChevronRight size={19} /></button>
                <span className="carousel-count">{mediaIndex + 1}/{initialReview.media.length}</span>
              </>
            ) : null}
          </div>

          {initialReview.media.length > 1 ? (
            <div className="carousel-dots approval-dots">
              {initialReview.media.map((item, index) => (
                <button
                  key={item.id}
                  className={index === mediaIndex ? "active" : ""}
                  onClick={() => setMediaIndex(index)}
                  aria-label={`Ver mídia ${index + 1}`}
                />
              ))}
            </div>
          ) : null}

          <div className="approval-insta-actions">
            <span><Heart size={23} /><MessageCircle size={22} /><Send size={21} /></span>
            <Bookmark size={21} />
          </div>
          <div className="approval-copy">
            <p><strong>{accountHandle}</strong> {initialReview.caption || "Sem legenda."}</p>
            {initialReview.firstComment ? (
              <p className="approval-first-comment"><strong>{accountHandle}</strong> {initialReview.firstComment}</p>
            ) : null}
          </div>
        </section>

        <aside className="approval-decision">
          <div className="approval-summary">
            <span>{POST_FORMAT_LABELS[initialReview.format]}</span>
            <span>{initialReview.media.length} {initialReview.media.length === 1 ? "mídia" : "mídias"}</span>
          </div>
          <h2>Tudo certo para publicar?</h2>
          <p>Aprovar libera este conteúdo para agendamento. Se algo precisar mudar, deixe uma orientação objetiva.</p>

          {changesOpen ? (
            <div className="approval-comment-box">
              <label htmlFor="approval-comment">O que precisa ser ajustado?</label>
              <textarea
                id="approval-comment"
                value={comment}
                maxLength={1_000}
                autoFocus
                placeholder="Ex.: trocar a primeira foto e ajustar a chamada…"
                onChange={(event) => setComment(event.target.value)}
              />
              <small>{comment.length}/1.000</small>
            </div>
          ) : null}

          {error ? <p className="approval-error"><XCircle size={15} /> {error}</p> : null}

          <div className="approval-buttons">
            <button
              className="approval-approve"
              disabled={Boolean(submitting)}
              onClick={() => void respond("approved")}
            >
              {submitting === "approved" ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
              Aprovar conteúdo
            </button>
            {changesOpen ? (
              <>
                <button
                  className="approval-request-changes"
                  disabled={Boolean(submitting)}
                  onClick={() => void respond("changes_requested")}
                >
                  {submitting === "changes_requested" ? <LoaderCircle className="spin" size={17} /> : <MessageSquareText size={17} />}
                  Enviar ajustes
                </button>
                <button className="approval-cancel" disabled={Boolean(submitting)} onClick={() => { setChangesOpen(false); setError(""); }}>
                  Cancelar
                </button>
              </>
            ) : (
              <button className="approval-request-changes" onClick={() => setChangesOpen(true)}>
                <MessageSquareText size={17} /> Pedir ajustes
              </button>
            )}
          </div>
          <small className="approval-expiry">Link válido até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(initialReview.expiresAt))}.</small>
        </aside>
      </div>
    </main>
  );
}
