"use client";

import Image from "next/image";
import {
  AlertCircle,
  AtSign,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  FileText,
  Grid2X2,
  Heart,
  History,
  Home,
  ImageIcon,
  LayoutGrid,
  Library,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sun,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import {
  CalendarView,
  DashboardView,
  HistoryView,
  PostDetailModal,
} from "@/components/operational-views";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env/public";
import type { OperationalPost } from "@/lib/posts/types";
import type { WorkspaceBootstrapResult, WorkspaceClientSummary } from "@/lib/types/workspace";
import { MediaLibrary } from "@/components/media-library";
import { ClientManagement } from "@/components/client-management";

type View = "dashboard" | "calendar" | "creator" | "clients" | "media" | "history" | "settings";

const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Início", icon: Home },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "creator", label: "Criar conteúdo", icon: Plus },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "media", label: "Biblioteca", icon: Library },
  { id: "history", label: "Histórico", icon: History },
];

const demoClients: WorkspaceClientSummary[] = [
  { id: "demo-alba-cafe", name: "Alba Café", handle: "@albacafe", initials: "AC", color: "#B66A3C", posts: 8, published: 24, status: "Demo", clientStatus: "active", contactName: null, contactEmail: null },
  { id: "demo-flora-studio", name: "Flora Studio", handle: "@florastudio", initials: "FS", color: "#64825C", posts: 5, published: 18, status: "Demo", clientStatus: "active", contactName: null, contactEmail: null },
  { id: "demo-noma-skin", name: "Noma Skin", handle: "@nomaskin", initials: "NS", color: "#B87C7C", posts: 4, published: 15, status: "Demo", clientStatus: "active", contactName: null, contactEmail: null },
  { id: "demo-sopro-yoga", name: "Sopro Yoga", handle: "@soproyoga", initials: "SY", color: "#7F77A8", posts: 3, published: 11, status: "Demo", clientStatus: "active", contactName: null, contactEmail: null },
];

const media = [
  { id: 1, src: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=85", alt: "Interior acolhedor do Alba Café", type: "Imagem", client: "Alba Café" },
  { id: 2, src: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85", alt: "Café sendo preparado", type: "Reel", client: "Alba Café" },
  { id: 3, src: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=85", alt: "Produtos de skincare Noma Skin", type: "Carrossel", client: "Noma Skin" },
  { id: 4, src: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=85", alt: "Prática de yoga", type: "Imagem", client: "Sopro Yoga" },
  { id: 5, src: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85", alt: "Plantas do Flora Studio", type: "Reel", client: "Flora Studio" },
  { id: 6, src: "https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=900&q=85", alt: "Detalhes artesanais", type: "Imagem", client: "Flora Studio" },
];

const pixelHeart = [
  "031000130",
  "111101111",
  "111111111",
  "112111211",
  "011212110",
  "001222100",
  "000121000",
  "000010000",
];

function PixelGrid({ pattern, className, label }: { pattern: string[]; className: string; label?: string }) {
  return <span className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ "--pixel-cols": pattern[0].length } as CSSProperties}>{pattern.flatMap((row, rowIndex) => [...row].map((tone, columnIndex) => <i className={`pixel-tone-${tone}`} key={`${rowIndex}-${columnIndex}`} />))}</span>;
}

function BrandMark() {
  return <span className="brand-mark"><PixelGrid pattern={pixelHeart} className="pixel-heart" label="Voha" /></span>;
}

function Avatar({ name, color = "#B66A3C", size = "md" }: { name: string; color?: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return <span className={`avatar avatar-${size}`} style={{ backgroundColor: color }}>{initials}</span>;
}

function Sidebar({ active, setActive, open, onClose, onLogout, onAddClient, clients }: { active: View; setActive: (view: View) => void; open: boolean; onClose: () => void; onLogout: () => void; onAddClient: () => void; clients: WorkspaceClientSummary[] }) {
  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-head">
        <button className="brand-button" onClick={() => setActive("dashboard")} aria-label="Ir para o início"><BrandMark /><span className="brand-name">voha</span></button>
        <button className="icon-button sidebar-close" onClick={onClose} aria-label="Fechar menu"><X size={18} /></button>
      </div>
      <button className="workspace-switcher">
        <Avatar name="Larissa Cruz" color="#333238" size="sm" />
        <span><strong>Larissa Cruz</strong><small>Workspace</small></span>
        <ChevronDown size={14} />
      </button>
      <nav className="main-nav" aria-label="Navegação principal">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); onClose(); }}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === "creator" ? <kbd>C</kbd> : null}
          </button>
        ))}
      </nav>
      <div className="sidebar-clients">
        <div className="sidebar-label"><span>Clientes</span><button onClick={onAddClient} aria-label="Adicionar cliente"><Plus size={14} /></button></div>
        {clients.slice(0, 4).map((client) => (
          <button key={client.name} onClick={() => setActive("calendar")}>
            <Avatar name={client.name} color={client.color} size="sm" /><span>{client.name}</span>
            {client.status === "Reconectar" ? <AlertCircle className="warning-icon" size={14} /> : null}
          </button>
        ))}
      </div>
      <div className="sidebar-bottom">
        <button><CircleHelp size={17} /><span>Ajuda e atalhos</span></button>
        <button className={active === "settings" ? "active" : ""} onClick={() => setActive("settings")}><Settings size={17} /><span>Configurações</span></button>
        <button onClick={onLogout}><LogOut size={17} /><span>Sair</span></button>
        <div className="storage"><span><ImageIcon size={14} /> Armazenamento</span><small>1,2 GB de 10 GB</small><i><b /></i></div>
      </div>
    </aside>
  );
}

