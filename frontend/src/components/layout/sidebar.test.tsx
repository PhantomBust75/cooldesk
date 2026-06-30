import { render, screen, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ session: { user: { role: "owner" } } }),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("hides nav label text when collapsed", () => {
    render(<Sidebar collapsed={true} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText("Jobs")).toBeNull();
  });

  it("shows nav label text when expanded", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("renames Payment Methods to Payments & Brands", () => {
    render(<Sidebar collapsed={false} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.queryByText("Payment Methods")).toBeNull();
    expect(screen.getByText("Payments & Brands")).toBeTruthy();
  });

  it("hides brand name CoolDesk when collapsed on desktop", () => {
    render(<Sidebar collapsed={true} isSmallScreen={false} onToggle={vi.fn()} />);
    expect(screen.queryByText("CoolDesk")).toBeNull();
  });
});
