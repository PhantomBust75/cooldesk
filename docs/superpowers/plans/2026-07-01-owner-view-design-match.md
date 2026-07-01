# Owner's View Design Match — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply pixel-perfect visual redesign from `Owner's View UI Design/` to the five areas: Sidebar, App Shell, Dashboard, All Jobs, Technicians, and Dealers.

**Architecture:** Surgical in-place edits — no new files, no new components, no Tailwind. Every change is inline-style updates and JSX structure adjustments within existing files. Shared primitives (`avatar.tsx`, `status-toggle.tsx`) are rewritten once and consumed by both Technicians and Dealers.

**Tech Stack:** Next.js 14+ App Router, React 18, react-query, lucide-react, Vitest + @testing-library/react

## Global Constraints

- All styles remain inline (`style={{...}}`), no CSS classes or Tailwind
- Preserve all API wiring, role-based access gates (`<RoleGate>`), and mutations
- `SessionUser` has `{ userId, organizationId, role, name? }` — no `email` field
- `JobListItem.tags` is `string[]` — use `tags.includes('chronic')` etc.
- `NotificationItem` has no `title`/`body` — derive title from `eventType`, use fixed body `"Tap to view details"`
- `fetchNotifications(audience, { limit: 4 })` is the API call for the notif popover
- `Audience` type is local to `notifications.ts` — pass string literals `"user"` | `"dealer"`
- Run tests: `cd frontend && npm run test:run`
- TypeCheck: `cd frontend && npx tsc --noEmit`

---

### Task 1: Sidebar — nav items + visual pixel fixes + footer collapse button

**Files:**
- Modify: `frontend/src/components/layout/sidebar.tsx`
- Modify: `frontend/src/components/layout/sidebar.test.tsx`

**Interfaces:**
- Produces: `Sidebar` with same props `{ collapsed, isSmallScreen, onToggle, onNavigate? }`
- The footer collapse button calls `onToggle` — works correctly because `onToggle` in app-shell already handles both desktop (toggle `desktopCollapsed`) and mobile (toggle `mobileOpen`). Footer is only rendered on `!isSmallScreen`.

- [ ] **Step 1: Write failing tests**

Replace the body of `frontend/src/components/layout/sidebar.test.tsx` with:

```tsx
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
```

- [ ] **Step 2: Run tests to see failures**

```bash
cd frontend && npm run test:run -- sidebar.test
```

Expected: several failures — "All jobs", "System config", "Schedule and Assign", "does NOT show Notifications", "Collapse" tests all fail.

- [ ] **Step 3: Rewrite `sidebar.tsx`**

Replace the entire file with:

```tsx
"use client";

import type { UserRole } from "@/types/auth";
import {
  BarChart2,
  Briefcase,
  ChevronRight,
  Clock,
  CreditCard,
  LayoutDashboard,
  Settings,
  Users,
  Building2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  roles?: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "All jobs", icon: Briefcase },
  { href: "/jobs/history", label: "History", icon: Clock, roles: ["technician"] },
  { href: "/pending-schedule", label: "Schedule and Assign", icon: Clock, roles: ["owner", "office_staff"] },
  { href: "/technicians", label: "Technicians", icon: Users, roles: ["owner", "office_staff"] },
  { href: "/dealer-management", label: "Dealers", icon: Building2, roles: ["owner", "office_staff"] },
  { href: "/analytics", label: "Analytics", icon: BarChart2, roles: ["owner", "office_staff"] },
  { href: "/payment-methods", label: "Payments & Brands", icon: CreditCard, roles: ["owner"] },
  { href: "/admin/system-config", label: "System config", icon: Settings, roles: ["owner"] },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  collapsed,
  isSmallScreen,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  isSmallScreen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { session } = useAuth();

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    const role = session?.user.role;
    if (!role) return false;
    return item.roles.includes(role);
  });

  const mobileHidden = isSmallScreen && collapsed;

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: isSmallScreen ? "280px" : collapsed ? "56px" : "240px",
        transition: isSmallScreen ? "transform 220ms ease-in-out" : "width 220ms ease-in-out",
        transform: isSmallScreen ? (mobileHidden ? "translateX(-100%)" : "translateX(0)") : undefined,
        backgroundColor: "#FAFAFA",
        borderRight: "1px solid #E5E5E5",
        boxShadow: isSmallScreen && !mobileHidden ? "4px 0 24px rgba(0,0,0,0.12)" : undefined,
        overflow: "hidden",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo header — no toggle button */}
      <div
        style={{
          height: "56px",
          borderBottom: "1px solid #E5E5E5",
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: "9px",
          flexShrink: 0,
        }}
      >
        <Zap size={20} strokeWidth={1.5} color="#0A0A0A" style={{ flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ fontSize: "15px", color: "#0A0A0A", fontWeight: 500, whiteSpace: "nowrap" }}>
            CoolDesk
          </span>
        )}
      </div>

      {/* Nav */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          padding: "10px 8px",
          overflowY: "auto",
          flex: 1,
        }}
      >
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              style={{
                borderRadius: "8px",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? "0" : "8px",
                textDecoration: "none",
                backgroundColor: active ? "#F5F5F5" : "transparent",
                color: active ? "#0A0A0A" : "#525252",
                fontSize: "14px",
                fontWeight: active ? 500 : 400,
                whiteSpace: "nowrap",
                minHeight: "44px",
                transition: "background-color 120ms, color 120ms",
              }}
            >
              <span style={{ flexShrink: 0, display: "inline-flex" }}>
                <Icon size={18} strokeWidth={1.5} />
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer collapse — desktop only */}
      {!isSmallScreen && (
        <div style={{ borderTop: "1px solid #E5E5E5", padding: "8px" }}>
          <button
            type="button"
            onClick={onToggle}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "8px 10px",
              borderRadius: "8px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#737373",
              fontSize: "13px",
              justifyContent: collapsed ? "center" : "flex-start",
              minHeight: "44px",
            }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span
              style={{
                transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform 220ms",
                flexShrink: 0,
                lineHeight: 0,
              }}
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd frontend && npm run test:run -- sidebar.test
```

Expected: all 10 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/sidebar.tsx frontend/src/components/layout/sidebar.test.tsx
git commit -m "feat(sidebar): remove header toggle, update nav labels, add footer collapse button"
```

---

### Task 2: App Shell — notification popover + avatar redesign + mobile header + remove BottomNav

**Files:**
- Modify: `frontend/src/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: `fetchNotifications` from `@/lib/api/notifications`, `NotificationItem` type from `@/types/notifications`
- New state: `notifOpen: boolean`, `notifRef: React.RefObject<HTMLDivElement>`
- New query: `queryKey: ["notifications", audience, "preview"]`
- `formatEventType(eventType)`: strips prefix before first `.`, replaces `_` with spaces, title-cases each word