function Topbar({ active, onMenu, onCreate, dark, setDark }: { active: View; onMenu: () => void; onCreate: () => void; dark: boolean; setDark: (dark: boolean) => void }) {
  const titles: Record<View, string> = { dashboard: "Visão geral", calendar: "Calendário", creator: "Novo conteúdo", clients: "Clientes", media: "Biblioteca", history: "Histórico", settings: "Configurações" };
  return (
    <header className="topbar">
      <div className="topbar-title"><button className="icon-button mobile-menu" onClick={onMenu} aria-label="Abrir menu"><Menu size={19} /></button><span className="mobile-top-brand"><BrandMark /><b>voha</b></span><span className="desktop-view-title">{titles[active]}</span></div>
      <div className="topbar-actions">
        <button className="search-button"><Search size={16} /><span>Buscar no Voha</span><kbd><Command size={11} /> K</kbd></button>
        <button className={`icon-button theme-toggle ${dark ? "is-dark" : ""}`} onClick={() => setDark(!dark)} aria-pressed={dark} aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}><span>{dark ? <Sun size={18} /> : <Moon size={18} />}</span></button>
        <button className="icon-button notification-button" aria-label="Notificações"><Bell size={18} /><i /></button>
        <button className="primary-button top-create" onClick={onCreate}><Plus size={16} /> Criar post</button>
      </div>
    </header>
  );
}

