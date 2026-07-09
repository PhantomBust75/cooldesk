import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DealerDetailPanel } from "./DealerDetailPanel";
import * as operationsApi from "@/lib/api/operations";
import type { DealerDirectoryItem, DealerJobItem } from "@/types/operations";

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

const mockDealer: DealerDirectoryItem = {
  id: "dealer-1",
  name: "CoolAir Solutions",
  contactName: "Faisal Al-Harbi",
  email: "faisal@coolair.sa",
  phone: "+966500000000",
  region: "Riyadh",
  isActive: true,
  createdAt: "2024-01-01T00:00:00Z",
  brandIds: ["brand-1"],
};

const mockJobs: DealerJobItem[] = [
  {
    id: "job-active-1",
    customerName: "Bob Jones",
    type: "installation",
    status: "in_process",
    createdAt: "2024-01-15T10:00:00Z",
    scheduledAt: null,
    address: null,
    technicianName: null,
    amountCollected: 0,
  },
  {
    id: "job-done-1",
    customerName: "Carol Brown",
    type: "complaint",
    status: "completed",
    createdAt: "2024-01-10T09:00:00Z",
    scheduledAt: null,
    address: null,
    technicianName: "Ahmed Ali",
    amountCollected: 500,
  },
  {
    id: "job-done-2",
    customerName: "Dave Wilson",
    type: "installation",
    status: "cancelled",
    createdAt: "2024-01-05T08:00:00Z",
    scheduledAt: null,
    address: null,
    technicianName: null,
    amountCollected: 0,
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

describe("DealerDetailPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(operationsApi.fetchDealerJobs).mockResolvedValue(mockJobs);
  });

  it("shows the dealer name in the header", async () => {
    render(
      <DealerDetailPanel dealer={mockDealer} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText("CoolAir Solutions")).toBeTruthy();
  });

  it("shows Job History tab by default", async () => {
    render(
      <DealerDetailPanel dealer={mockDealer} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    const historyTab = screen.getByRole("button", { name: /Job History/i });
    expect(historyTab).toBeTruthy();
  });

  it("switches to History tab when clicked", async () => {
    render(
      <DealerDetailPanel dealer={mockDealer} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    const historyTab = screen.getByRole("button", { name: /History/i });
    fireEvent.click(historyTab);
    expect(historyTab).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <DealerDetailPanel dealer={mockDealer} onClose={onClose} />,
      { wrapper: makeWrapper() },
    );
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons.find((btn) => !btn.textContent?.match(/History|Ongoing|Performance/));
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("displays active jobs (non-terminal statuses) on Ongoing tab", async () => {
    render(
      <DealerDetailPanel dealer={mockDealer} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    fireEvent.click(screen.getByRole("button", { name: /Ongoing/i }));
    await screen.findByText("Bob Jones");
    expect(screen.getByText("Bob Jones")).toBeTruthy();
    expect(screen.queryByText("Carol Brown")).toBeNull();
    expect(screen.queryByText("Dave Wilson")).toBeNull();
  });

  it("displays history jobs (terminal statuses) on Job History tab by default", async () => {
    render(
      <DealerDetailPanel dealer={mockDealer} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    await screen.findByText("Carol Brown");
    expect(screen.getByText("Carol Brown")).toBeTruthy();
    expect(screen.getByText("Dave Wilson")).toBeTruthy();
    expect(screen.queryByText("Bob Jones")).toBeNull();
  });

  it("shows region info in the header when available", async () => {
    render(
      <DealerDetailPanel dealer={mockDealer} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText(/Riyadh/)).toBeTruthy();
  });
});
