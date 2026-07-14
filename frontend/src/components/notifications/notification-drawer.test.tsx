"use client";

import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationDrawer } from "./notification-drawer";
import * as notificationsApi from "@/lib/api/notifications";

const push = vi.fn();
const enqueueSnackbar = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("notistack", () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1", name: "Test User", role: "owner" } },
  }),
}));

vi.mock("@/hooks/use-mobile-breakpoint", () => ({
  useMobileBreakpoint: () => false,
}));

vi.mock("@/lib/api/notifications");

const cancellationNotif = {
  id: "notif-cancel",
  eventType: "cancellation_request_submitted",
  jobId: "aaaa1111bbbb2222",
  payload: null,
  isRead: false,
  readAt: null,
  createdAt: new Date("2026-05-05T10:30:00Z").toISOString(),
};

const assignmentNotif = {
  id: "notif-assign",
  eventType: "job_assigned",
  jobId: "cccc3333dddd4444",
  payload: null,
  isRead: false,
  readAt: null,
  createdAt: new Date("2026-05-05T11:30:00Z").toISOString(),
};

describe("NotificationDrawer", () => {
  let queryClient: QueryClient;

  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([]);
    vi.mocked(notificationsApi.markNotificationRead).mockResolvedValue({ ok: true });
    vi.mocked(notificationsApi.markAllNotificationsRead).mockResolvedValue({ ok: true, count: 1 });
  });

  function renderDrawer(open = true, onClose = vi.fn()) {
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationDrawer open={open} onClose={onClose} />
      </QueryClientProvider>,
    );
    return { onClose };
  }

  it("renders nothing when closed", () => {
    renderDrawer(false);
    expect(screen.queryByText("Notifications")).toBeNull();
  });

  it("shows the Notifications heading when open", async () => {
    renderDrawer();
    await waitFor(() => expect(screen.getByText("Notifications")).toBeInTheDocument());
  });

  it("shows a skeleton loader while notifications are loading, then removes it", async () => {
    let resolve: (value: typeof cancellationNotif[]) => void = () => {};
    vi.mocked(notificationsApi.fetchNotifications).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderDrawer();

    expect(await screen.findByRole("status", { name: /loading notifications/i })).toBeInTheDocument();

    resolve([]);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("closes when the X button is clicked", async () => {
    const { onClose } = renderDrawer();
    await waitFor(() => screen.getByText("Notifications"));
    fireEvent.click(screen.getByRole("button", { name: /close notifications/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const { onClose } = renderDrawer();
    await waitFor(() => screen.getByText("Notifications"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("partitions items by category when a filter tab is selected", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([cancellationNotif, assignmentNotif]);
    renderDrawer();
    await waitFor(() => expect(screen.getByText("Cancellation Requested")).toBeInTheDocument());
    expect(screen.getByText("Job Assigned")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancellations" }));
    expect(screen.getByText("Cancellation Requested")).toBeInTheDocument();
    expect(screen.queryByText("Job Assigned")).toBeNull();
  });

  it("marks all as read via the bulk endpoint and shows a success snackbar", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([cancellationNotif]);
    renderDrawer();
    await waitFor(() => screen.getByText("Cancellation Requested"));

    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }));
    await waitFor(() =>
      expect(notificationsApi.markAllNotificationsRead).toHaveBeenCalledWith("user"),
    );
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), { variant: "success" }),
    );
  });

  it("marks an item read and navigates when View Job is clicked", async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue([cancellationNotif]);
    const { onClose } = renderDrawer();
    await waitFor(() => screen.getByText("Cancellation Requested"));

    fireEvent.click(screen.getByRole("button", { name: /view job/i }));
    expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith("user", cancellationNotif.id);
    expect(push).toHaveBeenCalledWith(`/jobs/${cancellationNotif.jobId}`);
    expect(onClose).toHaveBeenCalled();
  });
});