/* Legacy static operational prototype retained temporarily for visual reference.
function DashboardView({ goTo }: { goTo: (view: View) => void }) {
  const nextPosts = calendarPosts.filter((post) => post.status === "Agendado").slice(0, 4);
  return (
    <main className="view view-dashboard">
      <div className="page-heading"><div><span className="eyebrow">Segunda-feira, 13 de julho</span><h1>Bom dia, Larissa.</h1><p>Seu calendário está tranquilo. Há 6 publicações agendadas esta semana.</p></div><button className="secondary-button" onClick={() => goTo("calendar")}><CalendarDays size={16} /> Abrir calendário</button></div>
      <section className="pulse-row" aria-label="Resumo da semana">
        <div><span>Esta semana</span><NumberTicker value={8} /><small>publicações</small></div>
        <div><span>Aguardando aprovação</span><NumberTicker value={2} className="text-amber" /><small>precisam de atenção</small></div>
        <div><span>Publicados</span><NumberTicker value={12} className="text-green" /><small>nos últimos 30 dias</small></div>
        <div><span>Falhas</span><NumberTicker value={0} /><small>tudo funcionando</small></div>
      </section>
      <div className="dashboard-grid">
        <section className="panel upcoming-panel">
          <div className="panel-heading"><div><h2>Próximas publicações</h2><p>O que vem por aí no Instagram</p></div><button className="text-button" onClick={() => goTo("calendar")}>Ver tudo <ChevronRight size={14} /></button></div>
          <div className="upcoming-list">
            {nextPosts.map((post, index) => (
              <button className="upcoming-item animated-list-item" style={{ animationDelay: `${index * 55}ms` }} key={`${post.day}-${post.title}`} onClick={() => goTo("creator")}>
                <div className="date-block"><strong>{post.day}</strong><span>JUL</span></div>
                {post.image ? <div className="thumb"><Image src={post.image} alt="" fill sizes="52px" /></div> : <div className="thumb thumb-placeholder"><ImageIcon size={18} /></div>}
                <div className="item-copy"><strong>{post.title}</strong><span>{post.client} · {post.time}</span></div>
                <span className={`status-dot ${statusClass[post.status]}`} />
                <MoreHorizontal size={18} />
              </button>
            ))}
          </div>
        </section>
        <aside className="side-stack">
          <section className="panel approval-panel">
            <div className="panel-heading"><div><h2>Aprovações</h2><p>Conteúdos aguardando retorno</p></div><span className="count-badge">2</span></div>
            <div className="approval-card"><Avatar name="Alba Café" color="#B66A3C" size="sm" /><div><strong>Do grão à xícara</strong><span>Enviado há 2 horas</span></div><ChevronRight size={16} /></div>
            <div className="approval-card"><Avatar name="Flora Studio" color="#64825C" size="sm" /><div><strong>Novos vasos da coleção</strong><span>Enviado ontem</span></div><ChevronRight size={16} /></div>
          </section>
          <section className="panel quick-panel"><div className="quick-icon pixel-sprite-wrap"><PixelGrid pattern={pixelSpark} className="pixel-spark" label="Nova ideia" /></div><div><h2>Comece uma ideia</h2><p>Crie, revise e agende sem sair do fluxo.</p></div><button className="primary-button" onClick={() => goTo("creator")}><Plus size={16} /> Novo conteúdo</button></section>
        </aside>
      </div>
    </main>
  );
}

function CalendarPost({ post }: { post: (typeof calendarPosts)[number] }) {
  return (
    <button className={`calendar-post ${statusClass[post.status]}`} title={`${post.title} — ${post.status}`}>
      {post.image ? <span className="calendar-thumb"><Image src={post.image} alt="" fill sizes="32px" /></span> : null}
      <PixelStatusMark status={post.status} />
      <span className="calendar-post-copy"><strong>{post.time}</strong><span>{post.title}</span></span>
    </button>
  );
}

function MobileAgenda({ onCreate }: { onCreate: () => void }) {
  const upcomingPosts = calendarPosts.filter((post) => post.day >= 13);
  const weekNames = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  return (
    <section className="mobile-agenda" aria-label="Próximas publicações">
      <div className="mobile-agenda-head"><div><strong>Próximas publicações</strong><span>{upcomingPosts.length} conteúdos planejados</span></div><button aria-label="Filtrar agenda"><SlidersHorizontal size={17} /></button></div>
      <div className="mobile-agenda-list">
        {upcomingPosts.map((post) => (
          <button className="mobile-agenda-item" key={`${post.day}-${post.title}`} onClick={onCreate}>
            <span className={`mobile-date ${post.day === 13 ? "current" : ""}`}><small>{weekNames[(post.day + 2) % 7]}</small><strong>{post.day}</strong></span>
            {post.image ? <span className="mobile-agenda-thumb"><Image src={post.image} alt="" fill sizes="48px" /></span> : <span className={`mobile-agenda-thumb placeholder ${statusClass[post.status]}`}><ImageIcon size={18} /></span>}
            <span className="mobile-agenda-copy"><strong>{post.title}</strong><small>{post.client} · {post.time}</small><span className={`mobile-status ${statusClass[post.status]}`}><i />{post.status}</span></span>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
      <button className="mobile-create-cta primary-button" onClick={onCreate}><Plus size={18} /> Criar nova publicação</button>
    </section>
  );
}

function CalendarView({ onCreate }: { onCreate: () => void }) {
  const [mode, setMode] = useState<"Mês" | "Semana">("Mês");
  const days = useMemo(() => Array.from({ length: 35 }, (_, index) => index - 1), []);
  return (
    <main className="view calendar-view">
      <div className="calendar-toolbar">
        <div className="calendar-title"><h1>Julho <span>2026</span></h1><div className="date-nav"><button aria-label="Mês anterior"><ChevronLeft size={17} /></button><button>Hoje</button><button aria-label="Próximo mês"><ChevronRight size={17} /></button></div></div>
        <div className="calendar-actions"><button className="client-filter"><span className="avatar-stack"><Avatar name="Alba Café" color="#B66A3C" size="sm" /><Avatar name="Flora Studio" color="#64825C" size="sm" /><Avatar name="Noma Skin" color="#B87C7C" size="sm" /></span> Todos os clientes <ChevronDown size={14} /></button><div className="segmented">{(["Mês", "Semana"] as const).map((item) => <button key={item} className={mode === item ? "selected" : ""} onClick={() => setMode(item)}>{item}</button>)}</div><button className="primary-button" onClick={onCreate}><Plus size={16} /> Criar post</button></div>
      </div>
      <div className="calendar-meta"><div className="legend"><span><i className="status-published" /> Publicado</span><span><i className="status-scheduled" /> Agendado</span><span><i className="status-approval" /> Em aprovação</span><span><i className="status-draft" /> Rascunho</span></div><button><SlidersHorizontal size={15} /> Filtros</button></div>
      <MobileAgenda onCreate={onCreate} />
      {mode === "Mês" ? (
        <section className="month-calendar">
          <div className="weekdays">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="days-grid">
            {days.map((day, index) => {
              const inMonth = day >= 1 && day <= 31;
              const shownDay = day < 1 ? 30 + day : day > 31 ? day - 31 : day;
              const posts = inMonth ? calendarPosts.filter((post) => post.day === day) : [];
              return <div className={`calendar-day ${inMonth ? "" : "outside"} ${day === 13 ? "today" : ""}`} key={index}><div className="day-number"><span>{shownDay}</span>{day === 13 ? <small>HOJE</small> : null}<button aria-label={`Criar post no dia ${shownDay}`} onClick={onCreate}><Plus size={13} /></button></div>{posts.map((post) => <CalendarPost key={post.title} post={post} />)}</div>;
            })}
          </div>
        </section>
      ) : <WeekView onCreate={onCreate} />}
    </main>
  );
}

function WeekView({ onCreate }: { onCreate: () => void }) {
  const weekDays = [13, 14, 15, 16, 17, 18, 19];
  return <section className="week-calendar"><div className="week-head"><span />{weekDays.map((day, index) => <div key={day} className={index === 0 ? "current" : ""}><small>{["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"][index]}</small><strong>{day}</strong></div>)}</div><div className="week-body">{["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"].map((time) => <div className="time-row" key={time}><span>{time}</span>{weekDays.map((day) => <button key={day} onClick={onCreate} aria-label={`Criar post dia ${day} às ${time}`} /> )}</div>)}<div className="week-event" style={{ gridColumn: 4, gridRow: "5 / span 2" }}><small>19:00 · Noma Skin</small><strong>Seu ritual, seu tempo</strong><span>Post · Agendado</span></div><div className="week-event green" style={{ gridColumn: 7, gridRow: "2 / span 2" }}><small>10:00 · Alba Café</small><strong>Slow mornings</strong><span>Reel · Agendado</span></div></div></section>;
}

*/
function CreatorView({ initialPost }: { initialPost?: OperationalPost | null }) {
  const accountName = initialPost?.clientName ?? "Alba Café";
  const accountColor = initialPost?.clientColor ?? "#B66A3C";
  const accountHandle = initialPost?.clientHandle ?? "@albacafe";
  const mediaSrc = initialPost?.thumbnailUrl ?? media[0].src;
  const [caption, setCaption] = useState(initialPost?.caption ?? "Manhãs sem pressa começam com café feito na hora. ☕\n\nPassa aqui para experimentar nosso novo microlote da Serra da Mantiqueira.");
  const [comment, setComment] = useState(initialPost?.firstComment ?? "Origem: Carmo de Minas · Notas de caramelo, chocolate e frutas amarelas ✨");
  const [format, setFormat] = useState(initialPost ? { image: "Imagem", carousel: "Carrossel", reel: "Reel" }[initialPost.format] : "Imagem");
  const [scheduled, setScheduled] = useState(initialPost ? initialPost.status === "scheduled" : true);
  const [saved, setSaved] = useState(false);
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("edit");
  return (
    <main className={`creator-view mobile-${mobilePane}`}>
      <div className="creator-mobile-tabs" aria-label="Visualização do conteúdo"><button className={mobilePane === "edit" ? "selected" : ""} onClick={() => setMobilePane("edit")}><SlidersHorizontal size={16} /> Editar</button><button className={mobilePane === "preview" ? "selected" : ""} onClick={() => setMobilePane("preview")}><InstagramPreviewIcon /> Preview</button></div>
      <section className="composer-panel">
        <div className="composer-head"><div><span className="eyebrow">{initialPost ? "EDITAR CONTEÚDO" : "CRIAR CONTEÚDO"}</span><h1>{initialPost ? "Editar post" : "Novo post"}</h1></div><div className="save-state">{saved ? <><Check size={14} /> Salvo localmente</> : initialPost ? "Edição em andamento" : "Rascunho local"}</div></div>
        <div className="form-section"><label>Publicar em</label><button className="account-select"><Avatar name={accountName} color={accountColor} size="md" /><span><strong>{accountName}</strong><small>{accountHandle} · Instagram</small></span><AtSign size={17} /><ChevronDown size={15} /></button></div>
        <div className="form-section"><label>Formato</label><div className="format-options">{[{ name: "Imagem", icon: ImageIcon }, { name: "Carrossel", icon: LayoutGrid }, { name: "Reel", icon: Grid2X2 }].map(({ name, icon: Icon }) => <button key={name} className={format === name ? "selected" : ""} onClick={() => setFormat(name)}><Icon size={17} />{name}</button>)}</div></div>
        <div className="form-section"><div className="label-row"><label>Mídia</label><span>1080 × 1350 px</span></div><div className="selected-media"><Image src={mediaSrc} alt={initialPost?.mediaName ?? media[0].alt} fill sizes="120px" unoptimized={Boolean(initialPost?.thumbnailUrl)} /><div className="media-actions"><button aria-label="Editar mídia"><SlidersHorizontal size={15} /></button><button aria-label="Remover mídia"><X size={15} /></button></div></div><button className="upload-inline"><Plus size={15} /> Adicionar {format === "Carrossel" ? "outra mídia" : "mídia"}</button></div>
        <div className="form-section"><div className="label-row"><label htmlFor="caption">Legenda</label><button><Sparkles size={14} /> Melhorar texto</button></div><div className="text-area-wrap"><textarea id="caption" value={caption} maxLength={2200} onChange={(event) => setCaption(event.target.value)} /><div className="text-toolbar"><span><button aria-label="Adicionar emoji"><Smile size={16} /></button><button aria-label="Adicionar arquivo"><FileText size={16} /></button></span><small>{caption.length} / 2.200</small></div></div></div>
        <div className="form-section"><div className="label-row"><label htmlFor="comment">Primeiro comentário</label><span>Opcional</span></div><div className="text-area-wrap compact"><textarea id="comment" value={comment} maxLength={1000} onChange={(event) => setComment(event.target.value)} /><div className="text-toolbar"><span><button aria-label="Adicionar emoji"><Smile size={16} /></button></span><small>{comment.length} / 1.000</small></div></div></div>
        <div className="form-section publish-options"><label>Quando publicar?</label><div className="radio-list"><button className={!scheduled ? "selected" : ""} onClick={() => setScheduled(false)}><span className="radio"><i /></span><span><strong>Publicar agora</strong><small>O conteúdo será enviado imediatamente</small></span></button><button className={scheduled ? "selected" : ""} onClick={() => setScheduled(true)}><span className="radio"><i /></span><span><strong>Agendar publicação</strong><small>Escolha a melhor data e horário</small></span></button></div>{scheduled ? <div className="schedule-fields"><button><CalendarDays size={16} /><span><small>Data</small><strong>18 de julho de 2026</strong></span><ChevronDown size={14} /></button><button><Clock3 size={16} /><span><small>Horário</small><strong>10:00</strong></span><ChevronDown size={14} /></button></div> : null}</div>
        <div className="composer-footer"><button className="secondary-button" onClick={() => setSaved(true)}>Salvar rascunho</button><button className="primary-button" onClick={() => setSaved(true)}>{scheduled ? <><CalendarDays size={16} /> Agendar publicação</> : <><Send size={16} /> Publicar agora</>}</button></div>
      </section>
      <aside className="preview-panel">
        <div className="preview-heading"><div><span>Preview</span><small>Instagram feed</small></div><div className="segmented compact-segment"><button className="selected">Feed</button><button>Perfil</button></div></div>
        <div className="phone-preview">
          <div className="insta-head"><div><Avatar name={accountName} color={accountColor} size="sm" /><span><strong>{accountHandle.replace("@", "")}</strong><small>São Paulo, SP</small></span></div><MoreHorizontal size={19} /></div>
          <div className="post-image"><Image src={mediaSrc} alt={initialPost?.mediaName ?? media[0].alt} fill sizes="420px" priority unoptimized={Boolean(initialPost?.thumbnailUrl)} /></div>
          <div className="insta-actions"><span><Heart size={23} /><MessageCircle size={22} /><Send size={21} /></span><Library size={21} /></div>
          <div className="insta-copy"><strong>187 curtidas</strong><p><b>{accountHandle.replace("@", "")}</b> {caption}</p><span>Ver todos os 12 comentários</span><p className="comment-preview"><b>{accountHandle.replace("@", "")}</b> {comment}</p><small>HÁ ALGUNS SEGUNDOS</small></div>
        </div>
        <div className="preview-note"><Sparkles size={16} /><span><strong>Seu post está com uma boa leitura.</strong><small>A legenda aparece completa antes do “mais”.</small></span></div>
      </aside>
    </main>
  );
}

