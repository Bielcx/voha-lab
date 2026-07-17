"use client";

import Image from "next/image";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  FileImage,
  FileVideo,
  LoaderCircle,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";

import { isSupabaseConfigured } from "@/lib/env/public";
import {
  formatFileSize,
  validateUploadCandidate,
} from "@/lib/media/policy";
import type {
  MediaAssetSummary,
  MediaListResponse,
  MediaUploadAuthorization,
} from "@/lib/media/types";
import type { WorkspaceClientSummary } from "@/lib/types/workspace";

type UploadStatus = "waiting" | "uploading" | "confirming" | "ready" | "failed";

type UploadTask = {
  id: string;
  name: string;
  progress: number;
  status: UploadStatus;
  error?: string;
};

const DEMO_MEDIA: MediaAssetSummary[] = [
  {
    id: "demo-media-1",
    clientId: "demo-alba-cafe",
    clientName: "Alba Café",
    originalName: "interior-alba-cafe.jpg",
    mimeType: "image/jpeg",
    kind: "image",
    sizeBytes: 2_480_000,
    width: 1080,
    height: 1350,
    durationMs: null,
    createdAt: "2026-07-14T12:00:00.000Z",
    url: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "demo-media-2",
    clientId: "demo-alba-cafe",
    clientName: "Alba Café",
    originalName: "preparo-do-cafe.mp4",
    mimeType: "image/jpeg",
    kind: "video",
    sizeBytes: 18_900_000,
    width: 1080,
    height: 1920,
    durationMs: 14_000,
    createdAt: "2026-07-13T12:00:00.000Z",
    url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "demo-media-3",
    clientId: "demo-noma-skin",
    clientName: "Noma Skin",
    originalName: "ritual-noma.webp",
    mimeType: "image/webp",
    kind: "image",
    sizeBytes: 1_720_000,
    width: 1080,
    height: 1350,
    durationMs: null,
    createdAt: "2026-07-12T12:00:00.000Z",
    url: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "demo-media-4",
    clientId: "demo-sopro-yoga",
    clientName: "Sopro Yoga",
    originalName: "sequencia-restaurativa.jpg",
    mimeType: "image/jpeg",
    kind: "image",
    sizeBytes: 3_140_000,
    width: 1080,
    height: 1350,
    durationMs: null,
    createdAt: "2026-07-11T12:00:00.000Z",
    url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "demo-media-5",
    clientId: "demo-flora-studio",
    clientName: "Flora Studio",
    originalName: "plantas-flora.jpg",
    mimeType: "image/jpeg",
    kind: "image",
    sizeBytes: 2_060_000,
    width: 1080,
    height: 1350,
    durationMs: null,
    createdAt: "2026-07-10T12:00:00.000Z",
    url: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "demo-media-6",
    clientId: "demo-flora-studio",
    clientName: "Flora Studio",
    originalName: "detalhes-artesanais.jpg",
    mimeType: "image/jpeg",
    kind: "image",
    sizeBytes: 2_880_000,
    width: 1080,
    height: 1350,
    durationMs: null,
    createdAt: "2026-07-09T12:00:00.000Z",
    url: "https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=900&q=85",
  },
];

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function getMediaMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    if (file.type.startsWith("image/")) {
      return await new Promise<{
        width: number;
        height: number;
        durationMs: null;
      }>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () =>
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
            durationMs: null,
          });
        image.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        image.src = objectUrl;
      });
    }

    return await new Promise<{
      width: number;
      height: number;
      durationMs: number;
    }>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          durationMs: Math.round(video.duration * 1000),
        });
      video.onerror = () => reject(new Error("Não foi possível ler o vídeo."));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function uploadToSignedUrl(
  file: File,
  uploadUrl: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error("O R2 recusou o envio do arquivo."));
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Não foi possível enviar o arquivo. Confira a conexão e o CORS do bucket.",
        ),
      );
    xhr.send(file);
  });
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(new Date(value))
    .replace(".", "");
}

function statusLabel(status: UploadStatus) {
  const labels: Record<UploadStatus, string> = {
    waiting: "Na fila",
    uploading: "Enviando",
    confirming: "Confirmando",
    ready: "Concluído",
    failed: "Falhou",
  };
  return labels[status];
}

