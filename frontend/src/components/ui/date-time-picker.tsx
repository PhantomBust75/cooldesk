"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { APP_TIME_ZONE_LABEL, getZonedParts } from "@/lib/format-date";

/**
 * Date + time picker with iOS-style scroll wheels.
 *
 * Values are emitted as an instant with an explicit Pakistan offset, e.g.
 * "2026-07-22T21:30:00+05:00". A bare "2026-07-22T21:30" would be read by
 * Postgres in the session timezone (GMT) and land 5 hours late, so the offset
 * is not optional. Pakistan does not observe DST, so +05:00 is a constant.
 */
const PKT_OFFSET = "+05:00";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const HOUR_VALUES = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_VALUES = Array.from({ length: 12 }, (_, i) => i * 5);
const MERIDIEM_VALUES = ["AM", "PM"];

const ITEM_HEIGHT = 38;
const VISIBLE_ROWS = 3;
const POPOVER_WIDTH = 320;
// Rough content height (month header + weekday row + day grid + wheels + footer)
// used to decide whether to flip the popover above the trigger before it has
// actually rendered — refined against the real measured height right after.
const ESTIMATED_POPOVER_HEIGHT = 500;

type DateParts = { year: number; month: number; day: number };

export type DateTimePickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Weekday index of the 1st, shifted so Monday is 0. */
function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function toIso(
  date: DateParts,
  hour12: number,
  minute: number,
  meridiem: string,
): string {
  const hour24 =
    meridiem === "AM"
      ? hour12 === 12
        ? 0
        : hour12
      : hour12 === 12
        ? 12
        : hour12 + 12;
  return `${date.year}-${pad(date.month + 1)}-${pad(date.day)}T${pad(hour24)}:${pad(minute)}:00${PKT_OFFSET}`;
}

