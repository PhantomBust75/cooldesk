"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const pad = (n: number) => String(n).padStart(2, "0");

export type DatePickerProps = {
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Disables dates before this "YYYY-MM-DD" */
  min?: string;
};

/** Date-only calendar picker — for scheduling wheels use DateTimePicker instead. */
export function DatePicker({ value, onChange, placeholder = "Any date", min }: DatePickerProps) {
  const isMobile = useMobileBreakpoint();

  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const minDate = min ? new Date(`${min}T00:00:00`) : null;

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parsed ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState({ top: 0, left: 0 });

  function handleOpen() {
    // Recompute which month to show right as the picker opens (rather than
    // continuously syncing in an effect) — jumps to the selected date if one
    // was set externally (e.g. filters cleared) since this last opened.
    const d = parsed ?? new Date();
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));

    if (!isMobile && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = 310;
      const top =
        window.innerHeight - r.bottom > estimatedHeight
          ? r.bottom + 6
          : Math.max(8, r.top - estimatedHeight - 6);
      setPopPos({ top, left: Math.min(r.left, window.innerWidth - 272) });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, isMobile]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const startOffset = (() => {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1;
  })();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = (d: Date) => d.toDateString() === today.toDateString();
  const isSelected = (d: Date) => Boolean(parsed) && d.toDateString() === parsed!.toDateString();
  const isDisabled = (d: Date) => Boolean(minDate) && d < minDate!;

  function select(d: Date) {
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setOpen(false);
  }

  const displayValue = parsed
    ? parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  const calendarBody = (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          style={navButtonStyle}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F0F0")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <ChevronLeft size={15} strokeWidth={1.5} />
        </button>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#171717", letterSpacing: "-0.01em" }}>
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          style={navButtonStyle}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F0F0")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <ChevronRight size={15} strokeWidth={1.5} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "4px" }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "10px", fontWeight: 600, color: "#B8B8B8", letterSpacing: "0.05em", padding: "2px 0" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {cells.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {d ? (
              <button
                type="button"
                onClick={() => !isDisabled(d) && select(d)}
                style={{
                  width: isMobile ? "40px" : "30px",
                  height: isMobile ? "40px" : "30px",
                  border: "none",
                  borderRadius: "7px",
                  cursor: isDisabled(d) ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontFamily: "inherit",
                  fontWeight: isSelected(d) ? 700 : 400,
                  backgroundColor: isSelected(d) ? "#0A0A0A" : "transparent",
                  color: isSelected(d) ? "#fff" : isDisabled(d) ? "#D4D4D4" : isToday(d) ? "#0A0A0A" : "#404040",
                  outline: isToday(d) && !isSelected(d) ? "1.5px solid #D4D4D4" : "none",
                  outlineOffset: "-1.5px",
                  opacity: isDisabled(d) ? 0.45 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected(d) && !isDisabled(d)) e.currentTarget.style.backgroundColor = "#F0F0F0";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected(d)) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {d.getDate()}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {parsed ? (
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #F0F0F0", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: "11px", color: "#A3A3A3", display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "5px", fontFamily: "inherit" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#404040";
              e.currentTarget.style.backgroundColor = "#F5F5F5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#A3A3A3";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={10} strokeWidth={2} /> Clear date
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 10px",
          height: "34px",
          border: `1px solid ${open ? "#0A0A0A" : "#E5E5E5"}`,
          borderRadius: "8px",
          outline: "none",
          backgroundColor: "#fff",
          color: displayValue ? "#171717" : "#A3A3A3",
          cursor: "pointer",
          fontSize: "13px",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          minWidth: "120px",
          boxSizing: "border-box",
        }}
      >
        <CalendarDays size={13} strokeWidth={1.5} style={{ color: displayValue ? "#525252" : "#C4C4C4", flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{displayValue || placeholder}</span>
        {displayValue ? (
          <span
            role="button"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            style={{ display: "flex", alignItems: "center", color: "#C4C4C4", cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#737373")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#C4C4C4")}
          >
            <X size={11} strokeWidth={2} />
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              {isMobile ? (
                <div
                  onClick={() => setOpen(false)}
                  style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 9998 }}
                />
              ) : null}
              <div
                ref={containerRef}
                style={
                  isMobile
                    ? {
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: "#fff",
                        borderRadius: "20px 20px 0 0",
                        boxShadow: "0 -8px 40px rgba(0,0,0,0.14)",
                        zIndex: 9999,
                        padding: "0 16px 32px",
                        paddingBottom: "env(safe-area-inset-bottom, 32px)",
                      }
                    : {
                        position: "fixed",
                        top: popPos.top,
                        left: popPos.left,
                        width: "256px",
                        backgroundColor: "#fff",
                        border: "1px solid #E8E8E8",
                        borderRadius: "12px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
                        zIndex: 9999,
                        padding: "14px",
                      }
                }
              >
                {isMobile ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
                      <div style={{ width: "36px", height: "4px", backgroundColor: "#E5E5E5", borderRadius: "2px" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 16px" }}>
                      <span style={{ fontSize: "17px", fontWeight: 600, color: "#171717" }}>Select date</span>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "#737373", padding: "4px", lineHeight: 0 }}
                      >
                        <X size={20} strokeWidth={1.5} />
                      </button>
                    </div>
                    {calendarBody}
                  </>
                ) : (
                  calendarBody
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

const navButtonStyle: CSSProperties = {
  border: "none",
  background: "none",
  cursor: "pointer",
  padding: "6px",
  borderRadius: "6px",
  color: "#737373",
  display: "flex",
  alignItems: "center",
};
