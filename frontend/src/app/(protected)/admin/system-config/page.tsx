"use client";

import { fetchSystemConfig, updateSystemConfig } from "@/lib/api/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Save } from "lucide-react";
import { useSnackbar } from "notistack";
import { useEffect, useState } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

// ─── Config key definitions ───────────────────────────────────────────────────

const DEFAULTS: Record<string, number | string> = {
  repeat_complaint_window_days: 30,
  frequent_complaint_threshold: 3,
  frequent_complaint_window_days: 90,
  punctuality_grace_period_minutes: 15,
  standard_job_duration_minutes: 120,
  pending_schedule_amber_days_installation: 3,
  pending_schedule_red_days_installation: 7,
  pending_schedule_amber_days_complaint: 2,
  pending_schedule_red_days_complaint: 5,
  customer_review_mode: "optional",
  cancellation_request_escalation_minutes: 30,
};

type ConfigMap = Record<string, string>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden", marginBottom: "20px" }}>
      <div style={{ padding: "12px 20px", backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5" }}>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>{title}</span>
      </div>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "18px" }}>{children}</div>
    </div>
  );
}

function NumberField({
  label, help, value, onChange, min = 1,
}: {
  label: string; help?: string; value: string; onChange: (v: string) => void; min?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div>
        <label style={{ fontSize: "13px", fontWeight: 500, color: "#404040" }}>
          {label} <span style={{ color: "#EF4444" }}>*</span>
        </label>
        {help && <p style={{ fontSize: "12px", color: "#737373", margin: "3px 0 0" }}>{help}</p>}
      </div>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "9px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", width: "140px", outline: "none", color: "#171717", fontFamily: "inherit", minHeight: "44px" }}
        onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
        onBlur={(e) => (e.target.style.borderColor = "#E5E5E5")}
      />
    </div>
  );
}

