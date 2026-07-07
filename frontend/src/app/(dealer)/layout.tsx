"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DealerLayout({ children }: { children: React.ReactNode }) {
  const { isReady, isAuthenticated, session } = useAuth();
  const router = useRouter();

  const isDealer = session?.user.role === "dealer";

  useEffect(() => {
    if (!isReady) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!isDealer) {
      router.replace("/dealer/jobs");
    }
  }, [isReady, isAuthenticated, isDealer, router]);

  if (!isReady) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAFA", color: "#737373", fontSize: "14px" }}>
        Loading session…
      </div>
    );
  }

  if (!isAuthenticated || !isDealer) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
