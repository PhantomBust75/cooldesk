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
  const notifRef = useRef<HTMLDivElement | null>(null);
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

  // Close user menu on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [userMenuOpen]);

  const audience = useMemo(() => {
    return session?.user.role === "dealer" ? "dealer" : "user";
  }, [session?.user.role]);

  const isPlatformAdmin = session?.user.role === "platform_admin";
  const isTechnician = session?.user.role === "technician";
  const isDealer = session?.user.role === "dealer";

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
            {!notif.isRead ? (
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#2563EB",
                  marginTop: "5px",
                  flexShrink: 0,
                  display: "block",
                }}
              />
            ) : (
              <span style={{ width: "6px", flexShrink: 0 }} />
            )}
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
              {session?.user.role !== "technician" && !isDealer && (
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
              {/* Bell button — hidden for technicians */}
              {!isTechnician && (
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
              )}
              {/* Avatar button */}
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
            {/* Search bar — hidden for technicians and dealers */}
            {!isTechnician && !isDealer && (
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
            )}

            {/* Right: log-new-job + divider + bell + avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
              {session?.user.role !== "technician" && !isDealer && (
                <>
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
                  <div style={{ width: "1px", height: "20px", backgroundColor: "#E5E5E5" }} />
                </>
              )}
              {/* Bell button — hidden for technicians */}
              {!isTechnician && (
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
              )}
              {/* Avatar button */}
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
