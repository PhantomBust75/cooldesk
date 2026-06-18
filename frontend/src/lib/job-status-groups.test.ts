import { describe, expect, it } from "vitest";
import { isTerminalStatus, TERMINAL_STATUSES } from "@/lib/job-status-groups";

describe("isTerminalStatus", () => {
  it("returns true for completed", () => {
    expect(isTerminalStatus("completed")).toBe(true);
  });

  it("returns true for resolved", () => {
    expect(isTerminalStatus("resolved")).toBe(true);
  });

  it("returns true for resolved_on_revisit", () => {
    expect(isTerminalStatus("resolved_on_revisit")).toBe(true);
  });

  it("returns true for cancelled", () => {
    expect(isTerminalStatus("cancelled")).toBe(true);
  });

  it("returns false for active statuses", () => {
    expect(isTerminalStatus("assigned")).toBe(false);
    expect(isTerminalStatus("in_process")).toBe(false);
    expect(isTerminalStatus("pending_schedule")).toBe(false);
    expect(isTerminalStatus("scheduled")).toBe(false);
    expect(isTerminalStatus("acknowledged")).toBe(false);
    expect(isTerminalStatus("in_transit")).toBe(false);
    expect(isTerminalStatus("needs_revisit")).toBe(false);
    expect(isTerminalStatus("revisit_scheduled")).toBe(false);
    expect(isTerminalStatus("new")).toBe(false);
  });

  it("TERMINAL_STATUSES contains the four terminal values", () => {
    expect(TERMINAL_STATUSES).toContain("completed");
    expect(TERMINAL_STATUSES).toContain("resolved");
    expect(TERMINAL_STATUSES).toContain("resolved_on_revisit");
    expect(TERMINAL_STATUSES).toContain("cancelled");
    expect(TERMINAL_STATUSES).toHaveLength(4);
  });
});
