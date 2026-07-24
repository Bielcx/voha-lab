"use client";

import {
  AlertCircle,
  CalendarClock,
  LoaderCircle,
  Send,
  X,
} from "lucide-react";
import { useState } from "react";

import type {
  SchedulePostRequest,
  SchedulePostResponse,
} from "@/lib/posts/types";

export function ApprovedPostScheduler({
  postId,
  onClose,
  onScheduled,
}: {
  postId: string;
  onClose: () => void;
  onScheduled: (result: SchedulePostResponse) => void;
}) {
  const [mode, setMode] = useState<"now" | "schedule">("schedule");
  const [scheduledLocal, setScheduledLocal] = useState(() => {
    const date = new Date(Date.now() + 30 * 60_000);
    date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function schedule() {
    setSubmitting(true);
    setError("");
    try {
      const body: SchedulePostRequest = mode === "now"
        ? { mode: "now" }
        : { mode: "schedule", scheduledFor: new Date(scheduledLocal).toISOString() };
      const response = await fetch(`/api/posts/${postId}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null) as
        | (SchedulePostResponse & { error?: string })
        | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "Não foi possível agendar a publicação.");
      }
      onScheduled(result as SchedulePostResponse);
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Não foi possível agendar a publicação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop nested-dialog" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section className="schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="approved-schedule-title">
        <header>
          <div><span className="eyebrow">CONTEÚDO APROVADO</span><h2 id="approved-schedule-title">Quando deseja publicar?</h2><p>A aprovação foi registrada. Agora basta escolher o melhor horário.</p></div>
          <button className="icon-button" disabled={submitting} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className="schedule-options">
          <button className={mode === "now" ? "selected" : ""} onClick={() => setMode("now")}><Send size={18} /><span><strong>Publicar agora</strong><small>Entra na fila de publicação.</small></span></button>
          <button className={mode === "schedule" ? "selected" : ""} onClick={() => setMode("schedule")}><CalendarClock size={18} /><span><strong>Escolher data e horário</strong><small>Usamos o horário local do aparelho.</small></span></button>
        </div>
        {mode === "schedule" ? <label className="schedule-date"><span>Data e horário</span><input type="datetime-local" value={scheduledLocal} onChange={(event) => setScheduledLocal(event.target.value)} /></label> : null}
        {error ? <div className="creator-alert"><AlertCircle size={16} />{error}</div> : null}
        <footer>
          <button className="secondary-button" disabled={submitting} onClick={onClose}>Voltar</button>
          <button className="primary-button" disabled={submitting || (mode === "schedule" && !scheduledLocal)} onClick={() => void schedule()}>
            {submitting ? <LoaderCircle className="spin" size={16} /> : mode === "now" ? <Send size={16} /> : <CalendarClock size={16} />}
            {submitting ? "Validando…" : mode === "now" ? "Publicar agora" : "Confirmar agendamento"}
          </button>
        </footer>
      </section>
    </div>
  );
}
