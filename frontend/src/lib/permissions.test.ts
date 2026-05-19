import { describe, expect, it } from "vitest";
import { canAccessRole } from "@/lib/permissions";

describe("canAccessRole", () => {
  it("returns true when current role is in allowed list", () => {
    expect(canAccessRole("owner", ["owner", "office_staff"])).toBe(true);
    expect(canAccessRole("office_staff", ["owner", "office_staff"])).toBe(true);
  });

  it("returns false when current role is not in allowed list", () => {
    expect(canAccessRole("technician", ["owner", "office_staff"])).toBe(false);
    expect(canAccessRole("dealer", ["owner"])).toBe(false);
  });

  it("returns false for null or undefined role", () => {
    expect(canAccessRole(null, ["owner"])).toBe(false);
    expect(canAccessRole(undefined, ["owner"])).toBe(false);
  });

  it("owner has access to all roles that include owner", () => {
    const ownerOnlyRoles: Parameters<typeof canAccessRole>[1] = ["owner"];
    expect(canAccessRole("owner", ownerOnlyRoles)).toBe(true);
  });
});
