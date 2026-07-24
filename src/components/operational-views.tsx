"use client";

import Image from "next/image";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ImageIcon,
  ListFilter,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import { ApprovalRequestDialog } from "@/components/approval-request-dialog";
import { ApprovedPostScheduler } from "@/components/approved-post-scheduler";
import {
  addUtcDays,
  createMonthGrid,
  getMonthQueryRange,
  getPostTimestamp,
  startOfWorkspaceWeek,
  toWorkspaceDateKey,
  utcDateKey,
  WORKSPACE_TIME_ZONE,
} from "@/lib/posts/dates";
import {
  POST_FORMAT_LABELS,
  POST_STATUS_LABELS,
  type OperationalPost,
  type PostListResponse,
  type PostStatus,
} from "@/lib/posts/types";
import type { WorkspaceClientSummary } from "@/lib/types/workspace";

type OperationalView = "dashboard" | "calendar" | "creator" | "history";

type CollectionQuery = {
  from?: string;
  to?: string;
  clientId?: string;
  status?: PostStatus;
  limit?: number;
};

const POST_DELETED_EVENT = "voha:post-deleted";

const statusClass: Record<PostStatus, string> = {
  draft: "status-draft",
  pending_approval: "status-approval",
  scheduled: "status-scheduled",
  publishing: "status-publishing",
  published: "status-published",
  failed: "status-failed",
};

const approvalCopy = {
  pending: {
    title: "Aguardando resposta",
    description: "O link está ativo e o cliente ainda não respondeu.",
  },
  approved: {
    title: "Conteúdo aprovado",
    description: "Tudo certo: esta publicação já pode ser agendada.",
  },
  changes_requested: {
    title: "Ajustes solicitados",
    description: "O conteúdo voltou para rascunho para receber uma nova versão.",
  },
  expired: {
    title: "Link expirado",
    description: "Gere um novo link de aprovação para continuar.",
  },
  revoked: {
    title: "Link substituído",
    description: "Este convite foi invalidado por uma solicitação mais recente.",
  },
} as const;

const ptDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: WORKSPACE_TIME_ZONE,
  day: "numeric",
  month: "short",
});

const ptDateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: WORKSPACE_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ptTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: WORKSPACE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const workspaceHour = new Intl.DateTimeFormat("en-US", {
  timeZone: WORKSPACE_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

const ptLongDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: WORKSPACE_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const ptMonth = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  month: "long",
});

function titleCase(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function postTitle(post: OperationalPost) {
  const firstLine = post.caption
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return `${POST_FORMAT_LABELS[post.format]} sem legenda`;
  return firstLine.length > 54 ? `${firstLine.slice(0, 51)}…` : firstLine;
}

function postDate(post: OperationalPost) {
  return new Date(getPostTimestamp(post));
}

function postTime(post: OperationalPost) {
  return ptTime.format(postDate(post));
}

function Avatar({ name, color, size = "sm" }: { name: string; color: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return <span className={`avatar avatar-${size}`} style={{ backgroundColor: color }}>{initials}</span>;
}

function Thumbnail({ post, size }: { post: OperationalPost; size: string }) {
  if (!post.thumbnailUrl) {
    return <ImageIcon size={18} />;
  }
  return (
    <Image
      src={post.thumbnailUrl}
      alt={post.mediaName ?? `Mídia de ${post.clientName}`}
      fill
      sizes={size}
      unoptimized
    />
  );
}

function usePostCollection(query: CollectionQuery, refreshKey = 0) {
  const [items, setItems] = useState<OperationalPost[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const { from, to, clientId, status, limit = 30 } = query;
  const requestKey = `${from ?? ""}|${to ?? ""}|${clientId ?? ""}|${status ?? ""}|${limit}|${refreshKey}|${retryKey}`;

  const requestPage = useCallback(async (offset: number, signal?: AbortSignal) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (clientId) params.set("clientId", clientId);
    if (status) params.set("status", status);

    const response = await fetch(`/api/posts?${params}`, {
      cache: "no-store",
      signal,
    });
    const result = (await response.json()) as PostListResponse & { error?: string };
    if (!response.ok) {
      throw new Error(result.error ?? "Não foi possível carregar as publicações.");
    }
    return result;
  }, [clientId, from, limit, status, to]);

  useEffect(() => {
    const controller = new AbortController();

    void requestPage(0, controller.signal)
      .then((result) => {
        setItems(result.items);
        setNextOffset(result.nextOffset);
        setTotal(result.total);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar as publicações.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvedRequestKey(requestKey);
      });

    return () => controller.abort();
  }, [requestKey, requestPage]);

  useEffect(() => {
    function removeDeletedPost(event: Event) {
      const postId = (event as CustomEvent<string>).detail;
      setItems((current) => current.filter((post) => post.id !== postId));
    }
    window.addEventListener(POST_DELETED_EVENT, removeDeletedPost);
    return () => window.removeEventListener(POST_DELETED_EVENT, removeDeletedPost);
  }, []);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await requestPage(nextOffset);
      setItems((current) => [...current, ...result.items]);
      setNextOffset(result.nextOffset);
      setTotal(result.total);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar mais publicações.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextOffset, requestPage]);

  return {
    items,
    total,
    loading: resolvedRequestKey !== requestKey,
    loadingMore,
    error,
    hasMore: nextOffset !== null,
    loadMore,
    retry: () => setRetryKey((key) => key + 1),
  };
}

