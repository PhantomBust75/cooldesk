import { formatDate, formatMonthYear, getZonedParts } from "@/lib/format-date";

export type Preset = "last_week" | "last_month" | "last_6_months" | "all_time" | "custom";

export const PRESETS: { key: Preset; label: string }[] = [
  { key: "last_week", label: "Last week" },
  { key: "last_month", label: "Last month" },
  { key: "last_6_months", label: "Last 6 months" },
  { key: "all_time", label: "All time" },
  { key: "custom", label: "Custom" },
];

type YMD = { year: number; month: number; day: number };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Today's calendar date in PKT, regardless of the viewer's device timezone. */
function pktToday(): YMD {
  const parts = getZonedParts(new Date().toISOString());
  return parts ? { year: parts.year, month: parts.month, day: parts.day } : { year: 1970, month: 0, day: 1 };
}

/** Shifts a PKT calendar date by whole days and/or months, via UTC-safe arithmetic
 * (Pakistan has no DST, so this can't drift — but going through the browser's
 * local Date methods directly risks picking up the *device's* timezone instead). */
function shiftDate(base: YMD, deltaDays: number, deltaMonths: number): YMD {
  const d = new Date(Date.UTC(base.year, base.month, base.day));
  if (deltaMonths) d.setUTCMonth(d.getUTCMonth() + deltaMonths);
  if (deltaDays) d.setUTCDate(d.getUTCDate() + deltaDays);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

function startOfDayIso(date: YMD): string {
  return `${date.year}-${pad(date.month + 1)}-${pad(date.day)}T00:00:00+05:00`;
}

function endOfDayIso(date: YMD): string {
  return `${date.year}-${pad(date.month + 1)}-${pad(date.day)}T23:59:59+05:00`;
}

/** "YYYY-MM-DD" (as produced by <input type="date">) → start/end-of-day PKT ISO. */
function inputDateToStartOfDayIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return startOfDayIso({ year, month: month - 1, day });
}

function inputDateToEndOfDayIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return endOfDayIso({ year, month: month - 1, day });
}

export type DateRange = { dateFrom?: string; dateTo?: string };

/** Turns a preset (plus custom bounds, when relevant) into concrete PKT-bounded ISO instants. */
export function computeDateRange(preset: Preset, customFrom: string, customTo: string): DateRange {
  const today = pktToday();

  switch (preset) {
    case "last_week":
      return { dateFrom: startOfDayIso(shiftDate(today, -6, 0)), dateTo: endOfDayIso(today) };
    case "last_month":
      return { dateFrom: startOfDayIso(shiftDate(today, -29, 0)), dateTo: endOfDayIso(today) };
    case "last_6_months":
      return { dateFrom: startOfDayIso(shiftDate(today, 0, -6)), dateTo: endOfDayIso(today) };
    case "all_time":
      return {};
    case "custom":
      return {
        dateFrom: customFrom ? inputDateToStartOfDayIso(customFrom) : undefined,
        dateTo: customTo ? inputDateToEndOfDayIso(customTo) : undefined,
      };
  }
}

/** Human-readable subtitle under the page title, mirroring the reference's format. */
export function timeframeSubtitle(preset: Preset, customFrom: string, customTo: string): string {
  if (preset === "custom") {
    if (!customFrom || !customTo) return "Custom range";
    return `${formatDate(inputDateToStartOfDayIso(customFrom))} → ${formatDate(inputDateToEndOfDayIso(customTo))}`;
  }
  if (preset === "all_time") return "All time";

  const { dateFrom, dateTo } = computeDateRange(preset, customFrom, customTo);
  const presetLabel = PRESETS.find((p) => p.key === preset)?.label ?? "";
  if (preset === "last_6_months") {
    return `${presetLabel} · ${formatMonthYear(dateFrom)} – ${formatMonthYear(dateTo)}`;
  }
  return `${presetLabel} · ${formatMonthYear(dateTo)}`;
}

/** Short label for the trigger button and CSV filenames. */
export function presetShortLabel(preset: Preset, customFrom: string, customTo: string): string {
  if (preset === "custom" && customFrom && customTo) {
    return `${customFrom} → ${customTo}`;
  }
  return PRESETS.find((p) => p.key === preset)?.label ?? "";
}
