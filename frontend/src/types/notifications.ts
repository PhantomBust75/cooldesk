export type NotificationItem = {
  id: string;
  eventType: string;
  jobId: string | null;
  payload: unknown;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListInput = {
  unreadOnly?: boolean;
  limit?: number;
};

export type NotificationUnreadCount = {
  count: number;
};
