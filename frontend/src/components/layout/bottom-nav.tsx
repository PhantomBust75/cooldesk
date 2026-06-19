"use client";

import { useAuth } from "@/contexts/auth-context";
import type { UserRole } from "@/types/auth";
import { Bell, Briefcase, Clock, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type BottomNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  roles?: UserRole[];
};

const BOTTOM_ITEMS: BottomNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["owner", "office_staff", "dealer"],
  },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/jobs/history", label: "History", icon: Clock, roles: ["technician"] },
  {
    href: "/pending-schedule",
    label: "Schedule",
    icon: Clock,
    roles: ["owner", "office_staff"],
  },
  { href: "/notifications", label: "Alerts", icon: Bell },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const role = session?.user.role;

  const items = BOTTOM_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (!role) return false;
    return item.roles.includes(role as UserRole);
  });

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTop: "1px solid #E5E5E5",
        display: "flex",
        zIndex: 50,
        height: "60px",
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);
        const isNotif = item.href === "/notifications";

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              textDecoration: "none",
              color: active ? "#0A0A0A" : "#A3A3A3",
              position: "relative",
              borderTop: `2px solid ${active ? "#0A0A0A" : "transparent"}`,
            }}
          >
            <div style={{ position: "relative" }}>
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              {isNotif && unreadCount > 0 ? (
                <span
                  style={{
                    position: "absolute",
                    top: "-3px",
                    right: "-5px",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#EF4444",
                    border: "1.5px solid #fff",
                  }}
                />
              ) : null}
            </div>
            <span style={{ fontSize: "10px", fontWeight: active ? 600 : 400, lineHeight: 1 }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