- [ ] **Step 1: Rewrite `app-shell.tsx`**

Replace the entire file with:

```tsx
"use client";

import { fetchUnreadNotificationCount, fetchNotifications } from "@/lib/api/notifications";
import type { NotificationItem } from "@/types/notifications";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, LogOut, Menu, Plus, Search, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import { Sidebar } from "./sidebar";
import { SearchModal } from "./search-modal";

function userInitials(name: string | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatEventType(eventType: string): string {
  const withoutPrefix = eventType.includes(".")
    ? eventType.slice(eventType.indexOf(".") + 1)
    : eventType;
  return withoutPrefix
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, logout } = useAuth();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const isSmallScreen = useMobileBreakpoint();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close notification popover on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [notifOpen]);

  const audience = useMemo(() => {
    return session?.user.role === "dealer" ? "dealer" : "user";
  }, [session?.user.role]);

  const isPlatformAdmin = session?.user.role === "platform_admin";

  const unreadCountQuery = useQuery({
    queryKey: ["notifications", audience, "unread-count", "shell"],
    queryFn: () => fetchUnreadNotificationCount(audience),
    staleTime: 30_000,
    enabled: !isPlatformAdmin,
  });

  const notifsQuery = useQuery({
    queryKey: ["notifications", audience, "preview"],
    queryFn: () => fetchNotifications(audience, { limit: 4 }),
    staleTime: 30_000,
    enabled: !isPlatformAdmin,
  });

  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const collapsed = isSmallScreen ? !mobileOpen : desktopCollapsed;
  const sidebarWidth = desktopCollapsed ? 56 : 240;

  // ── Notification popover ─────────────────────────────
  const notifPopover = notifOpen ? (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "360px",
        backgroundColor: "#fff",
        border: "1px solid #E5E5E5",
        borderRadius: "12px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #E5E5E5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 500, color: "#0A0A0A" }}>Notifications</span>
        {unreadCount > 0 && (
          <span
            style={{
              backgroundColor: "#9F1239",
              color: "#fff",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 600,
              padding: "1px 7px",
            }}
          >
            {unreadCount}
          </span>
        )}
      </div>
      {/* Body */}
      <div>
        {(notifsQuery.data ?? []).map((notif: NotificationItem, i: number) => (
          <div
            key={notif.id}
            style={{
              padding: "12px 16px",
              borderBottom: i < (notifsQuery.data?.length ?? 0) - 1 ? "1px solid #F5F5F5" : "none",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              backgroundColor: notif.isRead ? "#fff" : "#FAFAFA",
              cursor: "pointer",
            }}
            onClick={() => {
              setNotifOpen(false);
              router.push("/notifications");
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: notif.isRead ? "transparent" : "#2563EB",
                marginTop: "5px",
                flexShrink: 0,
                display: "block",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: notif.isRead ? 400 : 500, color: "#171717", lineHeight: 1.4 }}>
                {formatEventType(notif.eventType)}
              </div>
              <div style={{ fontSize: "12px", color: "#737373", marginTop: "2px", lineHeight: 1.4 }}>
                Tap to view details
              </div>
              <div style={{ fontSize: "11px", color: "#A3A3A3", marginTop: "4px" }}>
                {new Date(notif.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
        {!notifsQuery.data?.length && (
          <div style={{ padding: "20px 16px", textAlign: "center", fontSize: "13px", color: "#737373" }}>
            No notifications
          </div>
        )}
      </div>
      {/* Footer */}
      <div style={{ borderTop: "1px solid #E5E5E5" }}>
        <button
          type="button"
          onClick={() => { setNotifOpen(false); router.push("/notifications"); }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            width: "100%",
            padding: "13px 16px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#0A0A0A",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          View all notifications <ChevronRight size={13} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  ) : null;

  // ── Bell button (shared desktop + mobile) ────────────
  function BellButton() {
    return (
      <div ref={notifRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setNotifOpen((prev) => !prev)}
          style={{
            position: "relative",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            backgroundColor: notifOpen ? "#F5F5F5" : "transparent",
            color: notifOpen ? "#0A0A0A" : "#737373",
            transition: "background-color 120ms",
            padding: 0,
          }}
          aria-label="Open notifications"
        >
          <Bell size={18} strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                width: "7px",
                height: "7px",
                backgroundColor: "#9F1239",
                borderRadius: "9999px",
                border: "1.5px solid #fff",
              }}
            />
          )}
        </button>
        {notifPopover}
      </div>
    );
  }

  // ── Avatar button (shared desktop + mobile) ──────────
  function AvatarButton() {
    return (
      <div style={{ position: "relative" }} ref={menuRef}>
        <button
          type="button"
          onClick={() => setUserMenuOpen((prev) => !prev)}
          style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}
          aria-label="User menu"
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "9999px",
              backgroundColor: userMenuOpen ? "#E5E5E5" : "#F5F5F5",
              border: `1px solid ${userMenuOpen ? "#D4D4D4" : "#E5E5E5"}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#171717",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "background-color 120ms, border-color 120ms",
            }}
          >
            {userInitials(session?.user.name)}
          </div>
          <span
            style={{
              position: "absolute",
              bottom: "0px",
              right: "0px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#10B981",
              border: "2px solid #fff",
            }}
          />
        </button>
        {userMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: "200px",
              backgroundColor: "#fff",
              border: "1px solid #E5E5E5",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              zIndex: 9999,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #F5F5F5" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                {session?.user.name ?? "User"}
              </div>
              <div style={{ fontSize: "12px", color: "#737373", marginTop: "1px", textTransform: "capitalize" }}>
                {session?.user.role?.replace(/_/g, " ")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { logout(); setUserMenuOpen(false); }}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "9px",
                fontSize: "13px",
                color: "#991B1B",
                textAlign: "left",
              }}
            >
              <LogOut size={14} strokeWidth={1.5} color="#EF4444" />
              Log out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA", color: "#171717" }}>
      {/* Mobile sidebar backdrop */}
      {isSmallScreen && mobileOpen ? (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 39, backgroundColor: "rgba(0,0,0,0.4)" }}
        />
      ) : null}

      <Sidebar
        collapsed={collapsed}
        isSmallScreen={isSmallScreen}
        onToggle={() => {
          if (isSmallScreen) { setMobileOpen((prev) => !prev); return; }
          setDesktopCollapsed((prev) => !prev);
        }}
        onNavigate={() => { if (isSmallScreen) setMobileOpen(false); }}
      />

      <div
        style={{
          marginLeft: isSmallScreen ? 0 : `${sidebarWidth}px`,
          transition: "margin-left 220ms ease-in-out",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Mobile header ─────────────────────────────── */}
        {isSmallScreen ? (
          <header
            style={{
              height: "56px",
              borderBottom: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              position: "sticky",
              top: 0,
              zIndex: 30,
              gap: "10px",
            }}
          >
            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                width: "36px",
                height: "36px",
                backgroundColor: "#fff",
                color: "#404040",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
              aria-label="Open menu"
            >
              <Menu size={17} strokeWidth={1.5} />
            </button>

            {/* Brand — left aligned */}
            <div style={{ display: "flex", alignItems: "center", gap: "7px", flex: 1 }}>
              <Zap size={18} strokeWidth={1.5} color="#0A0A0A" />
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#0A0A0A", letterSpacing: "-0.01em" }}>
                CoolDesk
              </span>
            </div>

            {/* Right: plus + bell + avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {session?.user.role !== "technician" && (
                <Link
                  href="/log-new-job"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    color: "#404040",
                    textDecoration: "none",
                  }}
                  aria-label="Log new job"
                >
                  <Plus size={22} strokeWidth={1.5} />
                </Link>
              )}
              <BellButton />
              <AvatarButton />
            </div>
          </header>
        ) : (
          /* ── Desktop header ───────────────────────────── */
          <header
            style={{
              height: "56px",
              borderBottom: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              position: "sticky",
              top: 0,
              zIndex: 30,
            }}
          >
            {/* Search bar */}
            <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                style={{
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  backgroundColor: "#fff",
                  height: "34px",
                  width: "380px",
                  maxWidth: "min(380px, calc(100vw - 560px))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 10px",
                  color: "#737373",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <Search size={14} strokeWidth={1.5} color="#A3A3A3" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Search jobs, customers...
                  </span>
                </span>
                <span
                  style={{
                    backgroundColor: "#F5F5F5",
                    border: "1px solid #E5E5E5",
                    borderRadius: "5px",
                    fontSize: "11px",
                    lineHeight: 1,
                    padding: "4px 6px",
                    color: "#A3A3A3",
                    flexShrink: 0,
                  }}
                >
                  ⌘K
                </span>
              </button>
            </div>

            {/* Right: log-new-job + divider + bell + avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {session?.user.role !== "technician" && (
                <Link
                  href="/log-new-job"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    border: "1px solid #E5E5E5",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    backgroundColor: "#fff",
                    color: "#404040",
                    fontSize: "13px",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Plus size={13} strokeWidth={1.5} />
                  Log new job
                </Link>
              )}
              <div style={{ width: "1px", height: "20px", backgroundColor: "#E5E5E5" }} />
              <BellButton />
              <AvatarButton />
            </div>
          </header>
        )}

        <main style={{ flex: 1, overflowY: "auto", backgroundColor: "#FAFAFA", padding: 0 }}>
          {children}
        </main>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. If you see "cannot find name 'BellButton'" or "AvatarButton", that means the inner function declarations need to be moved before the `return` statement — ensure `BellButton` and `AvatarButton` are defined as `function` declarations inside `AppShell` body, above the `return`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/app-shell.tsx
git commit -m "feat(app-shell): add notification popover, redesign avatar circle, update mobile header, remove BottomNav"
```

---

### Task 3: KPI Card + Dashboard page

**Files:**
- Modify: `frontend/src/components/dashboard/kpi-card.tsx`
- Modify: `frontend/src/app/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Update `kpi-card.tsx`**

Make these changes to `frontend/src/components/dashboard/kpi-card.tsx`:

**1a.** In the `Sparkline` component, change the `<svg>` to fill its container:

```tsx
// Old:
<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
// New:
<svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
```

**1b.** In the outer card `<div>` (the one with `style={{ position: 'relative', height: '154px', ... }}`), replace the entire `style` object:

```tsx
// Old style:
style={{
  position: 'relative',
  height: '154px',
  backgroundColor: '#fff',
  border: '1px solid #E5E5E5',
  borderTop: `3px solid ${accent}`,
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 12px 22px rgba(15, 23, 42, 0.08)',
}}
// New style:
style={{
  position: 'relative',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 10px 40px rgba(0,0,0,0.08)',
  borderTop: `3px solid ${accent}`,
  backgroundColor: '#fff',
}}
```

**1c.** In the inner content `<div>` (the one with `style={{ position: 'relative', zIndex: 1, padding: '16px 18px 0' }}`), add `paddingBottom`:

```tsx
// Old:
style={{ position: 'relative', zIndex: 1, padding: '16px 18px 0' }}
// New:
style={{ position: 'relative', zIndex: 1, padding: '16px 18px 0', paddingBottom: '64px' }}
```

**1d.** Change the value font size from `48px` to `40px`:

```tsx
// Old:
fontSize: '48px',
// New:
fontSize: '40px',
```

**1e.** In the sparkline wrapper `<div>` (the one with `position: 'absolute'`), update to pin to bottom:

```tsx
// Old:
style={{ position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '60px', opacity: 0.85 }}
// New:
style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', opacity: 0.85 }}
```

- [ ] **Step 2: Update `dashboard/page.tsx`**

**2a.** Update `tableCardStyle`:

```tsx
const tableCardStyle: CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',       // was 10px
  overflow: 'hidden',
};
```

**2b.** Update `tableToolbarStyle` — remove fixed height, use padding:

```tsx
const tableToolbarStyle: CSSProperties = {
  padding: '14px 18px',       // was height: '57px', padding: '0 18px'
  borderBottom: '1px solid #E5E7EB',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
```

**2c.** Update `headerCellStyle`:

```tsx
const headerCellStyle: CSSProperties = {
  height: '40px',
  padding: '0 18px',
  textAlign: 'left',
  fontSize: '12px',
  color: '#94A3B8',           // was '#8CA0BB'
  fontWeight: 500,            // was 700
  letterSpacing: '0.04em',
  backgroundColor: '#FAFAFA', // was '#F8F8F8'
};
```

**2d.** Update `bodyCellStyle` — remove fixed height, use padding:

```tsx
const bodyCellStyle: CSSProperties = {
  padding: '16px 18px',       // was height: '59px', padding: '0 18px'
  fontSize: '14px',
  color: '#536987',
  borderBottom: '1px solid #EEF0F3',
  verticalAlign: 'middle',
};
```

**2e.** Update toolbar title `fontWeight` from `600` to `500`. Find:

```tsx
<span style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Needs revisit</span>
```
Change to:
```tsx
<span style={{ fontSize: '16px', fontWeight: 500, color: '#111827' }}>Needs revisit</span>
```
Do the same for the "Active jobs" span.

**2f.** Delete the `getJobTagType` function entirely (lines 83–88 in the original).

**2g.** Update KPI accent colors in the `kpiCards` array:

```tsx
const kpiCards = [
  { title: 'Total active jobs', value: m ? String(m.totalActiveJobs) : '—', accent: '#737373', hasFill: false, trendKey: 'totalActiveJobs' as const },
  { title: 'Pending schedule', value: m ? String(m.pendingSchedule) : '—', accent: '#94A3B8', hasFill: false, trendKey: 'pendingSchedule' as const },
  { title: 'Amber alerts', value: m ? String(m.amberAlerts) : '—', accent: '#B45309', hasFill: true, trendKey: null },
  { title: 'Chronic jobs', value: m ? String(m.chronicJobs) : '—', accent: '#9F1239', hasFill: true, trendKey: null },
  { title: 'No-shows today', value: m ? String(m.noShowsToday) : '—', accent: '#78716C', hasFill: false, trendKey: null },
];
```

**2h.** Fix the chronic border + tag logic. In both tables, update every `<tr>` that currently has `borderLeft: index === 0 ? '3px solid #E11D48' : '3px solid transparent'` — remove the `borderLeft` from the `<tr>` style entirely.

Then on the CUSTOMER `<td>` in both tables, add the chronic border:

```tsx
// Needs revisit table — CUSTOMER <td>:
<td
  style={{
    ...bodyCellStyle,
    color: '#111827',
    fontWeight: 700,
    borderLeft: job.tags.includes('chronic') ? '2px solid #9F1239' : '2px solid transparent',
    paddingLeft: '16px',
  }}
>
  {job.customerName}
</td>
```

```tsx
// Active jobs table — CUSTOMER <td>:
<td
  style={{
    ...bodyCellStyle,
    color: '#111827',
    fontWeight: 700,
    borderLeft: job.tags.includes('chronic') ? '2px solid #9F1239' : '2px solid transparent',
    paddingLeft: '16px',
  }}
>
  {job.customerName}
</td>
```

**2i.** Fix the TAGS cells — replace `getJobTagType(job, index)` calls with `job.tags.includes(...)`:

```tsx
// Needs revisit table — TAGS <td>:
<td style={bodyCellStyle}>
  <div style={{ display: 'flex', gap: '4px' }}>
    {job.tags.includes('chronic') && <JobTag type="chronic" />}
    {job.tags.includes('frequent') && <JobTag type="frequent" />}
    {job.tags.includes('repeat') && <JobTag type="repeat" />}
  </div>
</td>

// Active jobs table — TAGS <td>:
<td style={bodyCellStyle}>
  <div style={{ display: 'flex', gap: '4px' }}>
    {job.tags.includes('chronic') && <JobTag type="chronic" />}
    {job.tags.includes('frequent') && <JobTag type="frequent" />}
    {job.tags.includes('repeat') && <JobTag type="repeat" />}
  </div>
</td>
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. The `getJobTagType` function removal may produce "cannot find name" if you missed a call site — search the file for any remaining `getJobTagType(` and remove them.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/kpi-card.tsx frontend/src/app/\(protected\)/dashboard/page.tsx
git commit -m "feat(dashboard): update KPI card styles, fix tag logic to use job.tags array, update table styles"
```

---

### Task 4: Jobs List — filter animation + filter button + table tweaks

**Files:**
- Modify: `frontend/src/components/jobs/jobs-list.tsx`

- [ ] **Step 1: Update imports in `jobs-list.tsx`**

Change lucide-react import — replace `SlidersHorizontal` with `Filter, X`:

```tsx
// Old:
import {
  Briefcase,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";

// New:
import {
  Briefcase,
  ChevronRight,
  Filter,
  Search,
  X,
} from "lucide-react";
```

- [ ] **Step 2: Add active filter count derived value**

After the `clearFilters` function (around line 125), add:

```tsx
const activeFilterCount = [inlineStatus, inlineType, inlineBrandId, inlineChronic ? "chronic" : ""].filter(Boolean).length;
```

- [ ] **Step 3: Replace the Filters button**

Find the Filters button (the `<button>` with `SlidersHorizontal`) and the surrounding search row, and replace the button section with:

```tsx
{activeFilterCount > 0 && (
  <button
    type="button"
    onClick={clearFilters}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "8px 12px",
      border: "1px solid #E5E5E5",
      borderRadius: "8px",
      backgroundColor: "#fff",
      color: "#737373",
      fontSize: "13px",
      cursor: "pointer",
      flexShrink: 0,
    }}
  >
    <X size={13} strokeWidth={1.5} />
    Clear
  </button>
)}
<button
  type="button"
  onClick={() => setInlineFiltersOpen((prev) => !prev)}
  style={{
    marginLeft: activeFilterCount > 0 ? "0" : "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    border: "1px solid",
    borderColor: inlineFiltersOpen ? "#0A0A0A" : "#E5E5E5",
    borderRadius: "8px",
    backgroundColor: inlineFiltersOpen ? "#0A0A0A" : "#fff",
    color: inlineFiltersOpen ? "#fff" : "#404040",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 150ms ease",
    flexShrink: 0,
  }}
>
  <Filter size={14} strokeWidth={1.5} />
  Filters
  {activeFilterCount > 0 && (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "16px",
        height: "16px",
        borderRadius: "9999px",
        backgroundColor: inlineFiltersOpen ? "rgba(255,255,255,0.25)" : "#0A0A0A",
        color: "#fff",
        fontSize: "10px",
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {activeFilterCount}
    </span>
  )}
</button>
```

Also add `marginLeft: "auto"` to the search-row container if it doesn't already have it, or ensure the Clear + Filters buttons are pushed right via the outer flex container having `marginLeft: "auto"` on the Filters button when no clear button.

The simplest fix: wrap both buttons in a `<div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>`.

Final search row structure:
```tsx
<div style={{ padding: "0 24px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
  {/* search input */}
  <div style={{ position: "relative", flex: "0 1 480px" }}>
    ...
  </div>
  {/* filter controls — pushed right */}
  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
    {activeFilterCount > 0 && (
      <button type="button" onClick={clearFilters} style={{...}}>
        <X size={13} strokeWidth={1.5} /> Clear
      </button>
    )}
    <button type="button" onClick={() => setInlineFiltersOpen((prev) => !prev)} style={{...}}>
      <Filter size={14} strokeWidth={1.5} /> Filters {/* badge */}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Replace the filter panel with animated version**

Find the filter panel block (currently `{inlineFiltersOpen ? <div ...> : null}`). Replace it with an always-mounted animated wrapper:

```tsx
{/* ── Inline filter panel (always mounted for CSS animation) ─── */}
<div
  style={{
    overflow: "hidden",
    maxHeight: inlineFiltersOpen ? "300px" : "0px",
    opacity: inlineFiltersOpen ? 1 : 0,
    transition: "max-height 300ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
  }}
>
  <div
    style={{
      transform: inlineFiltersOpen ? "translateY(0)" : "translateY(-6px)",
      transition: "transform 300ms cubic-bezier(0.4,0,0.2,1)",
      padding: "0 24px 12px",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        padding: "14px 16px",
        flexWrap: "wrap",
        backgroundColor: "#FAFAFA",
        border: "1px solid #E5E5E5",
        borderRadius: "8px",
      }}
    >
      {/* STATUS */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          STATUS
        </span>
        <select
          value={inlineStatus}
          onChange={(e) => { setInlineStatus(e.target.value); setPage(1); }}
          style={{ border: "1px solid #E5E5E5", borderRadius: "8px", padding: "6px 10px", fontSize: "13px", color: inlineStatus ? "#171717" : "#737373", backgroundColor: "#fff", outline: "none", cursor: "pointer" }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{formatStatusLabel(s)}</option>
          ))}
        </select>
      </div>

      {/* TYPE */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          TYPE
        </span>
        <select
          value={inlineType}
          onChange={(e) => { setInlineType(e.target.value as "" | "installation" | "complaint"); setPage(1); }}
          style={{ border: "1px solid #E5E5E5", borderRadius: "8px", padding: "6px 10px", fontSize: "13px", color: inlineType ? "#171717" : "#737373", backgroundColor: "#fff", outline: "none", cursor: "pointer" }}
        >
          <option value="">All types</option>
          <option value="installation">Installation</option>
          <option value="complaint">Complaint</option>
        </select>
      </div>

      {/* BRAND */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          BRAND
        </span>
        <select
          value={inlineBrandId}
          onChange={(e) => { setInlineBrandId(e.target.value); setPage(1); }}
          style={{ border: "1px solid #E5E5E5", borderRadius: "8px", padding: "6px 10px", fontSize: "13px", color: inlineBrandId ? "#171717" : "#737373", backgroundColor: "#fff", outline: "none", cursor: "pointer" }}
        >
          <option value="">All brands</option>
          {(brandsQuery.data ?? []).map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>
      </div>

      {/* Chronic */}
      <label style={{ display: "flex", flexDirection: "column", gap: "4px", cursor: "pointer" }}>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          FILTER
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#737373", userSelect: "none", paddingTop: "6px" }}>
          <input
            type="checkbox"
            checked={inlineChronic}
            onChange={(e) => { setInlineChronic(e.target.checked); setPage(1); }}
            style={{ width: "14px", height: "14px", cursor: "pointer" }}
          />
          Chronic only
        </span>
      </label>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Update the desktop table**

**5a.** Add `backgroundColor: "#FAFAFA"` to the header `<tr>`:

```tsx
// Old:
<tr style={{ borderBottom: "1px solid #E5E5E5" }}>
// New:
<tr style={{ borderBottom: "1px solid #E5E5E5", backgroundColor: "#FAFAFA" }}>
```

**5b.** Change header `<th>` color from `#737373` to `#94A3B8`:

```tsx
// Old: color: "#737373",
// New: color: "#94A3B8",
```

**5c.** Replace the BRAND `<td>` content:

```tsx
// Old BRAND <td>:
<td style={{ padding: "14px 16px", color: "#525252", fontSize: "13px", whiteSpace: "nowrap" }}>
  {job.brandName ?? "—"}
</td>

// New BRAND <td>:
<td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
  <BrandSwatch name={job.brandName} colorHex={null} />
</td>
```

**5d.** Add row hover to desktop table body rows. Append to each `<tr>` in `<tbody>`:

```tsx
// Old <tr>:
<tr
  key={job.id}
  style={{ borderBottom: "1px solid #F5F5F5", cursor: "pointer" }}
  onClick={() => window.location.assign(`/jobs/${job.id}`)}
>
// New <tr>:
<tr
  key={job.id}
  style={{ borderBottom: "1px solid #F5F5F5", cursor: "pointer" }}
  onClick={() => window.location.assign(`/jobs/${job.id}`)}
  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#FAFAFA"; }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"; }}
>
```

**5e.** Add chronic border to the CUSTOMER `<td>` in the desktop table:

```tsx
// Old CUSTOMER <td>:
<td style={{ padding: "14px 16px", color: "#171717", fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap" }}>
  {job.customerName}
</td>

// New CUSTOMER <td>:
<td
  style={{
    padding: "14px 16px",
    color: "#171717",
    fontSize: "13px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    borderLeft: job.tags.includes("chronic") ? "2px solid #9F1239" : "2px solid transparent",
  }}
>
  {job.customerName}
</td>
```

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/jobs/jobs-list.tsx
git commit -m "feat(jobs-list): animate filter panel, update filter button, brand swatch in table, chronic border on customer cell"
```

---

### Task 5: Shared Primitives — Avatar palette + StatusToggle segmented rewrite

**Files:**
- Modify: `frontend/src/components/ui/avatar.tsx`
- Modify: `frontend/src/components/ui/status-toggle.tsx`

- [ ] **Step 1: Write failing tests for Avatar palette**

Create `frontend/src/components/ui/avatar.test.tsx`:

```tsx
import { render, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  afterEach(() => cleanup());

  it("renders initials from name", () => {
    const { container } = render(<Avatar name="Alice Smith" />);
    expect(container.textContent).toBe("AS");
  });

  it("uses palette[0] (#EDE9FE bg) for names starting with A (charCode 65, 65%5=0)", () => {
    const { container } = render(<Avatar name="Alice" />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.backgroundColor).toBe("rgb(237, 233, 254)"); // #EDE9FE
  });

  it("uses palette[1] (#D1FAE5 bg) for names starting with B (charCode 66, 66%5=1)", () => {
    const { container } = render(<Avatar name="Bob" />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.backgroundColor).toBe("rgb(209, 250, 229)"); // #D1FAE5
  });

  it("uses palette[4] (#DBEAFE bg) for names starting with E (charCode 69, 69%5=4)", () => {
    const { container } = render(<Avatar name="Eve" />);
    const span = container.querySelector("span") as HTMLElement;
    expect(span.style.backgroundColor).toBe("rgb(219, 234, 254)"); // #DBEAFE
  });
});
```

- [ ] **Step 2: Write failing tests for StatusToggle**

Create `frontend/src/components/ui/status-toggle.test.tsx`:

```tsx
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, afterEach } from "vitest";
import { StatusToggle } from "./status-toggle";

describe("StatusToggle (segmented)", () => {
  afterEach(() => cleanup());

  it("renders both Active and Inactive buttons", () => {
    render(<StatusToggle active={true} onToggle={vi.fn()} />);
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("clicking Inactive calls onToggle when currently active", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Inactive"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("clicking Active does NOT call onToggle when already active (no-op)", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Active"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("clicking Active calls onToggle when currently inactive", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Active"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("clicking Inactive does NOT call onToggle when already inactive (no-op)", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Inactive"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does not call onToggle when disabled", () => {
    const onToggle = vi.fn();
    render(<StatusToggle active={true} onToggle={onToggle} disabled={true} />);
    fireEvent.click(screen.getByText("Inactive"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to see failures**

```bash
cd frontend && npm run test:run -- avatar.test status-toggle.test
```

Expected: all tests fail — palette values don't match and StatusToggle doesn't have two buttons.

- [ ] **Step 4: Rewrite `avatar.tsx`**

Replace the entire file:

```tsx
const PALETTE = [
  { bg: '#EDE9FE', color: '#5B21B6' },
  { bg: '#D1FAE5', color: '#065F46' },
  { bg: '#FEF3C7', color: '#92400E' },
  { bg: '#FCE7F3', color: '#9D174D' },
  { bg: '#DBEAFE', color: '#1E40AF' },
];

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0] || '').join('').toUpperCase().slice(0, 2);
}

function avatarColorPair(name: string): { bg: string; color: string } {
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const pair = avatarColorPair(name);
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '9999px',
        backgroundColor: pair.bg,
        color: pair.color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(11, Math.round(size * 0.34))}px`,
        fontWeight: 600,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials(name) || '?'}
    </span>
  );
}
```

- [ ] **Step 5: Rewrite `status-toggle.tsx`**

Replace the entire file:

```tsx
interface StatusToggleProps {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function StatusToggle({ active, onToggle, disabled = false, loading = false }: StatusToggleProps) {
  const isDisabled = disabled || loading;

  function handleActiveClick() {
    if (!active && !isDisabled) onToggle();
  }

  function handleInactiveClick() {
    if (active && !isDisabled) onToggle();
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        backgroundColor: '#EBEBEB',
        borderRadius: '9999px',
        padding: '3px',
        gap: '2px',
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {/* Active side */}
      <button
        type="button"
        onClick={handleActiveClick}
        disabled={isDisabled}
        aria-pressed={active}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '9999px',
          border: 'none',
          backgroundColor: active ? '#ECFDF5' : 'transparent',
          cursor: active || isDisabled ? 'default' : 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          color: active ? '#065F46' : '#A3A3A3',
          transition: 'background-color 180ms, color 180ms',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: active ? '#34D399' : 'transparent',
          }}
        />
        Active
      </button>

      {/* Inactive side */}
      <button
        type="button"
        onClick={handleInactiveClick}
        disabled={isDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '9999px',
          border: 'none',
          backgroundColor: !active ? '#F1F5F9' : 'transparent',
          cursor: !active || isDisabled ? 'default' : 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          color: !active ? '#475569' : '#A3A3A3',
          transition: 'background-color 180ms, color 180ms',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: !active ? '#94A3B8' : 'transparent',
          }}
        />
        Inactive
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd frontend && npm run test:run -- avatar.test status-toggle.test
```

Expected: all 10 tests pass.

- [ ] **Step 7: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ui/avatar.tsx frontend/src/components/ui/avatar.test.tsx frontend/src/components/ui/status-toggle.tsx frontend/src/components/ui/status-toggle.test.tsx
git commit -m "feat(ui): update avatar to solid opaque palette, rewrite status-toggle to segmented two-sided pill"
```

---

### Task 6: Technicians page — card styles + bottom-sheet forms

**Files:**
- Modify: `frontend/src/app/(protected)/technicians/page.tsx`

- [ ] **Step 1: Update imports**

```tsx
// Old:
import { AlertCircle, Plus, Search } from "lucide-react";

// New:
import { AlertCircle, Edit, Plus, Save, Search, X } from "lucide-react";
```

- [ ] **Step 2: Replace the technician card list**

Find the `{filteredTechnicians.map((technician) => (` block and replace the card `<div>` JSX with:

```tsx
{filteredTechnicians.map((technician) => (
  <div
    key={technician.id}
    onClick={() => setSelectedTechnician(technician)}
    style={{
      backgroundColor: '#fff',
      border: '1px solid #E5E5E5',
      borderRadius: '12px',
      padding: isMobile ? '14px 16px' : '18px 20px',
      cursor: 'pointer',
      opacity: technician.isActive ? 1 : 0.6,
      transition: 'box-shadow 140ms, border-color 140ms, opacity 200ms',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
      (e.currentTarget as HTMLElement).style.borderColor = '#D4D4D4';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      (e.currentTarget as HTMLElement).style.borderColor = '#E5E5E5';
    }}
  >
    <Avatar name={technician.name} size={40} />
    <span style={{ fontSize: '15px', fontWeight: 500, color: '#171717', flex: 1, minWidth: 0 }}>
      {technician.name}
    </span>

    {/* Desktop: divider + controls inline */}
    {!isMobile && (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: '1px', height: '32px', backgroundColor: '#E5E5E5', flexShrink: 0 }} />
        <RoleGate allowedRoles={["owner"]}>
          <StatusToggle
            active={technician.isActive}
            onToggle={() => toggleMutation.mutate({ id: technician.id, isActive: !technician.isActive })}
            loading={toggleMutation.isPending}
          />
        </RoleGate>
        <RoleGate allowedRoles={["owner"]}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditTarget(technician); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #E5E5E5',
              backgroundColor: '#FAFAFA',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#525252',
              flexShrink: 0,
            }}
          >
            <Edit size={12} strokeWidth={1.5} /> Edit
          </button>
        </RoleGate>
      </div>
    )}

    {/* Mobile: controls below name — separate row via column flex */}
    {isMobile && (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'flex-end' }}
        onClick={(e) => e.stopPropagation()}
      >
        <RoleGate allowedRoles={["owner"]}>
          <StatusToggle
            active={technician.isActive}
            onToggle={() => toggleMutation.mutate({ id: technician.id, isActive: !technician.isActive })}
            loading={toggleMutation.isPending}
          />
        </RoleGate>
        <RoleGate allowedRoles={["owner"]}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditTarget(technician); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #E5E5E5',
              backgroundColor: '#FAFAFA',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#525252',
              flexShrink: 0,
            }}
          >
            <Edit size={12} strokeWidth={1.5} /> Edit
          </button>
        </RoleGate>
      </div>
    )}
  </div>
))}
```

Note: On mobile the card is column-flex. Adjust the card `<div>` to use `flexWrap: "wrap"` so the second row of controls wraps under the name row:

```tsx
// For mobile, the card should wrap. Update card div style:
style={{
  ...
  flexWrap: isMobile ? 'wrap' : 'nowrap',
}}
```

- [ ] **Step 3: Replace Create Modal with bottom-sheet**

Find `<Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add technician">` and everything inside it, up to the closing `</RoleGate>`. Replace with:

```tsx
<RoleGate allowedRoles={["owner"]}>
  {showCreate && (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 999,
      }}
      onClick={() => setShowCreate(false)}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
          overflow: 'hidden',
          maxHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Add new technician</div>
            <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>New account will be set to Active by default</div>
          </div>
          <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        {/* Body */}
        <form onSubmit={onCreate} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>
          {errorMessage && (
            <div style={{ borderRadius: '8px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: '10px 12px', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={13} strokeWidth={1.5} /> {errorMessage}
            </div>
          )}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>Full name <span style={{ color: '#EF4444' }}>*</span></label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="E.g., Ahmed Al-Rashid" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#171717' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>Email address <span style={{ color: '#EF4444' }}>*</span></label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="ahmed@cooldesk.sa" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#171717' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>Password <span style={{ color: '#EF4444' }}>*</span></label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Min 8 characters" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#171717' }} />
          </div>
          {/* Footer inside form so submit works */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px', borderTop: '1px solid #E5E5E5', marginTop: '6px' }}>
            <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: createMutation.isPending ? 0.6 : 1 }}
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</RoleGate>
```

- [ ] **Step 4: Replace Edit Modal with bottom-sheet**

Find `<Modal isOpen={editTarget !== null} ...>` block and replace with:

```tsx
<RoleGate allowedRoles={["owner"]}>
  {editTarget && (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999 }}
      onClick={() => setEditTarget(null)}
    >
      <div
        style={{ backgroundColor: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '520px', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Edit technician</span>
          <button type="button" onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>
          {errorMessage && (
            <div style={{ borderRadius: '8px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: '10px 12px', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={13} strokeWidth={1.5} /> {errorMessage}
            </div>
          )}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>Full name</label>
            <input value={editTarget.name} readOnly style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', backgroundColor: '#FAFAFA', color: '#737373' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '8px' }}>Status</label>
            <StatusToggle
              active={editTarget.isActive}
              onToggle={() => setEditTarget({ ...editTarget, isActive: !editTarget.isActive })}
            />
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E5E5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={() => setEditTarget(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
          <button
            type="button"
            disabled={editToggleMutation.isPending}
            onClick={() => {
              setMessage(null);
              setErrorMessage(null);
              editToggleMutation.mutate({ id: editTarget.id, isActive: editTarget.isActive });
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: editToggleMutation.isPending ? 0.6 : 1 }}
          >
            <Save size={13} strokeWidth={1.5} /> Save changes
          </button>
        </div>
      </div>
    </div>
  )}
</RoleGate>
```

Also remove the `<Modal>` import from the file (it's no longer needed):

```tsx
// Remove: import { Modal } from "@/components/ui/modal";
```

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/\(protected\)/technicians/page.tsx
git commit -m "feat(technicians): redesign cards with hover/divider/edit button, replace modals with bottom-sheet forms"
```

---

### Task 7: Dealers page — card styles + remove local StatusToggle + bottom-sheet forms

**Files:**
- Modify: `frontend/src/app/(protected)/dealer-management/page.tsx`

- [ ] **Step 1: Update imports**

```tsx
// Add StatusToggle import:
import { StatusToggle } from "@/components/ui/status-toggle";

// Update lucide: remove Pencil, add Edit, X, Save:
// Old: import { AlertCircle, Plus, Search, Eye, Copy, Pencil } from "lucide-react";
// New:
import { AlertCircle, Copy, Edit, Eye, Plus, Save, Search, X } from "lucide-react";

// Remove Modal import:
// Delete: import { Modal } from "@/components/ui/modal";
```

- [ ] **Step 2: Delete the local `SegmentedStatusToggle` function**

Delete lines 15–91 (the entire `function SegmentedStatusToggle(...) { ... }` block).

- [ ] **Step 3: Replace dealer card JSX**

Find the `{filteredDealers.map((dealer) => (` block. Replace the card `<div>` with:

```tsx
{filteredDealers.map((dealer) => (
  <div
    key={dealer.id}
    style={{
      backgroundColor: '#fff',
      border: '1px solid #E5E5E5',
      borderRadius: '12px',
      padding: isMobile ? '14px 16px' : '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      opacity: dealer.isActive ? 1 : 0.6,
      transition: 'box-shadow 140ms, border-color 140ms, opacity 200ms',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
      (e.currentTarget as HTMLElement).style.borderColor = '#D4D4D4';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      (e.currentTarget as HTMLElement).style.borderColor = '#E5E5E5';
    }}
  >
    {/* Clickable area: avatar + name */}
    <div
      role="button"
      tabIndex={0}
      onClick={() => setPanelDealer(dealer)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPanelDealer(dealer); }}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', flex: 1, minWidth: 0 }}
    >
      <Avatar name={dealer.name} size={44} />
      <span style={{ fontSize: '15px', fontWeight: 500, color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {dealer.name}
      </span>
    </div>

    {/* Controls */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
      <div style={{ width: '1px', height: '32px', backgroundColor: '#E5E5E5' }} />
      <RoleGate allowedRoles={["owner"]}>
        <StatusToggle
          active={dealer.isActive}
          onToggle={() => toggleMutation.mutate({ id: dealer.id, isActive: !dealer.isActive })}
          loading={toggleMutation.isPending}
        />
      </RoleGate>
      <RoleGate allowedRoles={["owner"]}>
        <button
          type="button"
          onClick={() => openEditModal(dealer)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid #E5E5E5',
            backgroundColor: '#FAFAFA',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#525252',
            flexShrink: 0,
          }}
        >
          <Edit size={12} strokeWidth={1.5} /> Edit
        </button>
      </RoleGate>
    </div>
  </div>
))}
```

- [ ] **Step 4: Replace Create Modal with bottom-sheet**

Find `<Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add dealer">` and replace with a bottom-sheet. The form fields are identical to the current modal — only the wrapper changes:

```tsx
<RoleGate allowedRoles={["owner"]}>
  {showCreate && (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999 }}
      onClick={() => setShowCreate(false)}
    >
      <div
        style={{ backgroundColor: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '520px', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Add dealer</span>
          <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        {/* Body — all existing form fields go here, wrapped in <form onSubmit={onCreate}> */}
        <form onSubmit={onCreate} style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {errorMessage && (
            <div style={{ borderRadius: '8px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: '10px 12px', color: '#991B1B', fontSize: '13px' }}>
              {errorMessage}
            </div>
          )}
          {/* ── Keep all existing form fields exactly as they are, just relocated here ── */}
          {/* Business name, Contact name, Email, Region, Password, Brand assignment */}
          {/* Copy the <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}> block from the old modal and paste here */}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px', borderTop: '1px solid #E5E5E5', marginTop: '6px' }}>
            <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
            <button type="submit" disabled={createMutation.isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: createMutation.isPending ? 0.6 : 1 }}>
              {createMutation.isPending ? "Saving..." : "Add dealer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</RoleGate>
```

**Important:** The form body inside `<form>` must contain the existing fields verbatim from the current Modal body (`<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>` and its children). Move them, don't rewrite.

- [ ] **Step 5: Replace Edit Modal with bottom-sheet**

Find `<Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit dealer">` and replace with:

```tsx
<RoleGate allowedRoles={["owner"]}>
  {showEdit && (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999 }}
      onClick={() => setShowEdit(false)}
    >
      <div
        style={{ backgroundColor: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '520px', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Edit dealer</span>
          <button type="button" onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        {/* Body */}
        <form onSubmit={onUpdate} style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMessage && (
            <div style={{ borderRadius: '8px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: '10px 12px', color: '#991B1B', fontSize: '13px' }}>
              {errorMessage}
            </div>
          )}
          {/* ── Move all fields from the old Edit modal here (Business name, Contact name, Email, Region, Credentials section) ── */}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px', borderTop: '1px solid #E5E5E5', marginTop: '6px' }}>
            <button type="button" onClick={() => setShowEdit(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: updateMutation.isPending ? 0.6 : 1 }}>
              <Save size={13} strokeWidth={1.5} /> {updateMutation.isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</RoleGate>
```

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

If you see "Property 'isActive' does not exist on type 'DealerDirectoryItem'", check the type in `@/types/operations` — the field might be named differently. Adjust the `dealer.isActive` references to match.

- [ ] **Step 7: Run all tests**

```bash
cd frontend && npm run test:run
```

Expected: all tests pass. The existing `DealerDetailPanel.test.tsx` and `TechnicianDetailPanel.test.tsx` should still pass since we didn't change those components.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/\(protected\)/dealer-management/page.tsx
git commit -m "feat(dealers): redesign cards, replace local StatusToggle with shared component, convert modals to bottom-sheet"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task that implements it |
|---|---|
| Sidebar: remove Notifications nav, update labels | Task 1 |
| Sidebar: add footer collapse button (desktop only) | Task 1 |
| Sidebar: visual pixel fixes (font, icon, gap, minHeight, active bg) | Task 1 |
| App Shell: bell opens notification popover (not navigate) | Task 2 |
| App Shell: notification popover with last 4 notifications | Task 2 |
| App Shell: eventType formatting (strip prefix, title-case) | Task 2 |
| App Shell: avatar 32px circle with initials + online dot | Task 2 |
| App Shell: avatar dropdown shows name + role + log out | Task 2 |
| App Shell: mobile header — Zap+CoolDesk left-aligned | Task 2 |
| App Shell: mobile — remove BottomNav, remove paddingBottom | Task 2 |
| KPI card: borderRadius 12px, remove side border, new shadow, 40px value | Task 3 |
| KPI card: sparkline fills container width | Task 3 |
| Dashboard: KPI accent colors updated | Task 3 |
| Dashboard: table header colors + weights + bg | Task 3 |
| Dashboard: table body row padding (no fixed height) | Task 3 |
| Dashboard: toolbar padding (no fixed height) | Task 3 |
| Dashboard: tag logic uses job.tags.includes() | Task 3 |
| Dashboard: chronic border on CUSTOMER td (not tr) | Task 3 |
| Jobs list: filter panel CSS animation | Task 4 |
| Jobs list: filter panel updated styling + labels | Task 4 |
| Jobs list: SlidersHorizontal → Filter icon | Task 4 |
| Jobs list: active filter count badge + Clear button | Task 4 |
| Jobs list: table header background + text color | Task 4 |
| Jobs list: brand column uses BrandSwatch | Task 4 |
| Jobs list: row hover effect | Task 4 |
| Jobs list: chronic border on CUSTOMER td | Task 4 |
| Avatar: solid opaque palette (5 entries, charCodeAt(0) % 5) | Task 5 |
| StatusToggle: segmented two-sided pill, no-op when clicking active side | Task 5 |
| Technicians: card bg #fff, padding 18/20, opacity for inactive, hover | Task 6 |
| Technicians: divider between name and controls | Task 6 |
| Technicians: Edit button with icon, border, bg | Task 6 |
| Technicians: create/edit forms as bottom-sheet | Task 6 |
| Dealers: same card changes as Technicians | Task 7 |
| Dealers: remove local SegmentedStatusToggle | Task 7 |
| Dealers: create/edit modals as bottom-sheet | Task 7 |

### Placeholder scan

Tasks 7 Steps 4 and 5 say "copy existing form fields from old modal" — this is intentional guidance, not a placeholder. The fields are complex (brand checkboxes, credentials with copy/show buttons) and unchanged; moving them avoids duplicating 80+ lines of form JSX in the plan. The implementer reads the old modal body and pastes it inside the new bottom-sheet form body.

### Type consistency

- `StatusToggle` props: `{ active, onToggle, disabled?, loading? }` — unchanged between rewrite (Task 5) and consumers (Tasks 6, 7). ✓
- `Avatar` props: `{ name, size? }` — unchanged. ✓
- `Sidebar` props: `{ collapsed, isSmallScreen, onToggle, onNavigate? }` — unchanged. ✓
- `formatEventType` defined at module level in app-shell.tsx — used only within the same file. ✓
- `activeFilterCount` derived in jobs-list.tsx body — used inline in the same render. ✓