export function MediaLibrary({
  clients,
}: {
  clients: WorkspaceClientSummary[];
}) {
  const backendEnabled = isSupabaseConfigured();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaAssetSummary[]>(
    backendEnabled ? [] : DEMO_MEDIA,
  );
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedKind, setSelectedKind] = useState<"all" | "image" | "video">(
    "all",
  );
  const [uploadClientId, setUploadClientId] = useState(
    () => clients[0]?.id ?? "",
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(backendEnabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMedia = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      if (!backendEnabled) return;

      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError("");

      try {
        const params = new URLSearchParams({ limit: "24" });
        if (nextCursor) params.set("cursor", nextCursor);
        const response = await fetch(`/api/media?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = await readJson(response);

        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) {
          throw new Error(
            getErrorMessage(payload, "Não foi possível carregar sua biblioteca."),
          );
        }

        const result = payload as MediaListResponse;
        setItems((current) =>
          replace ? result.items : [...current, ...result.items],
        );
        setCursor(result.nextCursor);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar sua biblioteca.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [backendEnabled],
  );

  useEffect(() => {
    if (!backendEnabled) return;

    let cancelled = false;
    fetch("/api/media?limit=24", { cache: "no-store" })
      .then(async (response) => ({
        response,
        payload: await readJson(response),
      }))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) {
          throw new Error(
            getErrorMessage(payload, "Não foi possível carregar sua biblioteca."),
          );
        }

        const result = payload as MediaListResponse;
        setItems(result.items);
        setCursor(result.nextCursor);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar sua biblioteca.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [backendEnabled]);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (selectedClient === "all" || item.clientId === selectedClient) &&
          (selectedKind === "all" || item.kind === selectedKind),
      ),
    [items, selectedClient, selectedKind],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<UploadTask>) => {
      setUploadTasks((current) =>
        current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
      );
    },
    [],
  );

  const uploadOne = useCallback(
    async (file: File, taskId: string) => {
      const validation = validateUploadCandidate({
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      if (!validation.valid) {
        updateTask(taskId, { status: "failed", error: validation.error });
        return;
      }

      let assetId: string | null = null;

      try {
        updateTask(taskId, { status: "uploading", progress: 1 });
        const metadata = await getMediaMetadata(file);
        const authorizationResponse = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            clientId: uploadClientId || null,
          }),
        });
        const authorizationPayload = await readJson(authorizationResponse);

        if (authorizationResponse.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!authorizationResponse.ok) {
          throw new Error(
            getErrorMessage(
              authorizationPayload,
              "Não foi possível autorizar o upload.",
            ),
          );
        }

        const authorization =
          authorizationPayload as MediaUploadAuthorization;
        assetId = authorization.assetId;
        await uploadToSignedUrl(file, authorization.uploadUrl, (progress) =>
          updateTask(taskId, { progress }),
        );

        updateTask(taskId, { status: "confirming", progress: 100 });
        const confirmationResponse = await fetch(
          `/api/media/${authorization.assetId}/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metadata),
          },
        );
        const confirmationPayload = await readJson(confirmationResponse);

        if (!confirmationResponse.ok) {
          throw new Error(
            getErrorMessage(
              confirmationPayload,
              "Não foi possível confirmar a mídia.",
            ),
          );
        }

        updateTask(taskId, { status: "ready", progress: 100 });
      } catch (uploadError) {
        if (assetId) {
          await fetch(`/api/media/${assetId}`, { method: "DELETE" }).catch(
            () => undefined,
          );
        }

        updateTask(taskId, {
          status: "failed",
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Não foi possível enviar o arquivo.",
        });
      }
    },
    [updateTask, uploadClientId],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!backendEnabled || files.length === 0) return;

      const tasks = files.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        progress: 0,
        status: "waiting" as const,
      }));
      setUploadTasks((current) => [...tasks, ...current]);

      for (let index = 0; index < files.length; index += 1) {
        await uploadOne(files[index], tasks[index].id);
      }

      await loadMedia(null, true);
    },
    [backendEnabled, loadMedia, uploadOne],
  );

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  }

  async function deleteMedia(item: MediaAssetSummary) {
    if (
      !window.confirm(
        `Remover “${item.originalName}” da biblioteca? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    setError("");

    try {
      const response = await fetch(`/api/media/${item.id}`, {
        method: "DELETE",
      });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Não foi possível remover a mídia."),
        );
      }
      setItems((current) => current.filter((media) => media.id !== item.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível remover a mídia.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="view media-library-view">
      <div className="page-heading media-library-heading">
        <div>
          <span className="eyebrow">
            {loading
              ? "CARREGANDO"
              : `${items.length} ${items.length === 1 ? "ARQUIVO" : "ARQUIVOS"}`}
          </span>
          <h1>Biblioteca de mídias</h1>
          <p>Todo o conteúdo visual dos seus clientes em um só lugar.</p>
        </div>
        <button
          className="primary-button"
          disabled={!backendEnabled}
          onClick={() => setUploadOpen((open) => !open)}
          title={
            backendEnabled
              ? undefined
              : "Configure Supabase e R2 para habilitar uploads."
          }
        >
          {uploadOpen ? <X size={16} /> : <Upload size={16} />}
          {uploadOpen ? "Fechar envio" : "Enviar mídia"}
        </button>
      </div>

      {!backendEnabled ? (
        <div className="media-demo-notice">
          <AlertCircle size={16} />
          <span>
            <strong>Modo demonstração</strong>
            <small>Configure Supabase e R2 para enviar arquivos reais.</small>
          </span>
        </div>
      ) : null}

      {uploadOpen ? (
        <section className="media-upload-panel" aria-label="Enviar mídias">
          <div className="media-upload-copy">
            <span className="media-upload-icon">
              <Upload size={19} />
            </span>
            <div>
              <h2>Novo envio</h2>
              <p>JPEG, PNG, WebP até 25 MB ou MP4 até 200 MB.</p>
            </div>
            <label className="media-client-select">
              <span>Cliente</span>
              <select
                value={uploadClientId}
                onChange={(event) => setUploadClientId(event.target.value)}
              >
                <option value="">Sem cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>

          <label
            className={`media-dropzone ${dragging ? "is-dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              multiple
              onChange={(event) => {
                void handleFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <span>
              <FileImage size={22} />
              <FileVideo size={22} />
            </span>
            <strong>Toque para escolher arquivos</strong>
            <small>No celular, você também poderá usar a câmera.</small>
          </label>

          {uploadTasks.length > 0 ? (
            <div className="upload-queue">
              <div className="upload-queue-heading">
                <strong>Envios recentes</strong>
                <button onClick={() => setUploadTasks([])}>Limpar lista</button>
              </div>
              {uploadTasks.map((task) => (
                <div className={`upload-task upload-${task.status}`} key={task.id}>
                  <span className="upload-task-status">
                    {task.status === "ready" ? (
                      <Check size={15} />
                    ) : task.status === "failed" ? (
                      <AlertCircle size={15} />
                    ) : (
                      <LoaderCircle size={15} />
                    )}
                  </span>
                  <span className="upload-task-copy">
                    <strong>{task.name}</strong>
                    <small>{task.error ?? statusLabel(task.status)}</small>
                  </span>
                  <span className="upload-task-value">
                    {task.status === "failed" ? "—" : `${task.progress}%`}
                  </span>
                  <i>
                    <b style={{ width: `${task.progress}%` }} />
                  </i>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="library-toolbar">
        <div className="library-tabs">
          <button
            className={selectedClient === "all" ? "active" : ""}
            onClick={() => setSelectedClient("all")}
          >
            Todos
          </button>
          {clients.map((client) => (
            <button
              key={client.id}
              className={selectedClient === client.id ? "active" : ""}
              onClick={() => setSelectedClient(client.id)}
            >
              {client.name}
            </button>
          ))}
        </div>
        <div>
          <label className="library-kind-filter">
            <span className="sr-only">Filtrar por tipo</span>
            {selectedKind === "video" ? (
              <FileVideo size={15} />
            ) : (
              <FileImage size={15} />
            )}
            <select
              value={selectedKind}
              onChange={(event) =>
                setSelectedKind(
                  event.target.value as "all" | "image" | "video",
                )
              }
            >
              <option value="all">Todos os tipos</option>
              <option value="image">Imagens</option>
              <option value="video">Vídeos</option>
            </select>
            <ChevronDown size={13} />
          </label>
          <button>
            <CalendarDays size={15} /> Mais recentes
          </button>
        </div>
      </div>

      {error ? (
        <div className="media-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button onClick={() => void loadMedia(null, true)}>
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      ) : null}

      {loading ? (
        <section className="media-loading" aria-label="Carregando mídias">
          {Array.from({ length: 6 }, (_, index) => (
            <i key={index} />
          ))}
        </section>
      ) : visibleItems.length > 0 ? (
        <section className="media-grid">
          {visibleItems.map((item) => (
            <article key={item.id}>
              <div className="media-image">
                {item.kind === "video" && item.mimeType === "video/mp4" ? (
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={item.originalName}
                  />
                ) : (
                  <Image
                    src={item.url}
                    alt={item.originalName}
                    fill
                    sizes="(max-width: 700px) 50vw, 240px"
                    unoptimized
                  />
                )}
                {item.kind === "video" ? (
                  <span className="media-video-mark">
                    <Play size={11} fill="currentColor" /> Vídeo
                  </span>
                ) : (
                  <span>Imagem</span>
                )}
                {backendEnabled ? (
                  <button
                    aria-label={`Remover ${item.originalName}`}
                    disabled={deletingId === item.id}
                    onClick={() => void deleteMedia(item)}
                  >
                    {deletingId === item.id ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                ) : null}
              </div>
              <div className="media-card-copy">
                <span>
                  <strong>{item.clientName ?? "Sem cliente"}</strong>
                  <small title={item.originalName}>{item.originalName}</small>
                </span>
                <span>
                  <b>{formatFileSize(item.sizeBytes)}</b>
                  <small>{formatCreatedAt(item.createdAt)}</small>
                </span>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="media-empty">
          <span>
            <FileImage size={24} />
          </span>
          <h2>Nenhuma mídia por aqui</h2>
          <p>
            {items.length > 0
              ? "Ajuste os filtros para encontrar seus arquivos."
              : "Envie a primeira imagem ou vídeo deste workspace."}
          </p>
          {backendEnabled && items.length === 0 ? (
            <button
              className="primary-button"
              onClick={() => {
                setUploadOpen(true);
                window.requestAnimationFrame(() => inputRef.current?.click());
              }}
            >
              <Upload size={16} /> Escolher arquivo
            </button>
          ) : null}
        </section>
      )}

      {backendEnabled && cursor ? (
        <button
          className="secondary-button media-load-more"
          disabled={loadingMore}
          onClick={() => void loadMedia(cursor, false)}
        >
          {loadingMore ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}
          {loadingMore ? "Carregando..." : "Carregar mais"}
        </button>
      ) : null}
    </main>
  );
}
