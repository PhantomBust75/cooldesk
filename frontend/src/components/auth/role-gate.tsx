"use client";

import { useAuth } from "@/contexts/auth-context";
import type { UserRole } from "@/types/auth";

export function RoleGate({
  allowedRoles,
  children,
  fallback,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { session } = useAuth();
  const role = session?.user.role;

  if (!role || !allowedRoles.includes(role)) {
    return (
      fallback ?? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You do not have permission to access this screen.
        </div>
      )
    );
  }

  return <>{children}</>;
}
