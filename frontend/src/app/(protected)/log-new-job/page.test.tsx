import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LogNewJobPage from "./page";
import * as authContext from "@/contexts/auth-context";
import * as operationsApi from "@/lib/api/operations";
import * as officeApi from "@/lib/api/office";

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

  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(authContext.useAuth).mockReturnValue({
      session: {
        accessToken: "test-token",
        user: {
          userId: "test-user",
          organizationId: "org-1",
          role: "owner",
          name: "Test User",
        },
      },
      isReady: true,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn().mockReturnValue(true),
    });

    vi.mocked(operationsApi.fetchDealers).mockResolvedValue([
      {
        id: "dealer-1",
        name: "Test Dealer",
        contactName: null,
        email: null,
        phone: "",
        region: null,
        isActive: true,
        createdAt: "2024-01-01T00:00:00Z",
        brandIds: [],
      },
    ]);
    vi.mocked(operationsApi.fetchOfficeBrands).mockResolvedValue([
      { id: "brand-1", name: "Test Brand", isActive: true, installationCharge: 0 },
    ]);
    vi.mocked(officeApi.fetchOfficeTechnicians).mockResolvedValue([
      { id: "tech-1", name: "Tech One", activeAssignments: 2 },
    ]);
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <LogNewJobPage />
      </QueryClientProvider>
    );
  }

  async function fillAndSubmitWizard(jobId: string) {
    vi.mocked(operationsApi.createQuickJob).mockResolvedValue({
      id: jobId,
      status: "new",
      version: 1,
    });

    renderPage();

    // Step 1: type=installation and source=direct are pre-selected → valid
    await waitFor(() => expect(screen.getByText("Job type & source")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 2: fill customer fields (phone is type="tel", not a textbox role)
    await waitFor(() => expect(screen.getByText("Customer identity")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("+966 50 000 0000"), {
      target: { value: "12345678" },
    });
    // type="tel" is also ARIA role "textbox", so order is: [phone, customerName, address]
    const [, nameInput, addressInput] = screen.getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Test Customer" } });
    fireEvent.change(addressInput, { target: { value: "123 Test Street" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 3: select brand, fill unit model and type
    await waitFor(() => expect(screen.getByText("Job details")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Test Brand")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("Select brand…"), {
      target: { value: "brand-1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Model"), { target: { value: "AC-1000" } });
    fireEvent.change(screen.getByPlaceholderText("Unit type"), { target: { value: "Split" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 4: review and submit
    await waitFor(() => expect(screen.getByText("Review & submit")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /create job/i }));

    // Wait for mutation to resolve and success screen to appear
    await waitFor(() => expect(screen.getByText("Job created")).toBeInTheDocument());
  }

  it("should show a success screen with 'Job created' heading after form submission", async () => {
    await fillAndSubmitWizard("abc123def456ghi789");

    expect(screen.getByText("Job created")).toBeInTheDocument();
    expect(screen.queryByText("Job type & source")).not.toBeInTheDocument();
  });

  it("should display the job ID truncated to 8 chars, uppercase", async () => {
    await fillAndSubmitWizard("abc123def456");

    // "abc123def456".slice(0, 8).toUpperCase() === "ABC123DE"
    expect(screen.getByText("ABC123DE")).toBeInTheDocument();
  });

  it("should have a 'View job' link pointing to /jobs/{full-job-id}", async () => {
    const jobId = "abc123def456ghi789";
    await fillAndSubmitWizard(jobId);

    const link = screen.getByRole("link", { name: /view job/i });
    expect(link).toHaveAttribute("href", `/jobs/${jobId}`);
  });

  it("should reset to wizard step 1 when 'Log another job' is clicked", async () => {
    await fillAndSubmitWizard("abc123def456");

    fireEvent.click(screen.getByRole("button", { name: /log another job/i }));

    await waitFor(() => expect(screen.getByText("Job type & source")).toBeInTheDocument());
    expect(screen.queryByText("Job created")).not.toBeInTheDocument();
  });

  it("should show the wizard (not the success screen) on initial render", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Job type & source")).toBeInTheDocument());
    expect(screen.queryByText("Job created")).not.toBeInTheDocument();
  });
});
