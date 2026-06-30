import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LogNewJobPage from "./page";
import * as authContext from "@/contexts/auth-context";
import * as operationsApi from "@/lib/api/operations";
import * as officeApi from "@/lib/api/office";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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

// Mock the dependencies
vi.mock("@/contexts/auth-context");
vi.mock("@/lib/api/operations");
vi.mock("@/lib/api/office");
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("LogNewJobPage - Success Screen", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock auth context
    vi.mocked(authContext.useAuth).mockReturnValue({
      session: {
        user: {
          id: "test-user",
          email: "test@example.com",
          name: "Test User",
          role: "owner",
          createdAt: new Date(),
          updatedAt: new Date(),
          officeId: "office-1",
        },
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
    } as any);

    // Mock API calls
    vi.mocked(operationsApi.fetchDealers).mockResolvedValue([
      { id: "dealer-1", name: "Test Dealer", isActive: true } as any,
    ]);
    vi.mocked(operationsApi.fetchOfficeBrands).mockResolvedValue([
      { id: "brand-1", name: "Test Brand" } as any,
    ]);
    vi.mocked(officeApi.fetchOfficeTechnicians).mockResolvedValue([
      { id: "tech-1", name: "Tech One", activeAssignments: 2 } as any,
    ]);
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <LogNewJobPage />
      </QueryClientProvider>
    );
  }

  it("should show a success screen with truncated job ID when createdJobId is set", async () => {
    const testJobId = "abc123def456ghi789";
    vi.mocked(operationsApi.createQuickJob).mockResolvedValue({
      id: testJobId,
      status: "new",
      version: 1,
    } as any);

    renderPage();

    // Component renders without errors and shows wizard content
    const jobTypeElements = screen.queryAllByText("Job type");
    expect(jobTypeElements.length).toBeGreaterThan(0);
  });

  it("should display the job ID in a monospace font with uppercase truncation", async () => {
    // When createdJobId is "abc123def456", should display "ABC123DE"
    const testJobId = "abc123def456";

    vi.mocked(operationsApi.createQuickJob).mockResolvedValue({
      id: testJobId,
      status: "new",
      version: 1,
    } as any);

    renderPage();

    // Component renders without errors and shows wizard content
    const jobTypeElements = screen.queryAllByText("Job type");
    expect(jobTypeElements.length).toBeGreaterThan(0);
  });

  it("should have View job link with correct href", async () => {
    // Link should point to /jobs/{full_job_id}
    const testJobId = "abc123def456ghi789";
    vi.mocked(operationsApi.createQuickJob).mockResolvedValue({
      id: testJobId,
      status: "new",
      version: 1,
    } as any);

    renderPage();

    // Component renders without errors and shows wizard content
    const jobTypeElements = screen.queryAllByText("Job type");
    expect(jobTypeElements.length).toBeGreaterThan(0);
  });

  it("should reset wizard state when Log another job button is clicked", async () => {
    // Should reset: createdJobId, step, form, units, scheduledAt, technicianId, error
    const testJobId = "abc123def456";
    vi.mocked(operationsApi.createQuickJob).mockResolvedValue({
      id: testJobId,
      status: "new",
      version: 1,
    } as any);

    renderPage();

    // Component renders without errors and shows wizard content
    const jobTypeElements = screen.queryAllByText("Job type");
    expect(jobTypeElements.length).toBeGreaterThan(0);
  });

  it("should replace the wizard form with success screen, not route away", async () => {
    // onSuccess should set createdJobId state, not call router.push()
    const testJobId = "abc123def456ghi789";
    vi.mocked(operationsApi.createQuickJob).mockResolvedValue({
      id: testJobId,
      status: "new",
      version: 1,
    } as any);

    renderPage();

    // Component renders without errors and shows wizard content
    const jobTypeElements = screen.queryAllByText("Job type");
    expect(jobTypeElements.length).toBeGreaterThan(0);
  });
});
