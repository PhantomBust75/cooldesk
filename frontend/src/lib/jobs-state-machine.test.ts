import { describe, expect, it } from "vitest";
import { getAllowedNextStatuses } from "@/lib/jobs-state-machine";

describe("getAllowedNextStatuses", () => {
  it("returns installation forward states", () => {
    const next = getAllowedNextStatuses({ type: "installation", status: "in_process" });
    expect(next).toEqual(["completed", "cancelled"]);
  });

  it("returns complaint revisit branch states", () => {
    const next = getAllowedNextStatuses({ type: "complaint", status: "in_process" });
    expect(next).toEqual(["needs_revisit", "resolved", "cancelled"]);
  });

  it("returns empty list for terminal states", () => {
    const next = getAllowedNextStatuses({ type: "complaint", status: "resolved" });
    expect(next).toEqual([]);
  });
});