function SelectField({
  label, help, value, onChange, options,
}: {
  label: string; help?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div>
        <label style={{ fontSize: "13px", fontWeight: 500, color: "#404040" }}>
          {label} <span style={{ color: "#EF4444" }}>*</span>
        </label>
        {help && <p style={{ fontSize: "12px", color: "#737373", margin: "3px 0 0" }}>{help}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "9px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", width: "220px", outline: "none", color: "#404040", backgroundColor: "#fff", minHeight: "44px" }}
        onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
        onBlur={(e) => (e.target.style.borderColor = "#E5E5E5")}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemConfigPage() {
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();
  const { enqueueSnackbar } = useSnackbar();

  // Local editable state — mirrors server values, seeded from query data
  const [local, setLocal] = useState<ConfigMap>({});
  const [savedFlash, setSavedFlash] = useState(false);

  const configQuery = useQuery({
    queryKey: ["system-config"],
    queryFn: fetchSystemConfig,
  });

  // Seed local state from server data (only once, or when query first resolves)
  useEffect(() => {
    if (!configQuery.data) return;
    const map: ConfigMap = {};
    for (const row of configQuery.data) {
      map[row.key] = row.value;
    }
    setLocal(map);
  }, [configQuery.data]);

  function get(key: string): string {
    if (key in local) return local[key];
    return String(DEFAULTS[key] ?? "");
  }

  function set(key: string, val: string) {
    setLocal((prev) => ({ ...prev, [key]: val }));
  }

  const saveMutation = useMutation({
    mutationFn: async (map: ConfigMap) => {
      await Promise.all(
        Object.entries(map).map(([key, value]) =>
          updateSystemConfig({ key, value })
        )
      );
    },
    onSuccess: () => {
      enqueueSnackbar("Configuration saved", { variant: "success" });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to save configuration.", { variant: "error" });
    },
  });

  function handleSave() {
    saveMutation.mutate(local);
  }

  return (
    <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "900px" }}>
      {/* Title */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: isMobile ? "28px" : "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          System Config
        </h1>
      </div>

      {/* Info banner */}
      <div style={{ backgroundColor: "#FAFAFA", borderRadius: "8px", padding: "10px 14px", marginBottom: "24px", display: "flex", alignItems: "flex-start", gap: "8px", border: "1px solid #E5E5E5" }}>
        <Info size={14} strokeWidth={1.5} color="#525252" style={{ flexShrink: 0, marginTop: "1px" }} />
        <span style={{ fontSize: "13px", color: "#525252" }}>
          Configuration changes apply only to new evaluations from the save point onward. Existing flags are point-in-time snapshots and are not retroactively recalculated.
        </span>
      </div>

      {configQuery.isLoading && (
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", fontSize: "13px", color: "#737373" }}>
          Loading configuration…
        </div>
      )}

      {configQuery.isError && (
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", fontSize: "13px", color: "#EF4444" }}>
          Failed to load configuration.
        </div>
      )}

      {/* 1 — Customer complaint rules */}
      <ConfigSection title="Customer complaint rules">
        <NumberField
          label="Repeat complaint window (days)"
          help="Number of days used to determine if a complaint is a repeat"
          value={get("repeat_complaint_window_days")}
          onChange={(v) => set("repeat_complaint_window_days", v)}
        />
        <NumberField
          label="Frequent complaint threshold (count)"
          help="Number of complaints within the window to flag as frequent"
          value={get("frequent_complaint_threshold")}
          onChange={(v) => set("frequent_complaint_threshold", v)}
        />
        <NumberField
          label="Frequent complaint window (days)"
          help="Rolling window for counting frequent complaints"
          value={get("frequent_complaint_window_days")}
          onChange={(v) => set("frequent_complaint_window_days", v)}
        />
      </ConfigSection>

      {/* 2 — Scheduling & punctuality */}
      <ConfigSection title="Scheduling & punctuality">
        <NumberField
          label="Punctuality grace period (minutes)"
          help="Arrival within this window of scheduled time is considered on-time"
          value={get("punctuality_grace_period_minutes")}
          onChange={(v) => set("punctuality_grace_period_minutes", v)}
          min={0}
        />
        <NumberField
          label="Standard job duration (minutes)"
          help="Used for scheduling conflict detection and batch schedule spacing"
          value={get("standard_job_duration_minutes")}
          onChange={(v) => set("standard_job_duration_minutes", v)}
        />
      </ConfigSection>

      {/* 3 — Pending schedule thresholds */}
      <ConfigSection title="Pending schedule thresholds">
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "200px 1fr 1fr", gap: "12px", alignItems: "center" }}>
          {!isMobile && <div style={{ fontSize: "12px", color: "#737373", fontWeight: 500 }}>Job type</div>}
          <div style={{ fontSize: "12px", color: "#92400E", fontWeight: 500 }}>Amber (days)</div>
          <div style={{ fontSize: "12px", color: "#991B1B", fontWeight: 500 }}>Red (days)</div>
        </div>
        {[
          { label: "Installation", amberKey: "pending_schedule_amber_days_installation", redKey: "pending_schedule_red_days_installation" },
          { label: "Complaint",    amberKey: "pending_schedule_amber_days_complaint",    redKey: "pending_schedule_red_days_complaint" },
        ].map((row) => (
          <div key={row.label}>
            {isMobile && <div style={{ fontSize: "13px", fontWeight: 500, color: "#404040", marginBottom: "8px" }}>{row.label}</div>}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "200px 1fr 1fr", gap: "12px", alignItems: "center" }}>
              {!isMobile && <div style={{ fontSize: "13px", color: "#404040" }}>{row.label}</div>}
              <input
                type="number" min={1}
                value={get(row.amberKey)}
                onChange={(e) => set(row.amberKey, e.target.value)}
                style={{ padding: "8px", border: "1px solid #FDE68A", borderRadius: "6px", fontSize: "13px", width: "80px", outline: "none", minHeight: "44px" }}
                onFocus={(e) => (e.target.style.borderColor = "#D97706")}
                onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
              />
              <input
                type="number" min={1}
                value={get(row.redKey)}
                onChange={(e) => set(row.redKey, e.target.value)}
                style={{ padding: "8px", border: "1px solid #FCA5A5", borderRadius: "6px", fontSize: "13px", width: "80px", outline: "none", minHeight: "44px" }}
                onFocus={(e) => (e.target.style.borderColor = "#EF4444")}
                onBlur={(e) => (e.target.style.borderColor = "#FCA5A5")}
              />
            </div>
          </div>
        ))}
      </ConfigSection>

      {/* 4 — Customer reviews */}
      <ConfigSection title="Customer reviews">
        <SelectField
          label="Customer review mode"
          value={get("customer_review_mode")}
          onChange={(v) => set("customer_review_mode", v)}
          options={[
            { value: "off",       label: "Off" },
            { value: "optional",  label: "Optional" },
            { value: "mandatory", label: "Mandatory" },
          ]}
        />
      </ConfigSection>

      {/* 5 — Cancellation escalation */}
      <ConfigSection title="Cancellation escalation">
        <NumberField
          label="Escalation threshold (minutes)"
          help="Unactioned cancellation requests escalate to a dashboard banner after this many minutes"
          value={get("cancellation_request_escalation_minutes")}
          onChange={(v) => set("cancellation_request_escalation_minutes", v)}
          min={5}
        />
      </ConfigSection>

      {/* Save button */}
      <div style={{ display: "flex", justifyContent: isMobile ? "stretch" : "flex-end", paddingBottom: "24px" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            padding: "12px 24px", borderRadius: "8px", border: "none",
            width: isMobile ? "100%" : "auto",
            backgroundColor: savedFlash ? "#065F46" : "#0A0A0A",
            color: "#fff", fontSize: "13px", fontWeight: 500,
            cursor: saveMutation.isPending ? "not-allowed" : "pointer",
            minHeight: "48px", transition: "background-color 200ms",
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          <Save size={14} strokeWidth={1.5} />
          {saveMutation.isPending ? "Saving…" : savedFlash ? "Saved!" : "Save configuration"}
        </button>
      </div>
    </section>
  );
}
