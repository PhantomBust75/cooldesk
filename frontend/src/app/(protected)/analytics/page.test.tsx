import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AnalyticsPage from "./page";
import * as operationsApi from "@/lib/api/operations";
import * as analyticsDailyApi from "@/lib/api/analytics-daily";

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

vi.mock("@/lib/api/operations");
vi.mock("@/lib/api/analytics-daily");

const DEFAULT_OVERVIEW = {
  totalRevenue: 15000,
  totalJobs: 42,
  activeJobs: 10,
  completedJobs: 32,
  firstVisitResolutionRate: 88.5,
  revisitRate: 5.2,
};

const DEFAULT_DAILY = [
  { date: "2026-07-01", revenue: 500, total: 4, completed: 3 },
  { date: "2026-07-02", revenue: 700, total: 5, completed: 4 },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.mocked(operationsApi.fetchAnalyticsOverview).mockResolvedValue(DEFAULT_OVERVIEW);
  vi.mocked(operationsApi.fetchAnalyticsTechnicians).mockResolvedValue([]);
  vi.mocked(operationsApi.fetchAnalyticsBrands).mockResolvedValue([]);
  vi.mocked(operationsApi.fetchAnalyticsDealers).mockResolvedValue([]);
  vi.mocked(analyticsDailyApi.fetchAnalyticsDaily).mockResolvedValue(DEFAULT_DAILY);
});

afterEach(cleanup);

describe("AnalyticsPage", () => {
  it("renders the Analytics title and business KPI values", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Analytics" })).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
  });
});