function OperationalState({
  kind,
  title,
  description,
  onAction,
  actionLabel,
}: {
  kind: "empty" | "error";
  title: string;
  description: string;
  onAction: () => void;
  actionLabel: string;
}) {
  return (
    <div className={`operational-state ${kind}`}>
      <span>{kind === "error" ? <AlertCircle size={20} /> : <CalendarDays size={20} />}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className={kind === "error" ? "secondary-button" : "primary-button"} onClick={onAction}>
        {kind === "error" ? <RefreshCw size={15} /> : <Plus size={15} />}
        {actionLabel}
      </button>
    </div>
  );
}

function OperationalLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`operational-loading ${compact ? "compact" : ""}`} aria-label="Carregando publicações">
      {Array.from({ length: compact ? 3 : 6 }, (_, index) => <i key={index} />)}
    </div>
  );
}

export function DashboardView({
  goTo,
  onOpen,
  refreshKey,
}: {
  goTo: (view: OperationalView) => void;
  onOpen: (post: OperationalPost) => void;
  refreshKey: number;
}) {
  const now = useMemo(() => new Date(), []);
  const query = useMemo(() => ({
    from: addUtcDays(now, -32).toISOString(),
    to: addUtcDays(now, 45).toISOString(),
    limit: 100,
  }), [now]);
  const collection = usePostCollection(query, refreshKey);
  const weekStart = startOfWorkspaceWeek(now);
  const weekEnd = addUtcDays(weekStart, 7);
  const weekStartKey = utcDateKey(weekStart);
  const weekEndKey = utcDateKey(weekEnd);
  const lastThirtyDays = addUtcDays(now, -30);

  const metrics = useMemo(() => {
    const inWeek = collection.items.filter((post) => {
      const dateKey = toWorkspaceDateKey(getPostTimestamp(post));
      return dateKey >= weekStartKey && dateKey < weekEndKey;
    });
    return {
      week: inWeek.length,
      approval: collection.items.filter((post) => post.status === "pending_approval").length,
      published: collection.items.filter((post) => post.status === "published" && postDate(post) >= lastThirtyDays).length,
      failed: collection.items.filter((post) => post.status === "failed").length,
    };
  }, [collection.items, lastThirtyDays, weekEndKey, weekStartKey]);

  const nextPosts = useMemo(() => collection.items
    .filter((post) => post.status === "scheduled" && postDate(post) >= now)
    .sort((left, right) => postDate(left).getTime() - postDate(right).getTime())
    .slice(0, 4), [collection.items, now]);

  const approvals = collection.items
    .filter((post) => post.status === "pending_approval")
    .slice(0, 2);

  return (
    <main className="view view-dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{titleCase(ptLongDate.format(now))}</span>
          <h1>Bom dia, Larissa.</h1>
          <p>{metrics.week === 0 ? "Sua semana está livre para novas ideias." : `Há ${metrics.week} publicações no calendário desta semana.`}</p>
        </div>
        <button className="secondary-button" onClick={() => goTo("calendar")}><CalendarDays size={16} /> Abrir calendário</button>
      </div>
      <section className="pulse-row" aria-label="Resumo da semana">
        <div><span>Esta semana</span><strong>{metrics.week}</strong><small>publicações</small></div>
        <div><span>Aguardando aprovação</span><strong className="text-amber">{metrics.approval}</strong><small>precisam de atenção</small></div>
        <div><span>Publicados</span><strong className="text-green">{metrics.published}</strong><small>nos últimos 30 dias</small></div>
        <div><span>Falhas</span><strong>{metrics.failed}</strong><small>{metrics.failed === 0 ? "tudo funcionando" : "verifique o histórico"}</small></div>
      </section>
      <div className="dashboard-grid">
        <section className="panel upcoming-panel">
          <div className="panel-heading"><div><h2>Próximas publicações</h2><p>O que vem por aí no Instagram</p></div><button className="text-button" onClick={() => goTo("calendar")}>Ver tudo <ChevronRight size={14} /></button></div>
          {collection.loading ? <OperationalLoading compact /> : collection.error ? (
            <OperationalState kind="error" title="Agenda indisponível" description={collection.error} onAction={collection.retry} actionLabel="Tentar novamente" />
          ) : nextPosts.length === 0 ? (
            <OperationalState kind="empty" title="Nada agendado por enquanto" description="Crie o próximo conteúdo e ele aparecerá aqui automaticamente." onAction={() => goTo("creator")} actionLabel="Criar conteúdo" />
          ) : (
            <div className="upcoming-list">
              {nextPosts.map((post, index) => (
                <button className="upcoming-item animated-list-item" style={{ animationDelay: `${index * 55}ms` }} key={post.id} onClick={() => onOpen(post)}>
                  <div className="date-block"><strong>{ptDate.formatToParts(postDate(post)).find((part) => part.type === "day")?.value}</strong><span>{ptDate.formatToParts(postDate(post)).find((part) => part.type === "month")?.value?.replace(".", "").toUpperCase()}</span></div>
                  <div className={`thumb ${post.thumbnailUrl ? "" : "thumb-placeholder"}`}><Thumbnail post={post} size="52px" /></div>
                  <div className="item-copy"><strong>{postTitle(post)}</strong><span>{post.clientName} · {postTime(post)}</span></div>
                  <span className={`status-dot ${statusClass[post.status]}`} />
                  <MoreHorizontal size={18} />
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="side-stack">
          <section className="panel approval-panel">
            <div className="panel-heading"><div><h2>Aprovações</h2><p>Conteúdos aguardando retorno</p></div><span className="count-badge">{metrics.approval}</span></div>
            {approvals.length === 0 ? <p className="panel-empty-copy">Nenhum conteúdo aguardando aprovação.</p> : approvals.map((post) => (
              <button className="approval-card approval-card-button" key={post.id} onClick={() => onOpen(post)}><Avatar name={post.clientName} color={post.clientColor} /><div><strong>{postTitle(post)}</strong><span>{post.clientName}</span></div><ChevronRight size={16} /></button>
            ))}
          </section>
          <section className="panel quick-panel"><div className="quick-icon"><Plus size={19} /></div><div><h2>Comece uma ideia</h2><p>Crie, revise e agende sem sair do fluxo.</p></div><button className="primary-button" onClick={() => goTo("creator")}><Plus size={16} /> Novo conteúdo</button></section>
        </aside>
      </div>
    </main>
  );
}

function CalendarPost({ post, onOpen }: { post: OperationalPost; onOpen: (post: OperationalPost) => void }) {
  return (
    <button className={`calendar-post ${statusClass[post.status]}`} title={`${postTitle(post)} — ${POST_STATUS_LABELS[post.status]}`} onClick={() => onOpen(post)}>
      {post.thumbnailUrl ? <span className="calendar-thumb"><Thumbnail post={post} size="32px" /></span> : null}
      <span className="pixel-status-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span className="calendar-post-copy"><strong>{postTime(post)}</strong><span>{postTitle(post)}</span></span>
    </button>
  );
}

function MobileAgenda({ posts, loading, error, onCreate, onOpen, onRetry }: {
  posts: OperationalPost[];
  loading: boolean;
  error: string | null;
  onCreate: () => void;
  onOpen: (post: OperationalPost) => void;
  onRetry: () => void;
}) {
  const sortedPosts = [...posts].sort((left, right) => postDate(left).getTime() - postDate(right).getTime());
  return (
    <section className="mobile-agenda" aria-label="Publicações do período">
      <div className="mobile-agenda-head"><div><strong>Publicações do período</strong><span>{posts.length} conteúdos planejados</span></div><SlidersHorizontal size={17} /></div>
      {loading ? <OperationalLoading compact /> : error ? (
        <OperationalState kind="error" title="Agenda indisponível" description={error} onAction={onRetry} actionLabel="Tentar novamente" />
      ) : sortedPosts.length === 0 ? (
        <OperationalState kind="empty" title="Este período está livre" description="Escolha uma data e planeje a próxima publicação." onAction={onCreate} actionLabel="Criar publicação" />
      ) : (
        <div className="mobile-agenda-list">
          {sortedPosts.map((post) => (
            <button className="mobile-agenda-item" key={post.id} onClick={() => onOpen(post)}>
              <span className="mobile-date"><small>{ptDate.formatToParts(postDate(post)).find((part) => part.type === "month")?.value?.replace(".", "").toUpperCase()}</small><strong>{ptDate.formatToParts(postDate(post)).find((part) => part.type === "day")?.value}</strong></span>
              <span className={`mobile-agenda-thumb ${post.thumbnailUrl ? "" : `placeholder ${statusClass[post.status]}`}`}><Thumbnail post={post} size="48px" /></span>
              <span className="mobile-agenda-copy"><strong>{postTitle(post)}</strong><small>{post.clientName} · {postTime(post)}</small><span className={`mobile-status ${statusClass[post.status]}`}><i />{POST_STATUS_LABELS[post.status]}</span></span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      )}
      <button className="mobile-create-cta primary-button" onClick={onCreate}><Plus size={18} /> Criar nova publicação</button>
    </section>
  );
}

export function CalendarView({ clients, onCreate, onOpen, refreshKey }: {
  clients: WorkspaceClientSummary[];
  onCreate: () => void;
  onOpen: (post: OperationalPost) => void;
  refreshKey: number;
}) {
  const todayKey = toWorkspaceDateKey(new Date());
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const [mode, setMode] = useState<"Mês" | "Semana">("Mês");
  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth - 1);
  const [weekStart, setWeekStart] = useState(() => startOfWorkspaceWeek());
  const [clientId, setClientId] = useState("");
  const range = useMemo(() => mode === "Mês"
    ? getMonthQueryRange(year, month)
    : { from: addUtcDays(weekStart, -2).toISOString(), to: addUtcDays(weekStart, 9).toISOString() },
  [mode, month, weekStart, year]);
  const query = useMemo(() => ({ ...range, clientId: clientId || undefined, limit: 100 }), [clientId, range]);
  const collection = usePostCollection(query, refreshKey);
  const grid = useMemo(() => createMonthGrid(year, month), [month, year]);
  const postsByDay = useMemo(() => {
    const map = new Map<string, OperationalPost[]>();
    for (const post of collection.items) {
      const key = toWorkspaceDateKey(getPostTimestamp(post));
      const current = map.get(key) ?? [];
      current.push(post);
      map.set(key, current);
    }
    return map;
  }, [collection.items]);

  function navigate(amount: number) {
    if (mode === "Semana") {
      setWeekStart((current) => addUtcDays(current, amount * 7));
      return;
    }
    const next = new Date(Date.UTC(year, month + amount, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
  }

  function goToday() {
    setYear(todayYear);
    setMonth(todayMonth - 1);
    setWeekStart(startOfWorkspaceWeek());
  }

  const titleDate = mode === "Mês" ? new Date(Date.UTC(year, month, 15)) : weekStart;
  const titleMonth = titleCase(ptMonth.format(titleDate));
  const titleYear = titleDate.getUTCFullYear();

  return (
    <main className="view calendar-view">
      <div className="calendar-toolbar">
        <div className="calendar-title"><h1>{titleMonth} <span>{titleYear}</span></h1><div className="date-nav"><button aria-label="Período anterior" onClick={() => navigate(-1)}><ChevronLeft size={17} /></button><button onClick={goToday}>Hoje</button><button aria-label="Próximo período" onClick={() => navigate(1)}><ChevronRight size={17} /></button></div></div>
        <div className="calendar-actions">
          <label className="client-filter"><span className="avatar-stack">{clients.slice(0, 3).map((client) => <Avatar key={client.id} name={client.name} color={client.color} />)}</span><select aria-label="Filtrar por cliente" value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Todos os clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select><ChevronDown size={14} /></label>
          <div className="segmented">{(["Mês", "Semana"] as const).map((item) => <button key={item} className={mode === item ? "selected" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>
          <button className="primary-button" onClick={onCreate}><Plus size={16} /> Criar post</button>
        </div>
      </div>
      <div className="calendar-meta"><div className="legend"><span><i className="status-published" /> Publicado</span><span><i className="status-scheduled" /> Agendado</span><span><i className="status-approval" /> Em aprovação</span><span><i className="status-draft" /> Rascunho</span><span><i className="status-failed" /> Falhou</span></div><span>{collection.total} conteúdos no período</span></div>
      <MobileAgenda posts={collection.items} loading={collection.loading} error={collection.error} onCreate={onCreate} onOpen={onOpen} onRetry={collection.retry} />
      {collection.loading ? <OperationalLoading /> : collection.error ? (
        <OperationalState kind="error" title="Não foi possível abrir o calendário" description={collection.error} onAction={collection.retry} actionLabel="Tentar novamente" />
      ) : mode === "Mês" ? (
        <section className="month-calendar">
          <div className="weekdays">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="days-grid">
            {grid.map((cell) => {
              const key = utcDateKey(cell.date);
              const posts = postsByDay.get(key) ?? [];
              return <div className={`calendar-day ${cell.inMonth ? "" : "outside"} ${key === todayKey ? "today" : ""}`} key={key}><div className="day-number"><span>{cell.day}</span>{key === todayKey ? <small>HOJE</small> : null}<button aria-label={`Criar post no dia ${cell.day}`} onClick={onCreate}><Plus size={13} /></button></div>{posts.map((post) => <CalendarPost key={post.id} post={post} onOpen={onOpen} />)}</div>;
            })}
          </div>
          {collection.items.length === 0 ? <div className="calendar-empty-overlay"><span>Sem publicações neste mês.</span><button onClick={onCreate}>Planejar conteúdo</button></div> : null}
        </section>
      ) : <WeekView weekStart={weekStart} posts={collection.items} onCreate={onCreate} onOpen={onOpen} todayKey={todayKey} />}
    </main>
  );
}

function WeekView({ weekStart, posts, onCreate, onOpen, todayKey }: {
  weekStart: Date;
  posts: OperationalPost[];
  onCreate: () => void;
  onOpen: (post: OperationalPost) => void;
  todayKey: string;
}) {
  const weekDays = Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index));
  const hours = [8, 10, 12, 14, 16, 18, 20];
  return (
    <section className="week-calendar">
      <div className="week-head"><span />{weekDays.map((date) => { const key = utcDateKey(date); return <div key={key} className={key === todayKey ? "current" : ""}><small>{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"][date.getUTCDay()]}</small><strong>{date.getUTCDate()}</strong></div>; })}</div>
      <div className="week-body">
        {hours.map((hour) => <div className="time-row" key={hour}><span>{String(hour).padStart(2, "0")}:00</span>{weekDays.map((date) => <button key={utcDateKey(date)} onClick={onCreate} aria-label={`Criar post em ${utcDateKey(date)} às ${hour}:00`} />)}</div>)}
        {posts.map((post) => {
          const date = postDate(post);
          const key = toWorkspaceDateKey(date);
          const dayIndex = weekDays.findIndex((day) => utcDateKey(day) === key);
          if (dayIndex < 0) return null;
          const hour = Number(workspaceHour.format(date));
          const row = Math.max(1, Math.min(hours.length, Math.floor((hour - 8) / 2) + 1));
          return <button className={`week-event week-event-button ${statusClass[post.status]}`} style={{ gridColumn: dayIndex + 2, gridRow: `${row} / span 1` } as CSSProperties} key={post.id} onClick={() => onOpen(post)}><small>{postTime(post)} · {post.clientName}</small><strong>{postTitle(post)}</strong><span>{POST_FORMAT_LABELS[post.format]} · {POST_STATUS_LABELS[post.status]}</span></button>;
        })}
      </div>
    </section>
  );
}

export function HistoryView({ clients, onOpen, refreshKey }: {
  clients: WorkspaceClientSummary[];
  onOpen: (post: OperationalPost) => void;
  refreshKey: number;
}) {
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<PostStatus | "">("");
  const range = useMemo(() => ({ from: addUtcDays(new Date(), -30).toISOString(), to: addUtcDays(new Date(), 1).toISOString() }), []);
  const query = useMemo(() => ({ ...range, clientId: clientId || undefined, status: status || undefined, limit: 20 }), [clientId, range, status]);
  const collection = usePostCollection(query, refreshKey);

  return (
    <main className="view">
      <div className="page-heading"><div><span className="eyebrow">ÚLTIMOS 30 DIAS</span><h1>Histórico</h1><p>Acompanhe publicações, rascunhos e falhas em um só lugar.</p></div><button className="secondary-button" disabled><Share2 size={15} /> Exportar em breve</button></div>
      <div className="history-filters">
        <label><select aria-label="Filtrar histórico por cliente" value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Todos os clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select><ChevronDown size={14} /></label>
        <label><select aria-label="Filtrar histórico por estado" value={status} onChange={(event) => setStatus(event.target.value as PostStatus | "")}><option value="">Todos os estados</option>{Object.entries(POST_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={14} /></label>
        <span className="history-period">Últimos 30 dias</span><span className="filter-icon"><ListFilter size={15} /></span>
      </div>
      {collection.loading ? <OperationalLoading /> : collection.error && collection.items.length === 0 ? (
        <OperationalState kind="error" title="Histórico indisponível" description={collection.error} onAction={collection.retry} actionLabel="Tentar novamente" />
      ) : collection.items.length === 0 ? (
        <OperationalState kind="empty" title="Nenhuma atividade neste período" description="Quando um conteúdo for criado ou publicado, o histórico aparecerá aqui." onAction={() => { setClientId(""); setStatus(""); }} actionLabel="Limpar filtros" />
      ) : (
        <>
          <section className="history-table">
            <div className="table-head"><span>CONTEÚDO</span><span>CLIENTE</span><span>DATA</span><span>FORMATO</span><span>STATUS</span><span /></div>
            {collection.items.map((post) => <button className="table-row table-row-button" key={post.id} onClick={() => onOpen(post)}><div><div className={`tiny-thumb ${post.thumbnailUrl ? "" : "thumb-placeholder"}`}><Thumbnail post={post} size="44px" /></div><strong>{postTitle(post)}</strong></div><span data-label="Cliente">{post.clientName}</span><span data-label="Data">{ptDateTime.format(postDate(post))}</span><span data-label="Formato">{POST_FORMAT_LABELS[post.format]}</span><span data-label="Status" className={`status-pill ${statusClass[post.status]}`}><i />{POST_STATUS_LABELS[post.status]}</span><MoreHorizontal size={17} /></button>)}
          </section>
          {collection.hasMore ? <button className="secondary-button history-load-more" onClick={() => void collection.loadMore()} disabled={collection.loadingMore}>{collection.loadingMore ? "Carregando…" : `Carregar mais (${collection.items.length} de ${collection.total})`}</button> : null}
          {collection.error ? <p className="inline-error"><AlertCircle size={14} /> {collection.error}</p> : null}
        </>
      )}
    </main>
  );
}

export function PostDetailModal({ post, onClose, onEdit, onDuplicated, onDeleted }: {
  post: OperationalPost;
  onClose: () => void;
  onEdit: (post: OperationalPost) => void;
  onDuplicated: () => void;
  onDeleted: (postId: string) => void;
}) {
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const visibleMediaIndex = Math.min(mediaIndex, Math.max(0, post.media.length - 1));
  const detailMedia = post.media[visibleMediaIndex] ?? null;
  const approval = post.approval;
  const canScheduleApproved = post.status === "pending_approval" && approval?.status === "approved";
  const canRegenerateApproval = post.status === "pending_approval" && approval?.status !== "approved";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function duplicate() {
    setDuplicating(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}/duplicate`, { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível duplicar a publicação.");
      onDuplicated();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Não foi possível duplicar a publicação.");
    } finally {
      setDuplicating(false);
    }
  }

  async function deleteDraft() {
    if (!window.confirm("Excluir este rascunho? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Não foi possível excluir o rascunho.");
      onDeleted(post.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o rascunho.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="post-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="post-detail" role="dialog" aria-modal="true" aria-labelledby="post-detail-title">
        <header><div><span className={`status-pill ${statusClass[post.status]}`}><i />{POST_STATUS_LABELS[post.status]}</span><h2 id="post-detail-title">{postTitle(post)}</h2><p>{post.clientName} · {ptDateTime.format(postDate(post))}</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar detalhes"><X size={18} /></button></header>
        {detailMedia ? <><div className="post-detail-media">{detailMedia.kind === "image" ? <Image src={detailMedia.url} alt={detailMedia.originalName} fill sizes="520px" unoptimized /> : <video src={detailMedia.url} controls muted playsInline />}{post.media.length > 1 ? <><button className="carousel-nav previous" onClick={() => setMediaIndex((visibleMediaIndex - 1 + post.media.length) % post.media.length)} aria-label="Ver mídia anterior"><ChevronLeft size={18} /></button><button className="carousel-nav next" onClick={() => setMediaIndex((visibleMediaIndex + 1) % post.media.length)} aria-label="Ver próxima mídia"><ChevronRight size={18} /></button><span className="carousel-count">{visibleMediaIndex + 1}/{post.media.length}</span></> : null}</div>{post.media.length > 1 ? <div className="carousel-dots detail-carousel-dots" aria-label="Mídias do carrossel">{post.media.map((item, index) => <button className={index === visibleMediaIndex ? "active" : ""} key={item.id} onClick={() => setMediaIndex(index)} aria-label={`Ver mídia ${index + 1}`} />)}</div> : null}</> : null}
        <dl><div><dt>Formato</dt><dd>{POST_FORMAT_LABELS[post.format]}</dd></div><div><dt>Fuso horário</dt><dd>São Paulo (GMT-3)</dd></div></dl>
        {approval ? (
          <div className={`post-approval-state approval-${approval.status}`}>
            {approval.status === "approved"
              ? <CheckCircle2 size={18} />
              : approval.status === "pending"
                ? <Clock3 size={18} />
                : <MessageSquareText size={18} />}
            <div>
              <strong>{approvalCopy[approval.status].title}</strong>
              <p>{approvalCopy[approval.status].description}</p>
              {approval.approverName ? <small>Revisor: {approval.approverName}</small> : null}
              {approval.comment ? <blockquote>{approval.comment}</blockquote> : null}
            </div>
          </div>
        ) : null}
        <div className="post-detail-copy"><span>Legenda</span><p>{post.caption || "Sem legenda."}</p>{post.firstComment ? <><span>Primeiro comentário</span><p>{post.firstComment}</p></> : null}</div>
        {post.status === "failed" ? <div className="post-failure"><AlertCircle size={16} /><div><strong>Falha na publicação</strong><p>{post.failureMessage ?? "A plataforma não informou detalhes da falha."}</p></div></div> : null}
        {error ? <p className="inline-error"><AlertCircle size={14} /> {error}</p> : null}
        <footer>{post.status === "draft" ? <button className="secondary-button danger-button" onClick={() => void deleteDraft()} disabled={deleting}><Trash2 size={15} /> {deleting ? "Excluindo…" : "Excluir rascunho"}</button> : null}{post.status === "draft" || post.status === "failed" ? <button className="secondary-button" onClick={() => onEdit(post)}><Pencil size={15} /> Editar conteúdo</button> : null}{canRegenerateApproval ? <button className="secondary-button" onClick={() => setApprovalOpen(true)}><Share2 size={15} /> Gerar novo link</button> : null}{canScheduleApproved ? <button className="primary-button" onClick={() => setSchedulerOpen(true)}><CalendarDays size={15} /> Agendar aprovado</button> : null}<button className={canScheduleApproved ? "secondary-button" : "primary-button"} onClick={() => void duplicate()} disabled={duplicating}><Copy size={15} /> {duplicating ? "Duplicando…" : "Duplicar como rascunho"}</button></footer>
      </section>
      {schedulerOpen ? <ApprovedPostScheduler postId={post.id} onClose={() => setSchedulerOpen(false)} onScheduled={() => window.location.reload()} /> : null}
      {approvalOpen ? <ApprovalRequestDialog postId={post.id} onCreated={() => undefined} onClose={(completed) => { setApprovalOpen(false); if (completed) window.location.reload(); }} /> : null}
    </div>
  );
}
