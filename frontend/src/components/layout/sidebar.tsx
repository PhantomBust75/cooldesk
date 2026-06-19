"use client";

import type { UserRole } from "@/types/auth";
import {
  BarChart2,
  Bell,
  Briefcase,
  Clock,
  CreditCard,
  LayoutDashboard,
  Menu,
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
  { href: "/jobs/history", label: "History", icon: Clock, roles: ["technician"] },
  { href: "/pending-schedule", label: "Schedule & Assign", icon: Clock, roles: ["owner", "office_staff"] },
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
        width: isSmallScreen ? "280px" : (collapsed ? "56px" : "240px"),
        transition: isSmallScreen
          ? "transform 220ms ease-in-out"
          : "width 220ms ease-in-out",
        transform: isSmallScreen
          ? (mobileHidden ? "translateX(-100%)" : "translateX(0)")
          : undefined,
        backgroundColor: "#FAFAFA",
        borderRight: "1px solid #E5E5E5",
        boxShadow: isSmallScreen && !mobileHidden ? "4px 0 24px rgba(0,0,0,0.12)" : undefined,
        overflow: "hidden",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
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
          flexShrink: 0,
        }}
      >
        <Zap size={18} strokeWidth={1.5} color="#0A0A0A" />
        <span style={{ fontSize: "15px", color: "#0A0A0A", fontWeight: 500 }}>CoolDesk</span>
        <button
          type="button"
          onClick={onToggle}
          style={{
            marginLeft: "auto",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: "1px solid #E5E5E5",
            backgroundColor: "#fff",
            color: "#525252",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label="Collapse sidebar"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "10px 8px", overflowY: "auto", flex: 1 }}>
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
                gap: "10px",
                textDecoration: "none",
                backgroundColor: active ? "#F0F0F0" : "transparent",
                color: active ? "#0A0A0A" : "#525252",
                fontSize: "13px",
                fontWeight: active ? 500 : 400,
                whiteSpace: "nowrap",
                minHeight: "40px",
              }}
            >
              <span style={{ flexShrink: 0, display: "inline-flex" }}><Icon size={17} strokeWidth={1.6} /></span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
