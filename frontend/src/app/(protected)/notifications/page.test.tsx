"use client";

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotificationsPage from "./page";
import * as notificationsApi from "@/lib/api/notifications";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    session: {
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: "owner",
        createdAt: new Date(),
        updatedAt: new Date(),
        officeId: "office-1",
      },
    },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/api/notifications");

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-mobile-breakpoint", () => ({
  useMobileBreakpoint: () => false,
}));

const unreadNotification = {
  id: "notif-1",
  eventType: "job_created",
  jobId: "abc123def456ghi7",
  payload: { some: "data", nested: { json: true } },
  isRead: false,
  readAt: null,
  createdAt: new Date("2024-01-15T10:30:00Z").toISOString(),
};

const readNotification = {
  id: "notif-2",
  eventType: "job_cancelled",
  jobId: null,
  payload: null,
  isRead: true,
  readAt: new Date("2024-01-14T08:00:00Z").toISOString(),
  createdAt: new Date("2024-01-14T07:00:00Z").toISOString(),
};

describe("NotificationsPage", () => {
  let queryClient: QueryClient;

  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([]);
    vi.mocked(notificationsApi.fetchUnreadNotificationCount).mockResolvedValue({ count: 0 });
    vi.mocked(notificationsApi.markNotificationRead).mockResolvedValue({ ok: true });
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <NotificationsPage />
      </QueryClientProvider>
    );
  }

  it("shows empty state when there are no notifications", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("No notifications found.")).toBeInTheDocument()
    );
  });

  it("renders notification event type as human-readable label", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([unreadNotification]);
    renderPage();
    await waitFor(() => expect(screen.getByText("Job Created")).toBeInTheDocument());
  });

  it("does NOT render raw JSON payload", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([unreadNotification]);
    renderPage();
    await waitFor(() => screen.getByText("Job Created"));
    expect(screen.queryByText(/\{"some":"data"/)).toBeNull();
  });

  it("shows a job link for notifications with a jobId", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([unreadNotification]);
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /ABC123DE/i });
      expect(link).toHaveAttribute("href", `/jobs/${unreadNotification.jobId}`);
    });
  });

  it("shows 'Mark read' button for unread notifications", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([unreadNotification]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /mark read/i })).toBeInTheDocument()
    );
  });

  it("does NOT show 'Mark read' button for read notifications", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([readNotification]);
    renderPage();
    await waitFor(() => screen.getByText("Job Cancelled"));
    expect(screen.queryByRole("button", { name: /mark read/i })).toBeNull();
  });

  it("does NOT render 'Unread only (query)' checkbox", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Notifications"));
    expect(screen.queryByText(/unread only \(query\)/i)).toBeNull();
  });

  it("does NOT render 'Limit' select or label", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Notifications"));
    expect(screen.queryByText(/^limit$/i)).toBeNull();
  });

  it("shows 'Mark all as read' button when unread notifications exist", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([unreadNotification]);
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /mark all as read/i })
      ).toBeInTheDocument()
    );
  });

  it("does NOT show 'Mark all as read' button when all notifications are read", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([readNotification]);
    renderPage();
    await waitFor(() => screen.getByText("All caught up"));
    expect(screen.queryByRole("button", { name: /mark all as read/i })).toBeNull();
  });

  it("shows 'All caught up' text when there are no unread notifications", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([readNotification]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("All caught up")).toBeInTheDocument()
    );
  });

  it("shows unread count text when unread notifications exist", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([unreadNotification]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("1 unread")).toBeInTheDocument()
    );
  });
});
