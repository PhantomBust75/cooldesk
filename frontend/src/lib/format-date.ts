/**
 * All timestamps from the API are ISO-8601 UTC instants (Postgres TIMESTAMPTZ).
 * The business operates in Pakistan, so every timestamp is rendered in PKT
 * regardless of the viewer's device timezone.
 */

export const APP_TIME_ZONE = "Asia/Karachi";
export const APP_TIME_ZONE_LABEL = "PKT";

const LOCALE = "en-GB";
const FALLBACK = "—";

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(iso: string | null | undefined, options: Intl.DateTimeFormatOptions, fallback: string): string {
  const date = toDate(iso);
  if (!date) return fallback;
  return date.toLocaleString(LOCALE, { timeZone: APP_TIME_ZONE, ...options });
}

/** "20 Jul 2026" */
export function formatDate(iso: string | null | undefined, fallback = FALLBACK): string {
  return format(iso, { day: "numeric", month: "short", year: "numeric" }, fallback);
}

/** "20 Jul" */
export function formatDayMonth(iso: string | null | undefined, fallback = FALLBACK): string {
  return format(iso, { day: "2-digit", month: "short" }, fallback);
}

/** "20 Jul 2026, 21:40" */
export function formatDateTime(iso: string | null | undefined, fallback = FALLBACK): string {
  return format(
    iso,
    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    fallback,
  );
}

/** "20 Jul, 21:40" — for dense tables where the year is noise */
export function formatShortDateTime(iso: string | null | undefined, fallback = FALLBACK): string {
  return format(
    iso,
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    fallback,
  );
}

/** "Mon, 20 Jul, 21:40" */
export function formatWeekdayDateTime(iso: string | null | undefined, fallback = FALLBACK): string {
  return format(
    iso,
    { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    fallback,
  );
}

/** "20 Jul 2026, 21:40 PKT" — where the zone must be unambiguous to the reader */
export function formatDateTimeWithZone(iso: string | null | undefined, fallback = FALLBACK): string {
  const formatted = formatDateTime(iso, fallback);
  return formatted === fallback ? fallback : `${formatted} ${APP_TIME_ZONE_LABEL}`;
}

/** "July 2026" */
export function formatMonthYear(iso: string | null | undefined, fallback = FALLBACK): string {
  return format(iso, { month: "long", year: "numeric" }, fallback);
}

/**
 * Calendar year/month of an instant *in PKT*, for grouping rows into months.
 * Date.prototype.getMonth() would bucket by the viewer's timezone instead.
 */
export function getZonedYearMonth(iso: string | null | undefined): { year: number; month: number } | null {
  const date = toDate(iso);
  if (!date) return null;
  return zonedYearMonth(date);
}

/**
 * Wall-clock parts of an instant as seen in PKT. Use when you need the calendar
 * date and time a user would read off a clock in Pakistan, not UTC parts.
 */
export function getZonedParts(
  iso: string | null | undefined,
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const date = toDate(iso);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month") - 1,
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Current year/month in PKT — the anchor for "last N months" ranges. */
export function currentZonedYearMonth(): { year: number; month: number } {
  return zonedYearMonth(new Date());
}

function zonedYearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month: month - 1 };
}