function formatTrigger(
  date: DateParts,
  hour12: number,
  minute: number,
  meridiem: string,
): string {
  const shown = new Date(date.year, date.month, date.day);
  const weekday = shown.toLocaleDateString("en-GB", { weekday: "short" });
  const month = shown.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday}, ${date.day} ${month} ${date.year}, ${hour12}:${pad(minute)} ${meridiem} ${APP_TIME_ZONE_LABEL}`;
}

/** Nearest allowed minute, so an existing 9:47 doesn't silently become 9:45 without snapping. */
function snapMinute(minute: number): number {
  return MINUTE_VALUES.reduce((best, m) =>
    Math.abs(m - minute) < Math.abs(best - minute) ? m : best,
  );
}

// ─── Scroll wheel ─────────────────────────────────────────────────────────────

function Wheel<T>({
  label,
  values,
  selected,
  onSelect,
  render,
}: {
  label: string;
  values: T[];
  selected: T;
  onSelect: (value: T) => void;
  render: (value: T) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserScrolling = useRef(false);
  const selectedIndex = values.indexOf(selected);

  // Keep the wheel parked on the selected value when it changes from outside.
  useEffect(() => {
    const node = ref.current;
    if (!node || isUserScrolling.current || selectedIndex < 0) return;
    node.scrollTop = selectedIndex * ITEM_HEIGHT;
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    isUserScrolling.current = true;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const index = Math.max(
        0,
        Math.min(values.length - 1, Math.round(node.scrollTop / ITEM_HEIGHT)),
      );
      isUserScrolling.current = false;
      if (values[index] !== selected) onSelect(values[index]);
    }, 120);
  }, [onSelect, selected, values]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  function step(delta: number) {
    const next = Math.max(
      0,
      Math.min(values.length - 1, selectedIndex + delta),
    );
    onSelect(values[next]);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        flex: 1,
      }}
    >
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#A3A3A3",
        }}
      >
        {label}
      </span>
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            step(-1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            step(1);
          }
        }}
        className="cd-wheel"
        style={{
          height: `${ITEM_HEIGHT * VISIBLE_ROWS}px`,
          width: "100%",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          boxSizing: "border-box",
          outline: "none",
        }}
      >
        {/* Spacers (not padding) so the viewport stays exactly 3 rows tall
            while the first and last values can still reach the centre row. */}
        <div style={{ height: `${ITEM_HEIGHT}px` }} />
        {values.map((value) => {
          const isSelected = value === selected;
          return (
            <div
              key={String(value)}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(value)}
              style={{
                height: `${ITEM_HEIGHT}px`,
                scrollSnapAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                borderRadius: "12px",
                backgroundColor: isSelected ? "#F5F5F5" : "transparent",
                color: isSelected ? "#171717" : "#D4D4D4",
                fontSize: isSelected ? "18px" : "16px",
                fontWeight: isSelected ? 700 : 500,
                fontVariantNumeric: "tabular-nums",
                transition: "color 120ms, background-color 120ms",
              }}
            >
              {render(value)}
            </div>
          );
        })}
        <div style={{ height: `${ITEM_HEIGHT}px` }} />
      </div>
    </div>
  );
}

// ─── Picker ───────────────────────────────────────────────────────────────────

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  id,
  disabled,
}: DateTimePickerProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(
    null,
  );

  const parsed = useMemo(() => getZonedParts(value), [value]);
  const today = useMemo(() => getZonedParts(new Date().toISOString()), []);

  const [viewYear, setViewYear] = useState(parsed?.year ?? today?.year ?? 2026);
  const [viewMonth, setViewMonth] = useState(
    parsed?.month ?? today?.month ?? 0,
  );
  const [selectedDate, setSelectedDate] = useState<DateParts | null>(
    parsed ? { year: parsed.year, month: parsed.month, day: parsed.day } : null,
  );
  const [hour, setHour] = useState<number>(() => {
    if (!parsed) return 9;
    const h = parsed.hour % 12;
    return h === 0 ? 12 : h;
  });
  const [minute, setMinute] = useState<number>(
    parsed ? snapMinute(parsed.minute) : 0,
  );
  const [meridiem, setMeridiem] = useState<string>(
    parsed && parsed.hour >= 12 ? "PM" : "AM",
  );

  useEffect(() => {
    if (!open) return;
    const trigger = wrapperRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const spaceBelow = window.innerHeight - trigger.bottom;
    const spaceAbove = trigger.top;
    const openAbove =
      spaceBelow < ESTIMATED_POPOVER_HEIGHT + 12 && spaceAbove > spaceBelow;
    const left = Math.max(
      8,
      Math.min(trigger.left, window.innerWidth - POPOVER_WIDTH - 16),
    );
    setPopPos({
      top: openAbove
        ? Math.max(8, trigger.top - ESTIMATED_POPOVER_HEIGHT - 6)
        : trigger.bottom + 6,
      left,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trigger = wrapperRef.current?.getBoundingClientRect();
    const popover = popoverRef.current?.getBoundingClientRect();
    if (!trigger || !popover) return;
    const spaceBelow = window.innerHeight - trigger.bottom;
    const spaceAbove = trigger.top;
    const openAbove =
      spaceBelow < popover.height + 12 && spaceAbove > spaceBelow;
    const top = openAbove
      ? Math.max(8, trigger.top - popover.height - 6)
      : trigger.bottom + 6;
    setPopPos((current) =>
      current && current.top === top ? current : { ...current!, top },
    );
  }, [open, viewMonth, viewYear]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const triggerLabel = parsed
    ? formatTrigger(
        { year: parsed.year, month: parsed.month, day: parsed.day },
        parsed.hour % 12 === 0 ? 12 : parsed.hour % 12,
        parsed.minute,
        parsed.hour >= 12 ? "PM" : "AM",
      )
    : placeholder;

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function confirm() {
    if (!selectedDate) return;
    onChange(toIso(selectedDate, hour, minute, meridiem));
    setOpen(false);
  }

  const blanks = leadingBlanks(viewYear, viewMonth);
  const total = daysInMonth(viewYear, viewMonth);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <style>{`.cd-wheel{scrollbar-width:none;-ms-overflow-style:none}.cd-wheel::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion: reduce){.cd-wheel{scroll-behavior:auto}}`}</style>

      <button
        type="button"
        id={fieldId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid #E5E5E5",
          borderRadius: "8px",
          fontSize: "13px",
          color: parsed ? "#171717" : "#A3A3A3",
          backgroundColor: disabled ? "#FAFAFA" : "#fff",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          boxSizing: "border-box",
        }}
      >
        <span>{triggerLabel}</span>
        <Calendar size={15} strokeWidth={1.5} color="#A3A3A3" />
      </button>

      {open && popPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Choose date and time"
              style={{
                position: "fixed",
                top: popPos.top,
                left: popPos.left,
                zIndex: 1000,
                width: `${POPOVER_WIDTH}px`,
                maxWidth: "calc(100vw - 32px)",
                maxHeight: "calc(100vh - 24px)",
                overflowY: "auto",
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "1px solid #E5E5E5",
                boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
                padding: "14px",
                boxSizing: "border-box",
              }}
            >
              {/* Month header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  style={navButtonStyle}
                >
                  <ChevronLeft size={18} strokeWidth={1.5} />
                </button>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#171717",
                  }}
                >
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  style={navButtonStyle}
                >
                  <ChevronRight size={18} strokeWidth={1.5} />
                </button>
              </div>

              {/* Weekday labels */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  marginBottom: "4px",
                }}
              >
                {WEEKDAY_LABELS.map((day) => (
                  <span
                    key={day}
                    style={{
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#A3A3A3",
                      padding: "4px 0",
                    }}
                  >
                    {day}
                  </span>
                ))}
              </div>

              {/* Day grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "2px",
                }}
              >
                {Array.from({ length: blanks }, (_, i) => (
                  <span key={`blank-${i}`} />
                ))}
                {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
                  const isSelected =
                    selectedDate?.year === viewYear &&
                    selectedDate?.month === viewMonth &&
                    selectedDate?.day === day;
                  const isToday =
                    today?.year === viewYear &&
                    today?.month === viewMonth &&
                    today?.day === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setSelectedDate({
                          year: viewYear,
                          month: viewMonth,
                          day,
                        })
                      }
                      aria-pressed={isSelected}
                      style={{
                        height: "32px",
                        borderRadius: "9px",
                        fontSize: "13px",
                        cursor: "pointer",
                        fontVariantNumeric: "tabular-nums",
                        backgroundColor: isSelected ? "#171717" : "transparent",
                        color: isSelected ? "#fff" : "#171717",
                        fontWeight: isSelected ? 600 : 400,
                        // Today reads as a ring so it stays visible once another day is filled.
                        border:
                          !isSelected && isToday
                            ? "1px solid #D4D4D4"
                            : "1px solid transparent",
                        transition: "background-color 120ms, color 120ms",
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  height: "1px",
                  backgroundColor: "#F0F0F0",
                  margin: "12px 0 2px",
                }}
              />

              {/* Time wheels */}
              <div
                style={{ display: "flex", alignItems: "flex-end", gap: "4px" }}
              >
                <Wheel
                  label="Hour"
                  values={HOUR_VALUES}
                  selected={hour}
                  onSelect={setHour}
                  render={(h) => String(h)}
                />
                <span
                  style={{
                    paddingBottom: `${ITEM_HEIGHT + 6}px`,
                    color: "#D4D4D4",
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  :
                </span>
                <Wheel
                  label="Min"
                  values={MINUTE_VALUES}
                  selected={minute}
                  onSelect={setMinute}
                  render={(m) => pad(m)}
                />
                <Wheel
                  label="AM/PM"
                  values={MERIDIEM_VALUES}
                  selected={meridiem}
                  onSelect={setMeridiem}
                  render={(m) => m}
                />
              </div>

              <div
                style={{
                  height: "1px",
                  backgroundColor: "#F0F0F0",
                  margin: "2px 0 12px",
                }}
              />

              {/* Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#A3A3A3" }}>
                  {selectedDate
                    ? formatTrigger(selectedDate, hour, minute, meridiem)
                    : "Select a date first"}
                </span>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  {value ? (
                    <button
                      type="button"
                      onClick={() => {
                        onChange(null);
                        setSelectedDate(null);
                        setOpen(false);
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #E5E5E5",
                        backgroundColor: "#fff",
                        color: "#525252",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={!selectedDate}
                    style={{
                      padding: "10px 22px",
                      borderRadius: "10px",
                      border: "none",
                      backgroundColor: selectedDate ? "#171717" : "#F5F5F5",
                      color: selectedDate ? "#fff" : "#A3A3A3",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: selectedDate ? "pointer" : "not-allowed",
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const navButtonStyle: CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "transparent",
  color: "#525252",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
