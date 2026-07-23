"use client";

import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock3,
  LoaderCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { notificationTargetView } from "@/lib/notifications/policy";
import type { OperationalNotification } from "@/lib/notifications/types";

type NotificationsResponse = {
  items: OperationalNotification[];
  unreadCount: number;
};

function relativeDate(value: string) {
  const elapsedMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (Math.abs(elapsedMinutes) < 60) return formatter.format(elapsedMinutes, "minute");
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return formatter.format(elapsedHours, "hour");
  return formatter.format(Math.round(elapsedHours / 24), "day");
}

export function NotificationCenter({
  enabled,
  onNavigate,
}: {
  enabled: boolean;
  onNavigate: (view: "calendar" | "clients") => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OperationalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (!enabled) return;
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = (await response.json().catch(() => null)) as NotificationsResponse | { error?: string } | null;
      if (!response.ok || !result || !("items" in result)) {
        throw new Error(result && "error" in result ? result.error : "Não foi possível carregar os alertas.");
      }
      setItems(result.items);
      setUnreadCount(result.unreadCount);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os alertas.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const initialLoad = window.setTimeout(() => void loadNotifications(), 0);
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    const refresh = () => void loadNotifications();
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  async function markRead(notification: OperationalNotification) {
    if (!notification.readAt) {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, readAt } : item));
      setUnreadCount((current) => Math.max(0, current - 1));
      const response = await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" });
      if (!response.ok) void loadNotifications();
    }
    setOpen(false);
    onNavigate(notificationTargetView(notification.metadata));
  }

  async function markAllRead() {
    const previousItems = items;
    const previousCount = unreadCount;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
    setUnreadCount(0);
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (!response.ok) {
      setItems(previousItems);
      setUnreadCount(previousCount);
      setError("Não foi possível marcar os alertas como lidos.");
    }
  }

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        className={`icon-button notification-button ${open ? "active" : ""}`}
        aria-label={unreadCount ? `Notificações, ${unreadCount} não lidas` : "Notificações"}
        aria-expanded={open}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void loadNotifications(true);
        }}
      >
        <Bell size={18} />
        {unreadCount ? <i aria-hidden="true" /> : null}
        {unreadCount ? <b>{unreadCount > 9 ? "9+" : unreadCount}</b> : null}
      </button>

      {open ? (
        <section className="notification-panel" aria-label="Central de notificações">
          <header>
            <div><span className="eyebrow">CENTRAL</span><h2>Notificações</h2></div>
            {unreadCount ? <button onClick={() => void markAllRead()}><CheckCheck size={14} /> Marcar lidas</button> : null}
          </header>

          <div className="notification-list">
            {loading && items.length === 0 ? <div className="notification-state"><LoaderCircle className="spin" size={18} /> Buscando alertas…</div> : null}
            {error ? <div className="notification-state notification-error"><AlertTriangle size={17} />{error}</div> : null}
            {!loading && !error && items.length === 0 ? <div className="notification-state"><CheckCheck size={19} /><strong>Tudo certo por aqui.</strong><span>Nenhuma ação necessária.</span></div> : null}
            {items.map((notification) => (
              <button
                className={`notification-item severity-${notification.severity} ${notification.readAt ? "is-read" : ""}`}
                key={notification.id}
                onClick={() => void markRead(notification)}
              >
                <span className="notification-icon">{notification.type === "connection_expiring" ? <Clock3 size={16} /> : <AlertTriangle size={16} />}</span>
                <span className="notification-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.body}</span>
                  <small><time dateTime={notification.createdAt}>{relativeDate(notification.createdAt)}</time> · {notification.metadata.view === "clients" ? "Revisar conexão" : "Abrir calendário"}</small>
                </span>
                {!notification.readAt ? <i aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
