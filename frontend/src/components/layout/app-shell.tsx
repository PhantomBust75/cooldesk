"use client";

import { fetchUnreadNotificationCount } from "@/lib/api/notifications";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Menu, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { SearchModal } from "./search-modal";

function userInitials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, logout } = useAuth();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isSmallScreen = useMobileBreakpoint();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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

  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const collapsed = isSmallScreen ? !mobileOpen : desktopCollapsed;
  const sidebarWidth = desktopCollapsed ? 56 : 240;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA", color: "#171717" }}>
      {/* Backdrop — mobile sidebar open */}
      {isSmallScreen && mobileOpen ? (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 39,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        />
      ) : null}

      <Sidebar
        collapsed={collapsed}
        isSmallScreen={isSmallScreen}
        onToggle={() => {
          if (isSmallScreen) {
            setMobileOpen((prev) => !prev);
            return;
          }
          setDesktopCollapsed((prev) => !prev);
        }}
        onNavigate={() => {
          if (isSmallScreen) setMobileOpen(false);
        }}
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
        {/* ── Mobile header ─────────────────────────────────── */}
        {isSmallScreen ? (
          <header
            style={{
              height: "56px",
              borderBottom: "1px solid #E5E5E5",
              backgroundColor: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 12px",
              position: "sticky",
              top: 0,
              zIndex: 30,
              gap: "10px",
            }}
          >
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

            <span
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#0A0A0A",
                letterSpacing: "-0.01em",
                flex: 1,
                textAlign: "center",
              }}
            >
              CoolDesk
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => router.push("/notifications")}
                style={{
                  position: "relative",
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
                }}
                aria-label="Open notifications"
              >
                <Bell size={17} strokeWidth={1.5} />
                {unreadCount > 0 ? (
                  <span
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "8px",
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "#EF4444",
                      border: "1.5px solid #fff",
                    }}
                  />
                ) : null}
              </button>

              <div style={{ position: "relative" }} ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    border: "1px solid #E5E5E5",
                    backgroundColor: "#0A0A0A",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="User menu"
                >
                  {userInitials(session?.user.name)}
                </button>

                {userMenuOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      backgroundColor: "#fff",
                      border: "1px solid #E5E5E5",
                      borderRadius: "10px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      zIndex: 100,
                      minWidth: "180px",
                    }}
                  >
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid #E5E5E5" }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                        {session?.user.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "#737373", marginTop: "2px", textTransform: "capitalize" }}>
                        {session?.user.role?.replace("_", " ")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        textAlign: "left",
                        backgroundColor: "transparent",
                        border: "none",
                        fontSize: "13px",
                        color: "#991B1B",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <LogOut size={13} strokeWidth={1.5} />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
        ) : (
          /* ── Desktop header ─────────────────────────────── */
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
            <div />

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              style={{
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                backgroundColor: "#fff",
                height: "34px",
                minWidth: "240px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 10px",
                color: "#737373",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Search size={13} strokeWidth={1.5} />
                Search jobs, customers…
              </span>
              <span
                style={{
                  backgroundColor: "#F5F5F5",
                  borderRadius: "4px",
                  fontSize: "11px",
                  padding: "2px 5px",
                  color: "#737373",
                }}
              >
                ⌘K
              </span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => router.push("/notifications")}
                style={{
                  position: "relative",
                  border: "1px solid #E5E5E5",
                  borderRadius: "8px",
                  width: "34px",
                  height: "34px",
                  backgroundColor: "#fff",
                  color: "#404040",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                aria-label="Open notifications"
              >
                <Bell size={18} strokeWidth={1.5} />
                {unreadCount > 0 ? (
                  <span
                    style={{
                      position: "absolute",
                      right: "7px",
                      top: "7px",
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "#EF4444",
                    }}
                  />
                ) : null}
              </button>

              {session?.user.role !== "technician" ? (
                <Link
                  href="/log-new-job"
                  style={{
                    border: "1px solid #E5E5E5",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    backgroundColor: "#fff",
                    color: "#404040",
                    fontSize: "13px",
                    textDecoration: "none",
                  }}
                >
                  Log new job
                </Link>
              ) : null}

              <div style={{ position: "relative" }} ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  style={{
                    border: "1px solid #E5E5E5",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    backgroundColor: "#fff",
                    color: "#404040",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {session?.user.name || "User"}
                  <ChevronDown size={14} strokeWidth={1.5} />
                </button>

                {userMenuOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      right: 0,
                      backgroundColor: "#fff",
                      border: "1px solid #E5E5E5",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      zIndex: 100,
                      minWidth: "160px",
                    }}
                  >
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #E5E5E5", fontSize: "12px", color: "#737373" }}>
                      Role: <span style={{ fontWeight: 600, color: "#171717" }}>{session?.user.role}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        textAlign: "left",
                        backgroundColor: "transparent",
                        border: "none",
                        fontSize: "13px",
                        color: "#991B1B",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <LogOut size={13} strokeWidth={1.5} />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
        )}

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#FAFAFA",
            padding: 0,
            paddingBottom: isSmallScreen ? "60px" : 0,
          }}
        >
          {children}
        </main>
      </div>

      {isSmallScreen ? <BottomNav unreadCount={unreadCount} /> : null}

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
