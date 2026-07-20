"use client";

import { useAuth } from "@/contexts/auth-context";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { getNotificationMeta } from "@/lib/notifications/notification-meta";
import type { NotificationItem } from "@/types/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCheck, CheckCircle, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSnackbar } from "notistack";
import { formatShortDateTime } from "@/lib/format-date";

type Filter = "all" | "unread" | "cancellations" | "assignments";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "cancellations", label: "Cancellations" },
  { key: "assignments", label: "Assignments" },
];

function formatTimestamp(iso: string): string {
  return formatShortDateTime(iso);
}

function NotifCard({ item, onViewJob }: { item: NotificationItem; onViewJob: (item: NotificationItem) => void }) {
  const meta = getNotificationMeta(item.eventType);
  const isUrgent = meta.priority === "high" || meta.priority === "medium";

  const background = item.isRead
    ? "#fff"
    : meta.priority === "high"
      ? "#FEF2F2"
      : meta.priority === "medium"
        ? "#FFFBEB"
        : "#FAFAFA";

  return (
    <div
      style={{
        backgroundColor: background,
        padding: "14px 20px",
        borderBottom: "1px solid #F5F5F5",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          backgroundColor: item.isRead ? "transparent" : "#2563EB",
          marginTop: "5px",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: item.isRead ? 400 : 500, color: "#171717", lineHeight: 1.4 }}>
            {meta.title}
          </span>
          <span
            style={{
              fontSize: "11px",
              color: "#A3A3A3",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {formatTimestamp(item.createdAt)}
          </span>
        </div>
        {meta.description ? (
          <p style={{ fontSize: "13px", color: "#525252", margin: "3px 0 0", lineHeight: 1.5 }}>{meta.description}</p>
        ) : null}
        {item.jobId ? (
          <button
            type="button"
            onClick={() => onViewJob(item)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              fontSize: "12px",
              color: "#2563EB",
              textDecoration: "none",
              marginTop: "5px",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            View job {item.jobId.slice(0, 8).toUpperCase()} <ChevronRight size={11} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
      {isUrgent ? (
        <AlertTriangle
          size={15}
          strokeWidth={1.5}
          color={meta.priority === "high" ? "#EF4444" : "#F59E0B"}
          style={{ flexShrink: 0, marginTop: "2px" }}
        />
      ) : null}
    </div>
  );
}

function NotifSkeleton() {
  return (
    <div role="status" aria-label="Loading notifications" aria-busy="true">
      <style>{`
        @keyframes notif-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
      {[0, 1, 2, 3, 4].map((i) => {
        const pulse = `notif-skeleton-pulse 1.4s ease-in-out ${i * 0.12}s infinite`;
        return (
          <div
            key={i}
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid #F5F5F5",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#E5E5E5", marginTop: "5px", flexShrink: 0, animation: pulse }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <div style={{ height: "11px", width: "42%", borderRadius: "4px", backgroundColor: "#E5E5E5", animation: pulse }} />
                <div style={{ height: "9px", width: "56px", borderRadius: "4px", backgroundColor: "#EFEFEF", flexShrink: 0, animation: pulse }} />
              </div>
              <div style={{ height: "9px", width: "82%", borderRadius: "4px", backgroundColor: "#EFEFEF", marginTop: "9px", animation: pulse }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const isMobile = useMobileBreakpoint();

  const audience = session?.user.role === "dealer" ? "dealer" : "user";

  const [filter, setFilter] = useState<Filter>("all");
  const [visible, setVisible] = useState(false);

  // Drag-to-dismiss (mobile)
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const [dragging, setDragging] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", audience],
    queryFn: () => fetchNotifications(audience, {}),
    enabled: open,
    staleTime: 30_000,
  });

  const items = notificationsQuery.data ?? [];
  const unreadCount = items.filter((item) => !item.isRead).length;

  const filtered = items.filter((item) => {
    if (filter === "unread") return !item.isRead;
    if (filter === "cancellations") return getNotificationMeta(item.eventType).category === "cancellation";
    if (filter === "assignments") return getNotificationMeta(item.eventType).category === "assignment";
    return true;
  });

  // Enter animation — slide in on open, reset on close via cleanup
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(id);
      setVisible(false);
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead(audience);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      enqueueSnackbar("All notifications marked as read", { variant: "success" });
    } catch {
      enqueueSnackbar("Failed to mark notifications as read", { variant: "error" });
    }
  }

  function handleViewJob(item: NotificationItem) {
    if (!item.jobId) return;
    if (!item.isRead) {
      markNotificationRead(audience, item.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
        .catch(() => undefined);
    }
    router.push(`/jobs/${item.jobId}`);
    onClose();
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
    setDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || dragStartY.current === null) return;
    setDragOffset(Math.max(0, e.touches[0].clientY - dragStartY.current));
  };
  const handleTouchEnd = () => {
    isDragging.current = false;
    setDragging(false);
    if (dragOffset > 100) onClose();
    setDragOffset(0);
    dragStartY.current = null;
  };

  if (!open) return null;

  const emptyState = (
    <div style={{ padding: "64px 20px", textAlign: "center" }}>
      <CheckCircle size={32} strokeWidth={1.5} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4, color: "#10B981" }} />
      <p style={{ margin: 0, fontSize: "14px", fontWeight: 500, color: "#404040" }}>You&apos;re all caught up!</p>
      <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#737373" }}>No notifications in this category.</p>
    </div>
  );

  const list = notificationsQuery.isLoading ? <NotifSkeleton /> : filtered.length === 0 ? emptyState : (
    filtered.map((item) => <NotifCard key={item.id} item={item} onViewJob={handleViewJob} />)
  );

  /* ── Mobile: bottom sheet ── */
  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 10000 }}>
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            opacity: visible ? 1 : 0,
            transition: "opacity 240ms ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "92vh",
            backgroundColor: "#fff",
            borderRadius: "18px 18px 0 0",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            transform: visible ? `translateY(${dragOffset}px)` : "translateY(100%)",
            transition: dragging ? "none" : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
            willChange: "transform",
          }}
        >
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ display: "flex", justifyContent: "center", paddingTop: "10px", paddingBottom: "4px", flexShrink: 0, cursor: "grab", touchAction: "none" }}
          >
            <div style={{ width: "36px", height: "4px", borderRadius: "9999px", backgroundColor: "#D4D4D4" }} />
          </div>

          <div style={{ padding: "10px 16px 14px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px", fontWeight: 600, color: "#0A0A0A", letterSpacing: "-0.02em" }}>Notifications</span>
                {unreadCount > 0 && (
                  <span style={{ backgroundColor: "#F5F5F5", color: "#525252", borderRadius: "9999px", fontSize: "12px", fontWeight: 500, padding: "2px 8px" }}>
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close notifications"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "9999px", background: "#F5F5F5", border: "none", cursor: "pointer", color: "#525252" }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "9999px",
                    fontSize: "13px",
                    cursor: "pointer",
                    flexShrink: 0,
                    backgroundColor: filter === f.key ? "#0A0A0A" : "#F5F5F5",
                    color: filter === f.key ? "#fff" : "#525252",
                    border: "none",
                    fontWeight: filter === f.key ? 500 : 400,
                    minHeight: "36px",
                  }}
                >
                  {f.label}
                </button>
              ))}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0, padding: "8px 14px", borderRadius: "9999px", border: "1px solid #E5E5E5", backgroundColor: "#fff", cursor: "pointer", fontSize: "13px", color: "#404040", minHeight: "36px" }}
                >
                  <CheckCheck size={13} strokeWidth={1.5} /> Mark all read
                </button>
              )}
            </div>
          </div>

          <div style={{ width: "100%", height: "1px", backgroundColor: "#E5E5E5", flexShrink: 0 }} />

          <div style={{ flex: 1, overflowY: "auto" }}>{list}</div>
        </div>
      </div>
    );
  }

  /* ── Desktop: right-side slide-in ── */
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.28)",
          opacity: visible ? 1 : 0,
          transition: "opacity 240ms ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "460px",
          maxWidth: "100vw",
          backgroundColor: "#fff",
          borderLeft: "1px solid #E5E5E5",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)",
          willChange: "transform",
        }}
      >
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #E5E5E5", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: unreadCount > 0 ? "12px" : "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Notifications</h2>
              {unreadCount > 0 && (
                <span style={{ backgroundColor: "#F5F5F5", color: "#525252", borderRadius: "9999px", fontSize: "12px", fontWeight: 500, padding: "2px 8px", marginTop: "6px" }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close notifications"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", background: "none", border: "none", cursor: "pointer", color: "#737373", flexShrink: 0, transition: "background-color 120ms, color 120ms" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "#F5F5F5";
                (e.currentTarget as HTMLElement).style.color = "#0A0A0A";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLElement).style.color = "#737373";
              }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "14px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "9999px",
                    fontSize: "12px",
                    cursor: "pointer",
                    backgroundColor: filter === f.key ? "#0A0A0A" : "#fff",
                    color: filter === f.key ? "#fff" : "#525252",
                    border: `1px solid ${filter === f.key ? "#0A0A0A" : "#E5E5E5"}`,
                    fontWeight: filter === f.key ? 500 : 400,
                    transition: "all 120ms",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", cursor: "pointer", fontSize: "12px", color: "#404040", whiteSpace: "nowrap", flexShrink: 0, transition: "background-color 120ms" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F5F5")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
              >
                <CheckCheck size={12} strokeWidth={1.5} /> Mark all read
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>{list}</div>
      </div>
    </div>
  );
}
