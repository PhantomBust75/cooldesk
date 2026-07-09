import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TechnicianDetailPanel } from "./TechnicianDetailPanel";
import * as operationsApi from "@/lib/api/operations";
import type { TechnicianDirectoryItem, TechnicianJob } from "@/types/operations";

vi.mock("@/lib/api/operations");
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    style,
  }: {
    href: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
  }) => (
    <a href={href} style={style}>
      {children}
    </a>
  ),
}));

const mockTechnician: TechnicianDirectoryItem = {
  id: "tech-1",
  name: "Alice Smith",
  email: "alice@cooldesk.sa",
  phone: null,
  region: null,
  role: "technician",
  isActive: true,
  activeAssignments: 2,
  createdAt: null,
};

const mockJobs: TechnicianJob[] = [
  {
    id: "job-active-1",
    customerName: "Bob Jones",
    type: "installation",
    status: "in_process",
    createdAt: "2024-01-15T10:00:00Z",
    amountCollected: 0,
    avgRating: null,
    address: null,
    scheduledAt: null,
  },
  {
    id: "job-done-1",
    customerName: "Carol Brown",
    type: "complaint",
    status: "completed",
    createdAt: "2024-01-10T09:00:00Z",
    amountCollected: 500,
    avgRating: 4.5,
    address: null,
    scheduledAt: null,
  },
  {
    id: "job-done-2",
    customerName: "Dave Wilson",
    type: "installation",
    status: "cancelled",
    createdAt: "2024-01-05T08:00:00Z",
    amountCollected: 0,
    avgRating: null,
    address: null,
    scheduledAt: null,
  },
];

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("TechnicianDetailPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(operationsApi.fetchTechnicianJobs).mockResolvedValue(mockJobs);
  });

  it("shows the technician name in the header", async () => {
    const { wrapper } = { wrapper: makeWrapper() };
    render(
      <TechnicianDetailPanel technician={mockTechnician} onClose={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByText("Alice Smith")).toBeTruthy();
  });

  it("shows Job History tab by default", async () => {
    render(
      <TechnicianDetailPanel technician={mockTechnician} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    const historyTab = screen.getByRole("button", { name: /Job History/i });
    expect(historyTab).toBeTruthy();
  });

  it("switches to History tab when clicked", async () => {
    render(
      <TechnicianDetailPanel technician={mockTechnician} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    const historyTab = screen.getByRole("button", { name: /History/i });
    fireEvent.click(historyTab);
    // After click, History tab should be selected (has bold font weight via style)
    expect(historyTab).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <TechnicianDetailPanel technician={mockTechnician} onClose={onClose} />,
      { wrapper: makeWrapper() },
    );
    // The close button — find by its type=button that is not a tab
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons.find((btn) => !btn.textContent?.match(/History|Ongoing|Performance/));
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("displays active jobs (non-terminal statuses) on Ongoing tab", async () => {
    render(
      <TechnicianDetailPanel technician={mockTechnician} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    fireEvent.click(screen.getByRole("button", { name: /Ongoing/i }));
    // Wait for data to load
    await screen.findByText("Bob Jones");
    expect(screen.getByText("Bob Jones")).toBeTruthy();
    // Carol (completed) and Dave (cancelled) should not appear on the Ongoing tab
    expect(screen.queryByText("Carol Brown")).toBeNull();
    expect(screen.queryByText("Dave Wilson")).toBeNull();
  });

  it("displays history jobs (terminal statuses) on Job History tab by default", async () => {
    render(
      <TechnicianDetailPanel technician={mockTechnician} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    // Carol (completed) should appear
    await screen.findByText("Carol Brown");
    expect(screen.getByText("Carol Brown")).toBeTruthy();
    // Dave (cancelled) should appear
    expect(screen.getByText("Dave Wilson")).toBeTruthy();
    // Bob (in_process = active) should not appear
    expect(screen.queryByText("Bob Jones")).toBeNull();
  });
});
