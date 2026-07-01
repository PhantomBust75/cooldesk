import { render, screen, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ session: { user: { role: "owner" } } }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe("Sidebar", () => {
  afterEach(() => cleanup());

  it("shows All jobs (lowercase j) when expanded", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.getByText("All jobs")).toBeTruthy();
    expect(screen.queryByText("All Jobs")).toBeNull();
  });

  it("shows System config (not Admin) when expanded", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.getByText("System config")).toBeTruthy();
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("shows Schedule and Assign (not &) when expanded", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Schedule and Assign")).toBeTruthy();
    expect(screen.queryByText("Schedule & Assign")).toBeNull();
  });

  it("does NOT show Notifications nav item", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.queryByText("Notifications")).toBeNull();
  });

  it("shows Collapse text in footer on desktop when expanded", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Collapse")).toBeTruthy();
  });

  it("hides Collapse text in footer when collapsed", () => {
    render(<Sidebar collapsed={true} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.queryByText("Collapse")).toBeNull();
  });

  it("does NOT render footer collapse button on mobile", () => {
    render(<Sidebar collapsed={false} isSmallScreen={true} onToggle={vi.fn()} />);
    expect(screen.queryByText("Collapse")).toBeNull();
  });

  it("hides nav labels when collapsed", () => {
    render(<Sidebar collapsed={true} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  it("shows nav labels when expanded", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("shows Payments & Brands nav item", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Payments & Brands")).toBeTruthy();
  });
});
