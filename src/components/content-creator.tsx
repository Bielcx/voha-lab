"use client";

import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  ImageIcon,
  LayoutGrid,
  Library,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isSupabaseConfigured } from "@/lib/env/public";
import { formatAllowsMedia, formatMediaLimit } from "@/lib/posts/draft";
import type { MediaAssetSummary } from "@/lib/media/types";
import type {
  OperationalPost,
  PostDraft,
  PostDraftMedia,
  PostFormat,
  SavePostDraftRequest,
  SavePostDraftResponse,
} from "@/lib/posts/types";
import type { WorkspaceClientSummary } from "@/lib/types/workspace";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const FORMAT_OPTIONS: { value: PostFormat; label: string; icon: typeof ImageIcon }[] = [
  { value: "image", label: "Imagem", icon: ImageIcon },
  { value: "carousel", label: "Carrossel", icon: LayoutGrid },
  { value: "reel", label: "Reel", icon: Film },
];

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}

function Avatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return <span className="avatar avatar-md" style={{ backgroundColor: color }}>{initials}</span>;
}

function PreviewIcon() {
  return <span className="preview-icon" aria-hidden="true"><span /></span>;
}

function toDraftMedia(item: MediaAssetSummary): PostDraftMedia {
  return {
    id: item.id,
    clientId: item.clientId,
    originalName: item.originalName,
    mimeType: item.mimeType,
    kind: item.kind,
    width: item.width,
    height: item.height,
    durationMs: item.durationMs,
    url: item.url,
  };
}

