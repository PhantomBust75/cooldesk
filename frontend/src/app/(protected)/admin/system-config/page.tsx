"use client";

import { fetchSystemConfig, updateSystemConfig } from "@/lib/api/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Info } from "lucide-react";
import { useState } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

type FieldDef = {
  key: string;
  label: string;
  helperText: string;
  default: number;
};

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Customer complaint rules",
    fields: [
      {
        key: "repeat_complaint_window_days",
        label: "Repeat complaint window (days)",
        helperText: "How many days to look back when checking if a complaint is a repeat.",
        default: 30,
      },
      {
        key: "frequent_complaint_threshold",
        label: "Frequent complaint threshold (count)",
        helperText: "Number of complaints within the window before a customer is marked frequent.",
        default: 3,
      },
      {
        key: "frequent_complaint_window_days",
        label: "Frequent complaint window (days)",
        helperText: "Rolling window (days) used to evaluate the frequent complaint threshold.",
        default: 90,
      },
    ],
  },
  {
    title: "Scheduling & Punctuality",
    fields: [
      {
        key: "punctuality_grace_period_minutes",
        label: "Punctuality grace period (minutes)",
        helperText: "Minutes after scheduled start before a technician is considered late.",
        default: 15,
      },
      {
        key: "standard_job_duration_minutes",
        label: "Standard job duration (minutes)",
        helperText: "Default expected job duration used for scheduling gap calculations.",
        default: 120,
      },
    ],
  },
  {
    title: "SLA & Alerts",
    fields: [
      {
        key: "amber_alert_days",
        label: "Amber alert threshold (days waiting)",
        helperText: "Days a job has been waiting before it receives an amber alert indicator.",
        default: 3,
      },
      {
        key: "no_show_hours",
        label: "No-show window (hours after scheduled)",
        helperText: "Hours after the scheduled start time before a technician is flagged as no-show.",
        default: 2,
      },
      {
        key: "overdue_schedule_days",
        label: "Overdue scheduling threshold (days)",
        helperText: "Days since job creation before the job is marked overdue for scheduling.",
        default: 7,
      },
    ],
  },
];

export default function SystemConfigPage() {
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["system-config"],
    queryFn: fetchSystemConfig,
  });

  const updateMutation = useMutation({
    mutationFn: updateSystemConfig,
    onSuccess: (_data, variables) => {
      setSavedKey(variables.key);
      setErrorKey(null);
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
      setTimeout(() => setSavedKey(null), 2000);
    },
    onError: (_error, variables) => {
      setErrorKey(variables.key);
    },
  });

  function getValue(key: string, defaultValue: number): number {
    const row = configQuery.data?.find((r) => r.key === key);
    return row ? Number(row.value) || defaultValue : defaultValue;
  }

  function saveField(key: string, value: string) {
    updateMutation.mutate({ key, value: value.trim() });
  }

  return (
    <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "900px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 600,
            color: "#0A0A0A",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          System Config
        </h1>
        <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
          Owner-scoped organization behavior settings.
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#FAFAFA",
          border: "1px solid #E5E5E5",
          borderRadius: "8px",
          padding: "10px 14px",
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <Info size={14} strokeWidth={1.5} color="#525252" style={{ flexShrink: 0, marginTop: "1px" }} />
        <p style={{ margin: 0, fontSize: "13px", color: "#525252", lineHeight: 1.5 }}>
          Configuration changes apply only to new evaluations from the save point onward. Existing flags are
          point-in-time snapshots and are not retroactively recalculated.
        </p>
      </div>

      {configQuery.isLoading ? (
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E5E5E5",
            padding: "16px",
            fontSize: "13px",
            color: "#737373",
          }}
        >
          Loading configuration...
        </div>
      ) : null}

      {configQuery.isError ? (
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid #E5E5E5",
            padding: "16px",
            fontSize: "13px",
            color: "#EF4444",
          }}
        >
          Failed to load configuration.
        </div>
      ) : null}

      {SECTIONS.map((section) => (
        <div
          key={section.title}
          style={{
            backgroundColor: "#fff",
            border: "1px solid #E5E5E5",
            borderRadius: "12px",
            overflow: "hidden",
            marginBottom: "20px",
          }}
        >
          <div style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", padding: "12px 20px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>{section.title}</span>
          </div>
          <div style={{ padding: "20px" }}>
              {section.fields.map((field) => (
              <div key={field.key} style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 500,
                    fontSize: "13px",
                    color: "#404040",
                    marginBottom: "4px",
                  }}
                >
                  {field.label}
                </label>
                <div style={{ fontSize: "12px", color: "#737373", marginBottom: "8px" }}>{field.helperText}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="number"
                    defaultValue={getValue(field.key, field.default)}
                    onBlur={(e) => saveField(field.key, e.target.value)}
                    style={{
                      width: "140px",
                      padding: "9px 10px",
                      border: "1px solid #E5E5E5",
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: "#171717",
                      minHeight: "44px",
                    }}
                  />
                  {savedKey === field.key ? (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#10B981",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Check size={12} strokeWidth={2} /> Saved
                    </span>
                  ) : null}
                  {errorKey === field.key ? (
                    <span style={{ fontSize: "12px", color: "#EF4444" }}>Error saving</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
