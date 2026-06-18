"use client";

import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api/client";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
} from "@/lib/api/notifications";
import type { NotificationItem } from "@/types/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Check, Filter, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

function eventLabel(eventType: string): string {
  return eventType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function payloadPreview(payload: unknown): string {
  if (payload == null) {
    return "-";
  }
  if (typeof payload === "string") {
    return payload;
  }

  try {
    const raw = JSON.stringify(payload);
    return raw.length > 220 ? `${raw.slice(0, 220)}...` : raw;
  } catch {
    return "[unserializable payload]";
  }
}

export default function NotificationsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();

  const [tab, setTab] = useState<"all" | "unread" | "cancellations" | "assignments">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(50);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audience = session?.user.role === "dealer" ? "dealer" : "user";

  const notificationsQuery = useQuery({
    queryKey: ["notifications", audience, unreadOnly, limit],
    queryFn: () => fetchNotifications(audience, { unreadOnly, limit }),
  });

  const unreadCountQuery = useQuery({
    queryKey: ["notifications", audience, "unread-count"],
    queryFn: () => fetchUnreadNotificationCount(audience),
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(audience, notificationId),
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["notifications", audience] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to mark notification as read.");
      }
    },
  });

  const items = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);
  const unreadItems = useMemo(() => items.filter((item) => !item.isRead), [items]);
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (tab === "unread" && item.isRead) {
        return false;
      }

      if (tab === "cancellations") {
        return /cancel/.test(item.eventType);
      }

      if (tab === "assignments") {
        return /assign/.test(item.eventType);
      }

      return true;
    });
  }, [items, tab]);

  async function markAllVisibleAsRead() {
    if (unreadItems.length === 0) {
      setFeedback("No unread notifications in current list.");
      return;
    }

    setFeedback(null);
    setErrorMessage(null);

    try {
      await Promise.all(unreadItems.map((item) => markNotificationRead(audience, item.id)));
      setFeedback(`Marked ${unreadItems.length} notification(s) as read.`);
      queryClient.invalidateQueries({ queryKey: ["notifications", audience] });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to mark all visible notifications as read.");
      }
    }
  }

  return (
    <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1000px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Notifications</h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>In-app alerts scoped to your organization and role.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", borderRadius: "9999px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "6px 10px", fontSize: "12px", color: "#404040" }}>
            <BellRing size={13} strokeWidth={1.5} /> Unread: {unreadCountQuery.data?.count ?? "--"}
          </div>
          <button type="button" onClick={() => notificationsQuery.refetch()} style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", padding: "7px 12px", fontSize: "13px", color: "#404040", cursor: "pointer" }}>
            <RefreshCw size={13} strokeWidth={1.5} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <span style={{ fontSize: "12px", color: "#737373", display: "inline-flex", alignItems: "center", gap: "5px" }}><Filter size={12} strokeWidth={1.5} /> Filters</span>
          {([
            { key: "all", label: "All" },
            { key: "unread", label: "Unread" },
            { key: "cancellations", label: "Cancellations" },
            { key: "assignments", label: "Assignments" },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                borderRadius: "9999px",
                border: `1px solid ${tab === item.key ? "#0A0A0A" : "#E5E5E5"}`,
                backgroundColor: tab === item.key ? "#0A0A0A" : "#fff",
                color: tab === item.key ? "#fff" : "#404040",
                padding: "4px 10px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "10px", alignItems: "end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#404040" }}>
            <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
            Unread only (query)
          </label>
          <label style={{ fontSize: "12px", color: "#737373" }}>
            Limit
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} style={{ marginTop: "5px", width: "100%", borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px" }}>
              {[20, 50, 100].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={markAllVisibleAsRead} style={{ borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", padding: "9px 12px", fontSize: "13px", cursor: "pointer" }}>
            Mark visible unread as read
          </button>
        </div>

        {feedback ? <p style={{ marginTop: "12px", borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "10px 12px", fontSize: "13px", color: "#166534" }}>{feedback}</p> : null}
        {errorMessage ? <p style={{ marginTop: "12px", borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "10px 12px", fontSize: "13px", color: "#991B1B" }}>{errorMessage}</p> : null}
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden" }}>
        {notificationsQuery.isLoading ? <p style={{ padding: "18px", margin: 0, fontSize: "13px", color: "#737373" }}>Loading notifications...</p> : null}
        {notificationsQuery.isError ? <p style={{ padding: "18px", margin: 0, fontSize: "13px", color: "#991B1B" }}>Failed to load notifications.</p> : null}
        {!notificationsQuery.isLoading && filteredItems.length === 0 ? <p style={{ padding: "18px", margin: 0, fontSize: "13px", color: "#737373" }}>No notifications found.</p> : null}

        {filteredItems.map((item: NotificationItem) => (
          <article key={item.id} style={{ padding: "14px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: item.isRead ? "#fff" : "#FFFBEB", display: "flex", gap: "12px", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "10px", minWidth: 0, flex: 1 }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "9999px", border: "1px solid #E5E5E5", backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Bell size={13} strokeWidth={1.5} color={item.isRead ? "#A3A3A3" : "#B45309"} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>{eventLabel(item.eventType)}</span>
                  <span style={{ fontSize: "11px", borderRadius: "9999px", border: "1px solid #E5E5E5", backgroundColor: item.isRead ? "#F5F5F5" : "#FEF3C7", color: item.isRead ? "#525252" : "#92400E", padding: "2px 8px" }}>
                    {item.isRead ? "Read" : "Unread"}
                  </span>
                </div>
                <div style={{ marginTop: "2px", fontSize: "12px", color: "#737373" }}>
                  {item.jobId ? `Job ${item.jobId} · ` : ""}{new Date(item.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#525252", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={payloadPreview(item.payload)}>
                  {payloadPreview(item.payload)}
                </div>
              </div>
            </div>
            {!item.isRead ? (
              <button type="button" onClick={() => markReadMutation.mutate(item.id)} style={{ borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", padding: "6px 10px", fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                <Check size={12} strokeWidth={1.5} /> Mark read
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