export function ContentCreator({
  initialPost,
  clients,
  onDraftSaved,
  registerBeforeLeave,
}: {
  initialPost?: OperationalPost | null;
  clients: WorkspaceClientSummary[];
  onDraftSaved?: () => void;
  registerBeforeLeave?: (handler: (() => Promise<boolean>) | null) => void;
}) {
  const backendEnabled = isSupabaseConfigured();
  const initialClientId = initialPost?.clientId ?? clients[0]?.id ?? "";
  const [draftId, setDraftId] = useState(initialPost?.id ?? null);
  const [clientId, setClientId] = useState(initialClientId);
  const [format, setFormat] = useState<PostFormat>(initialPost?.format ?? "image");
  const [caption, setCaption] = useState(initialPost?.caption ?? "");
  const [firstComment, setFirstComment] = useState(initialPost?.firstComment ?? "");
  const [selectedMedia, setSelectedMedia] = useState<PostDraftMedia[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [libraryItems, setLibraryItems] = useState<MediaAssetSummary[]>([]);
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("edit");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(Boolean(initialPost?.id && backendEnabled));
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [revision, setRevision] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(initialPost?.updatedAt ?? null);

  const draftIdRef = useRef(draftId);
  const latestPayloadRef = useRef<SavePostDraftRequest | null>(null);
  const queuedRef = useRef(false);
  const activeSaveRef = useRef<Promise<boolean> | null>(null);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const mountedRef = useRef(true);
  const onDraftSavedRef = useRef(onDraftSaved);

  const effectiveClientId = clientId || clients[0]?.id || "";
  const client = clients.find((item) => item.id === effectiveClientId) ?? clients[0] ?? null;
  const accountName = client?.name ?? "Selecione um cliente";
  const accountColor = client?.color ?? "#747078";
  const accountHandle = client?.handle ?? "@instagram";
  const visiblePreviewIndex = Math.min(previewIndex, Math.max(0, selectedMedia.length - 1));
  const previewMedia = selectedMedia[visiblePreviewIndex] ?? null;

  const payload = useMemo<SavePostDraftRequest>(() => ({
    clientId: effectiveClientId,
    format,
    caption,
    firstComment,
    mediaIds: selectedMedia.map((item) => item.id),
  }), [caption, effectiveClientId, firstComment, format, selectedMedia]);

  useEffect(() => {
    latestPayloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    onDraftSavedRef.current = onDraftSaved;
  }, [onDraftSaved]);

  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!initialPost?.id || !backendEnabled) return;

    let cancelled = false;
    fetch(`/api/posts/${initialPost.id}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(getErrorMessage(result, "Não foi possível carregar o rascunho."));
        return result as PostDraft;
      })
      .then((draft) => {
        if (cancelled) return;
        setDraftId(draft.id);
        setClientId(draft.clientId);
        setFormat(draft.format);
        setCaption(draft.caption);
        setFirstComment(draft.firstComment);
        setSelectedMedia(draft.media);
        setSavedAt(draft.updatedAt);
        setSaveState("saved");
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o rascunho.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDraft(false);
      });
    return () => { cancelled = true; };
  }, [backendEnabled, initialPost?.id]);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!backendEnabled) {
      setSaveState("saved");
      setSavedAt(new Date().toISOString());
      dirtyRef.current = false;
      return true;
    }
    if (!latestPayloadRef.current?.clientId) {
      setSaveState("error");
      setSaveError("Cadastre ou selecione um cliente antes de salvar.");
      return false;
    }
    if (activeSaveRef.current) {
      queuedRef.current = true;
      return activeSaveRef.current;
    }

    const operation = (async () => {
      try {
        do {
          queuedRef.current = false;
          const currentPayload = latestPayloadRef.current;
          if (!currentPayload) return false;
          const savingRevision = revisionRef.current;
          if (mountedRef.current) {
            setSaveState("saving");
            setSaveError("");
          }
          const currentId = draftIdRef.current;
          const response = await fetch(currentId ? `/api/posts/${currentId}` : "/api/posts", {
            method: currentId ? "PATCH" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(currentPayload),
          });
          const result = await response.json().catch(() => null);
          if (response.status === 401) {
            window.location.assign("/login");
            return false;
          }
          if (!response.ok) throw new Error(getErrorMessage(result, "Não foi possível salvar o rascunho."));

          const saved = result as SavePostDraftResponse;
          draftIdRef.current = saved.id;
          if (savingRevision === revisionRef.current) {
            dirtyRef.current = false;
          } else {
            queuedRef.current = true;
          }
          if (mountedRef.current) {
            setDraftId(saved.id);
            setSavedAt(saved.updatedAt);
            setSaveState(queuedRef.current ? "dirty" : "saved");
            onDraftSavedRef.current?.();
          }
        } while (queuedRef.current);
        return true;
      } catch (error) {
        if (mountedRef.current) {
          setSaveState("error");
          setSaveError(error instanceof Error ? error.message : "Não foi possível salvar o rascunho.");
        }
        return false;
      }
    })();

    activeSaveRef.current = operation;
    const saved = await operation;
    if (activeSaveRef.current === operation) activeSaveRef.current = null;
    return saved;
  }, [backendEnabled]);

  useEffect(() => {
    if (!registerBeforeLeave) return;
    registerBeforeLeave(async () => {
      if (!dirtyRef.current && !activeSaveRef.current) return true;
      return saveDraft();
    });
    return () => registerBeforeLeave(null);
  }, [registerBeforeLeave, saveDraft]);

  useEffect(() => {
    if (revision === 0 || loadingDraft) return;
    const timeout = window.setTimeout(() => void saveDraft(), 750);
    return () => window.clearTimeout(timeout);
  }, [loadingDraft, revision, saveDraft]);

  const loadLibrary = useCallback(async () => {
    if (!backendEnabled || !effectiveClientId) return;
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const response = await fetch(`/api/media?clientId=${encodeURIComponent(effectiveClientId)}&limit=50`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(result, "Não foi possível carregar a biblioteca."));
      setLibraryItems((result as { items: MediaAssetSummary[] }).items);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Não foi possível carregar a biblioteca.");
    } finally {
      setLibraryLoading(false);
    }
  }, [backendEnabled, effectiveClientId]);

  function markChanged() {
    dirtyRef.current = true;
    revisionRef.current += 1;
    setSaveState("dirty");
    setSaveError("");
    setRevision((value) => value + 1);
  }

  function openPicker() {
    setPickerOpen(true);
    void loadLibrary();
  }

  function changeClient(nextClientId: string) {
    setClientId(nextClientId);
    setSelectedMedia((current) => current.filter((item) => !item.clientId || item.clientId === nextClientId));
    setLibraryItems([]);
    setPreviewIndex(0);
    markChanged();
  }

  function changeFormat(nextFormat: PostFormat) {
    setFormat(nextFormat);
    setSelectedMedia((current) => current
      .filter((item) => formatAllowsMedia(nextFormat, item))
      .slice(0, formatMediaLimit(nextFormat)));
    setPreviewIndex(0);
    markChanged();
  }

  function toggleMedia(item: MediaAssetSummary) {
    if (!formatAllowsMedia(format, item)) return;
    const selected = selectedMedia.some((mediaItem) => mediaItem.id === item.id);
    if (selected) {
      setSelectedMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id));
      markChanged();
      return;
    }
    if (selectedMedia.length >= formatMediaLimit(format)) return;
    setSelectedMedia((current) => [...current, toDraftMedia(item)]);
    markChanged();
  }

  function removeMedia(id: string) {
    setSelectedMedia((current) => current.filter((item) => item.id !== id));
    setPreviewIndex(0);
    markChanged();
  }

  function moveMedia(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selectedMedia.length) return;
    setSelectedMedia((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markChanged();
  }

  const compatibleLibrary = libraryItems.filter((item) => formatAllowsMedia(format, item));
  const saveLabel = saveState === "saving"
    ? "Salvando…"
    : saveState === "dirty"
      ? "Alterações não salvas"
      : saveState === "error"
        ? "Falha ao salvar"
        : savedAt
          ? "Rascunho salvo"
          : "Novo rascunho";

  if (loadingDraft) {
    return <main className="creator-loading"><LoaderCircle className="spin" size={24} /><span>Carregando rascunho…</span></main>;
  }

  return (
    <main className={`creator-view mobile-${mobilePane}`}>
      <div className="creator-mobile-tabs" aria-label="Visualização do conteúdo">
        <button className={mobilePane === "edit" ? "selected" : ""} onClick={() => setMobilePane("edit")}><SlidersHorizontal size={16} /> Editar</button>
        <button className={mobilePane === "preview" ? "selected" : ""} onClick={() => setMobilePane("preview")}><PreviewIcon /> Preview</button>
      </div>
      <section className="composer-panel">
        <div className="composer-head">
          <div><span className="eyebrow">{draftId ? "EDITAR CONTEÚDO" : "CRIAR CONTEÚDO"}</span><h1>{draftId ? "Editar rascunho" : "Novo post"}</h1></div>
          <div className={`save-state save-${saveState}`}>
            {saveState === "saving" ? <LoaderCircle className="spin" size={14} /> : saveState === "error" ? <AlertCircle size={14} /> : saveState === "saved" ? <Check size={14} /> : null}
            {saveLabel}
          </div>
        </div>
        {loadError ? <div className="creator-alert"><AlertCircle size={16} />{loadError}</div> : null}
        {saveError ? <button className="creator-alert retry" onClick={() => void saveDraft()}><AlertCircle size={16} /><span>{saveError}</span><RefreshCw size={14} /></button> : null}

        <div className="form-section">
          <label htmlFor="creator-client">Publicar em</label>
          <div className="account-select creator-client-select">
            <Avatar name={accountName} color={accountColor} />
            <span><strong>{accountName}</strong><small>{accountHandle ?? "Instagram não conectado"}</small></span>
            <AtSign size={17} />
            <ChevronDown size={15} />
            <select id="creator-client" value={effectiveClientId} onChange={(event) => changeClient(event.target.value)} aria-label="Cliente da publicação">
              <option value="" disabled>Selecione um cliente</option>
              {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>

        <div className="form-section">
          <label>Formato</label>
          <div className="format-options">{FORMAT_OPTIONS.map(({ value, label, icon: Icon }) => <button key={value} className={format === value ? "selected" : ""} onClick={() => changeFormat(value)}><Icon size={17} />{label}</button>)}</div>
        </div>

        <div className="form-section">
          <div className="label-row"><label>Mídia</label><span>{selectedMedia.length} / {formatMediaLimit(format)}</span></div>
          {selectedMedia.length > 0 ? (
            <div className="selected-media-list">
              {selectedMedia.map((item, index) => (
                <article className="selected-media" key={item.id}>
                  {item.kind === "image" ? <Image src={item.url} alt={item.originalName} fill sizes="120px" unoptimized /> : <video src={item.url} muted playsInline />}
                  <span className="media-position">{index + 1}</span>
                  <div className="media-actions">
                    {format === "carousel" ? <><button disabled={index === 0} onClick={() => moveMedia(index, -1)} aria-label="Mover mídia para trás"><ArrowLeft size={14} /></button><button disabled={index === selectedMedia.length - 1} onClick={() => moveMedia(index, 1)} aria-label="Mover mídia para frente"><ArrowRight size={14} /></button></> : null}
                    <button onClick={() => removeMedia(item.id)} aria-label="Remover mídia"><Trash2 size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : <button className="media-empty" onClick={openPicker}><Library size={20} /><strong>Escolha na biblioteca</strong><span>Imagem, carrossel ou vídeo MP4</span></button>}
          <button className="upload-inline" disabled={!effectiveClientId || selectedMedia.length >= formatMediaLimit(format)} onClick={openPicker}><Plus size={15} /> {selectedMedia.length ? "Adicionar outra mídia" : "Abrir biblioteca"}</button>
        </div>

        <div className="form-section">
          <div className="label-row"><label htmlFor="caption">Legenda</label><span>Até 2.200 caracteres</span></div>
          <div className="text-area-wrap"><textarea id="caption" value={caption} maxLength={2200} placeholder="Escreva a legenda do post…" onChange={(event) => { setCaption(event.target.value); markChanged(); }} /><div className="text-toolbar"><span><Sparkles size={15} /></span><small>{caption.length} / 2.200</small></div></div>
        </div>

        <div className="form-section">
          <div className="label-row"><label htmlFor="comment">Primeiro comentário</label><span>Opcional</span></div>
          <div className="text-area-wrap compact"><textarea id="comment" value={firstComment} maxLength={2200} placeholder="Hashtags ou contexto adicional…" onChange={(event) => { setFirstComment(event.target.value); markChanged(); }} /><div className="text-toolbar"><span /><small>{firstComment.length} / 2.200</small></div></div>
        </div>

        <div className="composer-footer">
          <span className="autosave-note">O rascunho é salvo automaticamente</span>
          <button className="secondary-button" disabled={saveState === "saving" || !effectiveClientId} onClick={() => void saveDraft()}>{saveState === "saving" ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Salvar agora</button>
          <button className="primary-button" disabled title="Agendamento será implementado na próxima etapa"><Send size={16} /> Continuar</button>
        </div>
      </section>

      <aside className="preview-panel">
        <div className="preview-heading"><div><span>Preview</span><small>Instagram feed</small></div><span className="preview-format">{FORMAT_OPTIONS.find((item) => item.value === format)?.label}</span></div>
        <div className="phone-preview">
          <div className="insta-head"><div><Avatar name={accountName} color={accountColor} /><span><strong>{accountHandle.replace("@", "")}</strong><small>Instagram</small></span></div><MoreHorizontal size={19} /></div>
          <div className="post-image">
            {previewMedia?.kind === "image" ? <Image src={previewMedia.url} alt={previewMedia.originalName} fill sizes="420px" priority unoptimized /> : previewMedia?.kind === "video" ? <video src={previewMedia.url} controls muted playsInline /> : <div className="preview-empty"><Video size={28} /><span>Adicione uma mídia para visualizar</span></div>}
            {selectedMedia.length > 1 ? <><button className="carousel-nav previous" onClick={() => setPreviewIndex((visiblePreviewIndex - 1 + selectedMedia.length) % selectedMedia.length)} aria-label="Ver mídia anterior"><ChevronLeft size={18} /></button><button className="carousel-nav next" onClick={() => setPreviewIndex((visiblePreviewIndex + 1) % selectedMedia.length)} aria-label="Ver próxima mídia"><ChevronRight size={18} /></button><span className="carousel-count">{visiblePreviewIndex + 1}/{selectedMedia.length}</span></> : null}
          </div>
          {selectedMedia.length > 1 ? <div className="carousel-dots" aria-label="Mídias do carrossel">{selectedMedia.map((item, index) => <button className={index === visiblePreviewIndex ? "active" : ""} key={item.id} onClick={() => setPreviewIndex(index)} aria-label={`Ver mídia ${index + 1}`} />)}</div> : null}
          <div className="insta-actions"><span><Heart size={23} /><MessageCircle size={22} /><Send size={21} /></span><Library size={21} /></div>
          <div className="insta-copy"><strong>Prévia da publicação</strong>{caption ? <p><b>{accountHandle.replace("@", "")}</b> {caption}</p> : <p className="preview-placeholder">Sua legenda aparecerá aqui.</p>}{firstComment ? <p className="comment-preview"><b>{accountHandle.replace("@", "")}</b> {firstComment}</p> : null}<small>RASCUNHO</small></div>
        </div>
        <div className="preview-note"><Sparkles size={16} /><span><strong>Prévia fiel ao feed.</strong><small>Revise cortes, ordem e texto antes de agendar.</small></span></div>
      </aside>

      {pickerOpen ? (
        <div className="media-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerOpen(false); }}>
          <section className="media-picker" role="dialog" aria-modal="true" aria-label="Selecionar mídia">
            <header><div><span className="eyebrow">BIBLIOTECA</span><h2>Escolher mídia</h2><p>{format === "carousel" ? "Selecione até 10 itens na ordem desejada." : `Selecione ${format === "reel" ? "um vídeo MP4" : "uma imagem"}.`}</p></div><button className="icon-button" onClick={() => setPickerOpen(false)} aria-label="Fechar biblioteca"><X size={18} /></button></header>
            {libraryLoading ? <div className="media-picker-state"><LoaderCircle className="spin" size={22} />Carregando biblioteca…</div> : libraryError ? <button className="media-picker-state error" onClick={() => void loadLibrary()}><AlertCircle size={20} />{libraryError}<span>Tentar novamente</span></button> : compatibleLibrary.length === 0 ? <div className="media-picker-state"><ImageIcon size={24} /><strong>Nenhuma mídia compatível</strong><span>Envie arquivos na Biblioteca para usá-los aqui.</span></div> : <div className="media-picker-grid">{compatibleLibrary.map((item) => {
              const index = selectedMedia.findIndex((selected) => selected.id === item.id);
              const disabled = index < 0 && selectedMedia.length >= formatMediaLimit(format);
              return <button key={item.id} className={index >= 0 ? "selected" : ""} disabled={disabled} onClick={() => toggleMedia(item)}>{item.kind === "image" ? <Image src={item.url} alt={item.originalName} fill sizes="180px" unoptimized /> : <video src={item.url} muted playsInline />}<span className="picker-kind">{item.kind === "video" ? <Video size={13} /> : <ImageIcon size={13} />}</span>{index >= 0 ? <span className="picker-order">{index + 1}</span> : null}<small>{item.originalName}</small></button>;
            })}</div>}
            <footer><span>{selectedMedia.length} selecionada{selectedMedia.length === 1 ? "" : "s"}</span><button className="primary-button" onClick={() => setPickerOpen(false)}>Concluir</button></footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