function InstagramPreviewIcon() {
  return <span className="preview-icon" aria-hidden="true"><span /></span>;
}

/* Legacy static history prototype retained temporarily for visual reference.
function HistoryView() {
  const rows = [
    { title: "Café que abraça", client: "Alba Café", date: "13 jul, 09:30", status: "Publicado" as PostStatus, kind: "Imagem" },
    { title: "Cuidados no inverno", client: "Noma Skin", date: "12 jul, 19:00", status: "Publicado" as PostStatus, kind: "Carrossel" },
    { title: "Folhagens para meia-sombra", client: "Flora Studio", date: "11 jul, 16:00", status: "Publicado" as PostStatus, kind: "Reel" },
    { title: "Flow de domingo", client: "Sopro Yoga", date: "10 jul, 08:00", status: "Falhou" as PostStatus, kind: "Reel" },
    { title: "Conheça nosso barista", client: "Alba Café", date: "9 jul, 11:00", status: "Publicado" as PostStatus, kind: "Imagem" },
  ];
  return (
    <main className="view">
      <div className="page-heading"><div><span className="eyebrow">ÚLTIMOS 30 DIAS</span><h1>Histórico</h1><p>Acompanhe tudo que foi publicado e identifique falhas.</p></div><button className="secondary-button"><Share2 size={15} /> Exportar relatório</button></div>
      <div className="history-filters"><button>Todos os clientes <ChevronDown size={14} /></button><button>Todos os estados <ChevronDown size={14} /></button><button>Últimos 30 dias <ChevronDown size={14} /></button><button className="filter-icon"><ListFilter size={15} /></button></div>
      <section className="history-table">
        <div className="table-head"><span>CONTEÚDO</span><span>CLIENTE</span><span>DATA</span><span>FORMATO</span><span>STATUS</span><span /></div>
        {rows.map((row, index) => <div className="table-row" key={row.title}><div><div className="tiny-thumb"><Image src={media[index % media.length].src} alt="" fill sizes="44px" /></div><strong>{row.title}</strong></div><span data-label="Cliente">{row.client}</span><span data-label="Data">{row.date}</span><span data-label="Formato">{row.kind}</span><span data-label="Status" className={`status-pill ${statusClass[row.status]}`}><i />{row.status}</span><button aria-label={`Opções de ${row.title}`}><MoreHorizontal size={17} /></button></div>)}
      </section>
    </main>
  );
}

*/
function SettingsView({ dark, setDark }: { dark: boolean; setDark: (dark: boolean) => void }) {
  return <main className="view settings-view"><div className="page-heading"><div><span className="eyebrow">SEU WORKSPACE</span><h1>Configurações</h1><p>Personalize o Voha e gerencie suas preferências.</p></div></div><div className="settings-layout"><nav><button className="active">Geral</button><button>Notificações</button><button>Publicação</button><button>Equipe</button><button>Plano e cobrança</button></nav><section className="settings-content"><div className="settings-section"><h2>Perfil</h2><p>Suas informações pessoais no workspace.</p><div className="profile-row"><Avatar name="Larissa Cruz" color="#333238" size="lg" /><button className="secondary-button">Alterar foto</button></div><div className="two-fields"><label>Nome completo<input value="Larissa Cruz" readOnly /></label><label>E-mail<input value="larissa@voha.app" readOnly /></label></div></div><div className="settings-section"><h2>Aparência</h2><p>Escolha como o Voha aparece para você.</p><div className="theme-options"><button className={!dark ? "selected" : ""} onClick={() => setDark(false)}><span className="theme-preview light-preview"><i /><b /><b /></span><strong><Sun size={15} /> Claro</strong></button><button className={dark ? "selected" : ""} onClick={() => setDark(true)}><span className="theme-preview dark-preview"><i /><b /><b /></span><strong><Moon size={15} /> Escuro</strong></button></div></div><div className="settings-section"><h2>Fuso horário</h2><p>Usado para todos os agendamentos do workspace.</p><button className="select-field"><span><small>Fuso horário</small><strong>América/São Paulo (GMT-3)</strong></span><ChevronDown size={15} /></button></div></section></div></main>;
}

