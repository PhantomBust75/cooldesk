"use client";

import type { UserRole } from "@/types/auth";
import {
  BarChart2,
  Bell,
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
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/pending-schedule", label: "Pending Schedule", icon: Clock, roles: ["owner", "office_staff"] },
  { href: "/technicians", label: "Technicians", icon: Users, roles: ["owner", "office_staff"] },
  { href: "/dealer-management", label: "Dealers", icon: Building2, roles: ["owner", "office_staff"] },
  { href: "/analytics", label: "Analytics", icon: BarChart2, roles: ["owner", "office_staff"] },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/payment-methods", label: "Payment Methods", icon: CreditCard, roles: ["owner"] },
  { href: "/admin/brands", label: "Admin", icon: Settings, roles: ["owner"] },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { session } = useAuth();

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) {
      return true;
    }

    const role = session?.user.role;
    if (!role) {
      return false;
    }

    return item.roles.includes(role);
  });

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: collapsed ? "56px" : "240px",
        transition: "width 220ms ease-in-out",
        backgroundColor: "#FAFAFA",
        borderRight: "1px solid #E5E5E5",
        overflow: "hidden",
        zIndex: 40,
      }}
    >
      <div
        style={{
          height: "56px",
          borderBottom: "1px solid #E5E5E5",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: "8px",
        }}
      >
        <Zap size={18} strokeWidth={1.5} color="#0A0A0A" />
        {!collapsed ? (
          <span style={{ fontSize: "15px", color: "#0A0A0A", fontWeight: 500 }}>CoolDesk</span>
        ) : null}
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "10px 8px" }}>
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                borderRadius: "8px",
                padding: collapsed ? "9px 11px" : "9px 12px",
                display: "flex",
                alignItems: "center",
                gap: "9px",
                textDecoration: "none",
                backgroundColor: active ? "#F5F5F5" : "transparent",
                color: active ? "#171717" : "#525252",
                fontSize: "13px",
                fontWeight: active ? 500 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span
                style={{
                  opacity: collapsed ? 0 : 1,
                  width: collapsed ? 0 : "auto",
                  transition: "opacity 140ms ease",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        style={{
          position: "absolute",
          left: "8px",
          bottom: "8px",
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          border: "1px solid #E5E5E5",
          backgroundColor: "#fff",
          color: "#525252",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronRight
          size={16}
          strokeWidth={1.5}
          style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 220ms ease" }}
        />
      </button>
    </aside>
  );
}
