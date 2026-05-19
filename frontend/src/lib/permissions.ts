import type { UserRole } from "@/types/auth";

export function canAccessRole(currentRole: UserRole | null | undefined, allowedRoles: UserRole[]): boolean {
  if (!currentRole) {
    return false;
  }

  return allowedRoles.includes(currentRole);
}
