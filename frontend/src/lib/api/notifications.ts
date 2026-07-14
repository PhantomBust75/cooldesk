import { apiClient } from "@/lib/api/client";
import type {
  NotificationItem,
  NotificationListInput,
  NotificationUnreadCount,
} from "@/types/notifications";

type Audience = "user" | "dealer";
type UnknownRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapNotification(row: UnknownRecord): NotificationItem {
  return {
    id: asString(row.id),
    eventType: asString(row.event_type),
    jobId: asNullableString(row.job_id),
    payload: row.payload,
    isRead: asBoolean(row.is_read),
    readAt: asNullableString(row.read_at),
    createdAt: asString(row.created_at),
  };
}

function listPath(audience: Audience, input: NotificationListInput): string {
  const params = new URLSearchParams();
  if (typeof input.unreadOnly === "boolean") {
    params.set("unreadOnly", String(input.unreadOnly));
  }
  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const base = audience === "dealer" ? "/dealer/notifications" : "/notifications";
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function unreadCountPath(audience: Audience): string {
  return audience === "dealer" ? "/dealer/notifications/unread-count" : "/notifications/unread-count";
}

function markReadPath(audience: Audience, notificationId: string): string {
  return audience === "dealer"
    ? `/dealer/notifications/${notificationId}/read`
    : `/notifications/${notificationId}/read`;
}

export async function fetchNotifications(
  audience: Audience,
  input: NotificationListInput,
): Promise<NotificationItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(listPath(audience, input));
  return rows.map(mapNotification);
}

export function fetchUnreadNotificationCount(audience: Audience): Promise<NotificationUnreadCount> {
  return apiClient.get<NotificationUnreadCount>(unreadCountPath(audience));
}

export function markNotificationRead(audience: Audience, notificationId: string): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(markReadPath(audience, notificationId));
}

export function markAllNotificationsRead(audience: Audience): Promise<{ ok: true; count: number }> {
  const base = audience === "dealer" ? "/dealer/notifications" : "/notifications";
  return apiClient.patch<{ ok: true; count: number }>(`${base}/read-all`);
}