function MobileBottomNav({ active, setActive, onMore }: { active: View; setActive: (view: View) => void; onMore: () => void }) {
  const items: { id: View; label: string; icon: LucideIcon }[] = [
    { id: "dashboard", label: "Início", icon: Home },
    { id: "calendar", label: "Agenda", icon: CalendarDays },
    { id: "creator", label: "Criar", icon: Plus },
    { id: "clients", label: "Clientes", icon: Users },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal no celular">
      {items.map(({ id, label, icon: Icon }) => <button key={id} className={`${active === id ? "active" : ""} ${id === "creator" ? "mobile-create" : ""}`} onClick={() => setActive(id)}><span><Icon size={id === "creator" ? 23 : 20} strokeWidth={id === "creator" ? 2.2 : 1.8} /></span><small>{label}</small></button>)}
      <button className={active === "media" || active === "history" || active === "settings" ? "active" : ""} onClick={onMore}><span><Menu size={20} strokeWidth={1.8} /></span><small>Mais</small></button>
    </nav>
  );
}

export default function HomePage() {
  const [active, setActive] = useState<View>("calendar");
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceClients, setWorkspaceClients] = useState<WorkspaceClientSummary[]>(() => isSupabaseConfigured() ? [] : demoClients);
  const [authReady, setAuthReady] = useState(false);
  const [selectedPost, setSelectedPost] = useState<OperationalPost | null>(null);
  const [editingPost, setEditingPost] = useState<OperationalPost | null>(null);
  const [postsVersion, setPostsVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [createClientRequest, setCreateClientRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function initializeWorkspace() {
      if (!isSupabaseConfigured()) {
        setAuthReady(true);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          window.location.replace("/login");
          return;
        }

        const response = await fetch("/api/workspace/bootstrap", {
          method: "POST",
        });

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        if (response.ok) {
          await response.json() as WorkspaceBootstrapResult;
          const clientsResponse = await fetch("/api/clients");
          const clientsResult = (await clientsResponse.json().catch(() => null)) as { clients?: WorkspaceClientSummary[] } | null;
          if (!cancelled && clientsResponse.ok && clientsResult?.clients) {
            setWorkspaceClients(clientsResult.clients);
          }
        }
      } catch {
        // Keep the local demo fixtures available if the network is offline.
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    void initializeWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  function navigate(view: View) {
    if (view === "creator") setEditingPost(null);
    setActive(view);
  }

  function openNewClient() {
    setActive("clients");
    setSidebarOpen(false);
    setCreateClientRequest((request) => request + 1);
  }

  function editPost(post: OperationalPost) {
    setSelectedPost(null);
    setEditingPost(post);
    setActive("creator");
  }

  function handleDuplicated() {
    setSelectedPost(null);
    setPostsVersion((version) => version + 1);
    setNotice("Publicação duplicada como rascunho.");
  }

  if (!authReady) {
    return <main className="auth-loading" aria-label="Validando sua sessão"><span className="login-pixel-heart" aria-hidden="true">{Array.from({ length: 63 }, (_, index) => <i key={index} />)}</span><p>Preparando seu calendário…</p></main>;
  }

  const content = active === "dashboard" ? <DashboardView goTo={navigate} onOpen={setSelectedPost} refreshKey={postsVersion} /> : active === "calendar" ? <CalendarView clients={workspaceClients} onCreate={() => navigate("creator")} onOpen={setSelectedPost} refreshKey={postsVersion} /> : active === "creator" ? <CreatorView initialPost={editingPost} /> : active === "clients" ? <ClientManagement key={createClientRequest} clients={workspaceClients} backendEnabled={isSupabaseConfigured()} onClientsChange={setWorkspaceClients} onOpenCalendar={() => navigate("calendar")} onNotice={setNotice} /> : active === "media" ? <MediaLibrary clients={workspaceClients} /> : active === "history" ? <HistoryView clients={workspaceClients} onOpen={setSelectedPost} refreshKey={postsVersion} /> : <SettingsView dark={dark} setDark={setDark} />;
  return <div className={`app-shell ${dark ? "dark" : ""}`}><Sidebar active={active} setActive={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} onAddClient={openNewClient} clients={workspaceClients} />{sidebarOpen ? <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" /> : null}<div className="app-main"><Topbar active={active} onMenu={() => setSidebarOpen(true)} onCreate={() => navigate("creator")} dark={dark} setDark={setDark} /><div className="view-transition" key={`${active}-${editingPost?.id ?? "new"}`}>{content}</div></div><MobileBottomNav active={active} setActive={navigate} onMore={() => setSidebarOpen(true)} />{selectedPost ? <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} onEdit={editPost} onDuplicated={handleDuplicated} /> : null}{notice ? <div className="app-toast" role="status"><Check size={15} /> {notice}</div> : null}</div>;
}
