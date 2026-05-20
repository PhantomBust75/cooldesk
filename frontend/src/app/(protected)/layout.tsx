"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isReady, isAuthenticated, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPlatformAdmin = session?.user.role === "platform_admin";
  const isOnPlatformAdminPage = pathname.startsWith("/platform-admin");

  useEffect(() => {
    if (!isReady) return;

    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
      return;
    }

    if (isPlatformAdmin && !isOnPlatformAdminPage) {
      router.replace("/platform-admin");
    }
  }, [isReady, isAuthenticated, isPlatformAdmin, isOnPlatformAdminPage, router, pathname]);

  if (!isReady) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAFA", color: "#737373", fontSize: "14px" }}>
        Loading session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Block tenant-scoped children from mounting while redirect is pending.
  // Without this, useQuery hooks fire before the useEffect redirect runs.
  if (isPlatformAdmin && !isOnPlatformAdminPage) {
    return null;
  }

  // Platform admin has its own full-page layout — skip AppShell
  if (isPlatformAdmin) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
