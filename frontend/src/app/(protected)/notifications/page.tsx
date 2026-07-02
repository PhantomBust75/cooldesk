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
import { BellRing, Check, Filter, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

function eventLabel(eventType: string): string {
  return eventType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function NotificationsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();

  const [tab, setTab] = useState<"all" | "unread" | "cancellations" | "assignments">("all");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audience = session?.user.role === "dealer" ? "dealer" : "user";

  const notificationsQuery = useQuery({
    queryKey: ["notifications", audience],
    queryFn: () => fetchNotifications(audience, {}),
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "9999px", border: "none", backgroundColor: "#2563EB", padding: "4px 10px", fontSize: "11px", fontWeight: 600, color: "#fff" }}>
            <BellRing size={11} strokeWidth={1.5} /> {unreadCountQuery.data?.count ?? "--"}
          </div>
          <button type="button" onClick={() => notificationsQuery.refetch()} style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#FAFAFA", padding: "7px 12px", fontSize: "13px", color: "#404040", cursor: "pointer" }}>
            <RefreshCw size={13} strokeWidth={1.5} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", marginBottom: "16px" }}>
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
                border: "none",
                backgroundColor: tab === item.key ? "#0A0A0A" : "#F5F5F5",
                color: tab === item.key ? "#fff" : "#404040",
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: tab === item.key ? 500 : 400,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
          <span style={{ fontSize: "12px", color: "#737373" }}>
            {unreadItems.length > 0 ? `${unreadItems.length} unread` : "All caught up"}
          </span>
          {unreadItems.length > 0 && (
            <button
              type="button"
              onClick={markAllVisibleAsRead}
              style={{
                borderRadius: "8px",
                border: "1px solid #E5E5E5",
                backgroundColor: "#FAFAFA",
                color: "#404040",
                padding: "6px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Mark all as read
            </button>
          )}
        </div>

        {feedback ? <p style={{ marginTop: "12px", borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "10px 12px", fontSize: "13px", color: "#166534" }}>{feedback}</p> : null}
        {errorMessage ? <p style={{ marginTop: "12px", borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "10px 12px", fontSize: "13px", color: "#991B1B" }}>{errorMessage}</p> : null}
      </div>

      <div style={{ backgroundColor: "#FAFAFA", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden" }}>
        {notificationsQuery.isLoading ? <p style={{ padding: "18px", margin: 0, fontSize: "13px", color: "#737373" }}>Loading notifications...</p> : null}
        {notificationsQuery.isError ? <p style={{ padding: "18px", margin: 0, fontSize: "13px", color: "#991B1B" }}>Failed to load notifications.</p> : null}
        {!notificationsQuery.isLoading && filteredItems.length === 0 ? <p style={{ padding: "18px", margin: 0, fontSize: "13px", color: "#737373" }}>No notifications found.</p> : null}

        {filteredItems.map((item: NotificationItem) => (
          <div
            key={item.id}
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #E5E5E5",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              backgroundColor: item.isRead ? "#fff" : "#FAFAFA",
            }}
          >
            {/* Unread indicator dot */}
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "9999px",
                backgroundColor: item.isRead ? "transparent" : "#2563EB",
                flexShrink: 0,
                marginTop: "5px",
                border: item.isRead ? "1px solid #E5E5E5" : "none",
              }}
            />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: item.isRead ? 400 : 500, color: "#171717" }}>
                  {eventLabel(item.eventType)}
                </span>
                {item.jobId ? (
                  <Link
                    href={`/jobs/${item.jobId}`}
                    style={{
                      fontSize: "12px",
                      color: "#525252",
                      textDecoration: "none",
                      backgroundColor: "#F9F9F9",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                    }}
                  >
                    Job {item.jobId.slice(0, 8).toUpperCase()}
                  </Link>
                ) : null}
              </div>
              <div style={{ marginTop: "3px", fontSize: "12px", color: "#737373" }}>
                {new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            {/* Actions */}
            {!item.isRead ? (
              <button
                type="button"
                onClick={() => markReadMutation.mutate(item.id)}
                style={{
                  flexShrink: 0,
                  borderRadius: "8px",
                  border: "1px solid #E5E5E5",
                  backgroundColor: "#FAFAFA",
                  color: "#404040",
                  padding: "5px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Check size={11} strokeWidth={1.5} /> Mark read
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
