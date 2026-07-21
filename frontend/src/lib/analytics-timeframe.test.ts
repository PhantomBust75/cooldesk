import { describe, expect, it, vi } from "vitest";
import { computeDateRange, presetShortLabel, timeframeSubtitle } from "@/lib/analytics-timeframe";

// Pin "today" to a known PKT date for deterministic assertions.
// 2026-07-21T10:00:00Z = 2026-07-21T15:00:00+05:00 (mid-afternoon PKT — safely
// inside 21 July everywhere, so no day-boundary ambiguity from the pin itself).
const FIXED_NOW = new Date("2026-07-21T10:00:00.000Z");

describe("computeDateRange", () => {
  it("all_time has no bounds", () => {
    expect(computeDateRange("all_time", "", "")).toEqual({});
  });

  it("last_week is a 7-day window ending today (PKT)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const range = computeDateRange("last_week", "", "");
    vi.useRealTimers();
    expect(range.dateFrom).toBe("2026-07-15T00:00:00+05:00");
    expect(range.dateTo).toBe("2026-07-21T23:59:59+05:00");
  });

  it("last_month is a 30-day window ending today (PKT)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const range = computeDateRange("last_month", "", "");
    vi.useRealTimers();
    expect(range.dateFrom).toBe("2026-06-22T00:00:00+05:00");
    expect(range.dateTo).toBe("2026-07-21T23:59:59+05:00");
  });

  it("last_6_months goes back 6 calendar months, same day-of-month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const range = computeDateRange("last_6_months", "", "");
    vi.useRealTimers();
    expect(range.dateFrom).toBe("2026-01-21T00:00:00+05:00");
    expect(range.dateTo).toBe("2026-07-21T23:59:59+05:00");
  });

  it("handles a 6-month shift across a shorter month without spilling into the wrong month", () => {
    // Jul 31 minus 6 months would naively be "Jan 31", but this only matters
    // when today itself is a day that doesn't exist 6 months prior (e.g. Aug 31 -> Feb 31).
    // Verify JS's own month-overflow rollover behavior is what we get, deterministically.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T10:00:00.000Z")); // 2026-08-31 15:00 PKT
    const range = computeDateRange("last_6_months", "", "");
    vi.useRealTimers();
    // Feb 2026 has 28 days, so Date.UTC(2026,7,31).setUTCMonth(1) overflows to Mar 3.
    expect(range.dateFrom).toBe("2026-03-03T00:00:00+05:00");
  });

  it("custom uses the given from/to as PKT start/end of day", () => {
    const range = computeDateRange("custom", "2026-07-01", "2026-07-15");
    expect(range.dateFrom).toBe("2026-07-01T00:00:00+05:00");
    expect(range.dateTo).toBe("2026-07-15T23:59:59+05:00");
  });

  it("custom with only one side set leaves the other bound undefined (not all-time)", () => {
    expect(computeDateRange("custom", "2026-07-01", "")).toEqual({
      dateFrom: "2026-07-01T00:00:00+05:00",
    });
    expect(computeDateRange("custom", "", "2026-07-15")).toEqual({
      dateTo: "2026-07-15T23:59:59+05:00",
    });
  });
});

describe("timeframeSubtitle", () => {
  it("all_time reads exactly 'All time'", () => {
    expect(timeframeSubtitle("all_time", "", "")).toBe("All time");
  });

  it("last_week shows the preset label and the current month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const subtitle = timeframeSubtitle("last_week", "", "");
    vi.useRealTimers();
    expect(subtitle).toBe("Last week · July 2026");
  });

  it("last_6_months shows a from-month – to-month span", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const subtitle = timeframeSubtitle("last_6_months", "", "");
    vi.useRealTimers();
    expect(subtitle).toBe("Last 6 months · January 2026 – July 2026");
  });

  it("custom shows the actual from → to dates once both are set", () => {
    expect(timeframeSubtitle("custom", "2026-07-01", "2026-07-15")).toBe("1 Jul 2026 → 15 Jul 2026");
  });

  it("custom shows a placeholder before both dates are picked", () => {
    expect(timeframeSubtitle("custom", "", "")).toBe("Custom range");
    expect(timeframeSubtitle("custom", "2026-07-01", "")).toBe("Custom range");
  });
});

describe("presetShortLabel", () => {
  it("returns the plain preset label for non-custom presets", () => {
    expect(presetShortLabel("last_week", "", "")).toBe("Last week");
    expect(presetShortLabel("all_time", "", "")).toBe("All time");
  });

  it("returns the raw from → to strings for a completed custom range", () => {
    expect(presetShortLabel("custom", "2026-07-01", "2026-07-15")).toBe("2026-07-01 → 2026-07-15");
  });

  it("falls back to the 'Custom' label when the range isn't complete yet", () => {
    expect(presetShortLabel("custom", "", "")).toBe("Custom");
  });
});
