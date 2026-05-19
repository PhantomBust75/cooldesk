"use client";

import { RoleGate } from "@/components/auth/role-gate";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <RoleGate allowedRoles={["owner"]}>
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#FAFAFA" }}>
        <aside
          style={{
            width: "200px",
            borderRight: "1px solid #E5E5E5",
            backgroundColor: "#fff",
            padding: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 600, color: "#171717" }}>Admin</h3>
          <nav style={{ display: "grid", gap: "8px" }}>
            {[
              { href: "/admin/brands", label: "Brands" },
              { href: "/admin/system-config", label: "System Config" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  textDecoration: "none",
                  color: pathname === item.href ? "#0A0A0A" : "#737373",
                  backgroundColor: pathname === item.href ? "#F5F5F5" : "transparent",
                  fontWeight: pathname === item.href ? 500 : 400,
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
      </div>
    </RoleGate>
  );
}
