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
