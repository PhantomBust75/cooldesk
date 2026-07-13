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

  it("shows one shared date-range control and export button, not one per tab", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Analytics" });
    expect(screen.getAllByRole("button", { name: /Last 30 days/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Export/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Technician scorecards" }));
    expect(screen.getAllByRole("button", { name: /Last 30 days/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Export/i })).toHaveLength(1);
  });

  it("opens the date-range dropdown, selects a new range, and closes it", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Analytics" });

    fireEvent.click(screen.getByRole("button", { name: /Last 30 days/i }));
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 90 days" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(await screen.findByRole("button", { name: /Last 7 days/i })).toBeInTheDocument();
    expect(operationsApi.fetchAnalyticsOverview).toHaveBeenCalledWith(7);
    expect(screen.queryByRole("button", { name: "Last 90 days" })).not.toBeInTheDocument();
  });

  it("closes the date-range dropdown on outside click without changing the range", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Analytics" });

    fireEvent.click(screen.getByRole("button", { name: /Last 30 days/i }));
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("button", { name: "Last 7 days" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Last 30 days/i })).toBeInTheDocument();
  });

  it("uses a 28px title on mobile and 36px on desktop", async () => {
    renderPage();
    const heading = await screen.findByRole("heading", { name: "Analytics" });
    expect(heading).toHaveStyle({ fontSize: "36px" });
    cleanup();

    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    renderPage();
    const mobileHeading = await screen.findByRole("heading", { name: "Analytics" });
    expect(mobileHeading).toHaveStyle({ fontSize: "28px" });
  });

  it("does not show a trend/comparison row on any KPI card (no backend data for it yet)", async () => {
    renderPage();
    await screen.findByText("42");
    expect(screen.queryByText(/vs prev period/i)).not.toBeInTheDocument();
  });

  it("uses a 2-column KPI grid on mobile and 4-column on desktop", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    renderPage();
    const value = await screen.findByText("42");
    const grid = value.closest("div")?.parentElement?.parentElement;
    expect(grid).toHaveStyle({ gridTemplateColumns: "repeat(2, 1fr)" });
  });

  it("renders chart titles as headings, not inside a bordered ChartCard box", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 3, name: "Daily Revenue (RS)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Daily Jobs" })).toBeInTheDocument();
  });

  it("shows a consolidated empty state when total_jobs is 0, instead of zero-value KPI cards", async () => {
    vi.mocked(operationsApi.fetchAnalyticsOverview).mockResolvedValue({
      totalRevenue: 0,
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      firstVisitResolutionRate: null,
      revisitRate: null,
    });
    vi.mocked(analyticsDailyApi.fetchAnalyticsDaily).mockResolvedValue([]);

    renderPage();
    expect(await screen.findByText("No analytics available for the selected period.")).toBeInTheDocument();
    expect(screen.getAllByText("No data to display")).toHaveLength(2);
    // The chart section titles still render above the placeholder boxes (by design — see
    // spec §6), so heading presence doesn't distinguish empty vs. non-empty. KPI card
    // labels only render in the non-empty path, so their absence is the real signal here.
    expect(screen.queryByText("Total Revenue (RS)")).not.toBeInTheDocument();
    expect(screen.queryByText("1st Visit Resolution")).not.toBeInTheDocument();
  });

  it("still shows KPI cards and charts when total_jobs is greater than 0", async () => {
    renderPage();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.queryByText("No analytics available for the selected period.")).not.toBeInTheDocument();
  });

  it("shows a 'no data' row in the technicians table when the array is empty, and colors on-time-rate by threshold", async () => {
    vi.mocked(operationsApi.fetchAnalyticsTechnicians).mockResolvedValue([
      {
        technicianId: "t1",
        technicianName: "Ahmed Al-Rashid",
        jobsCompleted: 12,
        revenueCollected: 4200,
        firstVisitResolutionRate: 90,
        avgResolutionMinutes: 45,
        onTimeRate: 92,
        avgStarRating: 4.5,
      },
      {
        technicianId: "t2",
        technicianName: "Nora Al-Shehri",
        jobsCompleted: 5,
        revenueCollected: 1000,
        firstVisitResolutionRate: null,
        avgResolutionMinutes: null,
        onTimeRate: 50,
        avgStarRating: null,
      },
    ]);

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Technician scorecards" }));

    expect(await screen.findByText("Ahmed Al-Rashid")).toBeInTheDocument();
    // The percentage <span> sits after the track <div>, which itself wraps the colored
    // fill <div> as its only child — so the fill color is previousElementSibling.firstElementChild.
    const highRateTrack = screen.getByText("92.0%").previousElementSibling!;
    expect(highRateTrack.firstElementChild).toHaveStyle({ backgroundColor: "#10B981" });

    const lowRateTrack = screen.getByText("50.0%").previousElementSibling!;
    expect(lowRateTrack.firstElementChild).toHaveStyle({ backgroundColor: "#EF4444" });

    expect(screen.getAllByText("—")).not.toHaveLength(0);

    cleanup();
    vi.mocked(operationsApi.fetchAnalyticsTechnicians).mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Technician scorecards" }));
    expect(await screen.findByText("No technician data for this period.")).toBeInTheDocument();
  });

  it("highlights a technician table row on hover", async () => {
    vi.mocked(operationsApi.fetchAnalyticsTechnicians).mockResolvedValue([
      {
        technicianId: "t1",
        technicianName: "Ahmed Al-Rashid",
        jobsCompleted: 12,
        revenueCollected: 4200,
        firstVisitResolutionRate: 90,
        avgResolutionMinutes: 45,
        onTimeRate: 92,
        avgStarRating: 4.5,
      },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Technician scorecards" }));
    const row = (await screen.findByText("Ahmed Al-Rashid")).closest("tr")!;
    // jsdom's getComputedStyle normalizes the "transparent" keyword to its rgba
    // equivalent; jest-dom's toHaveStyle expected-value builder does not, so the
    // literal keyword never matches computed style here — assert the normalized form.
    expect(row).toHaveStyle({ backgroundColor: "rgba(0, 0, 0, 0)" });
    fireEvent.mouseEnter(row);
    expect(row).toHaveStyle({ backgroundColor: "#FAFAFA" });
    fireEvent.mouseLeave(row);
    expect(row).toHaveStyle({ backgroundColor: "rgba(0, 0, 0, 0)" });
  });
});
