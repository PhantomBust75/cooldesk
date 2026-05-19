"use client";

import { ApiError } from "@/lib/api/client";
import { fetchSystemConfig, updateSystemConfig } from "@/lib/api/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Save, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

export default function SystemConfigPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["system-config"],
    queryFn: fetchSystemConfig,
  });

  const updateMutation = useMutation({
    mutationFn: updateSystemConfig,
    onSuccess: () => {
      setMessage("Configuration updated.");
      setErrorMessage(null);
      setSavingKey(null);
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
    },
    onError: (error) => {
      setSavingKey(null);
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to update configuration.");
      }
    },
  });

  const grouped = useMemo(() => {
    const rows = configQuery.data ?? [];
    return {
      scheduling: rows.filter((row) => /schedule|window|grace|undo/i.test(row.key)),
      quality: rows.filter((row) => /complaint|repeat|frequent|review/i.test(row.key)),
      other: rows.filter((row) => !/schedule|window|grace|undo|complaint|repeat|frequent|review/i.test(row.key)),
    };
  }, [configQuery.data]);

  function saveValue(key: string, currentValue: string, nextValue: string) {
    const trimmed = nextValue.trim();
    if (trimmed === currentValue) {
      return;
    }

    setMessage(null);
    setErrorMessage(null);
    setSavingKey(key);
    updateMutation.mutate({ key, value: trimmed });
  }

  return (
    <section style={{ padding: "24px", maxWidth: "980px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>System Config</h1>
        <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>Owner-scoped organization behavior settings.</p>
      </div>

      {message ? <div style={{ borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "12px", color: "#166534", fontSize: "13px", marginBottom: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}><Check size={13} strokeWidth={1.5} /> {message}</div> : null}
      {errorMessage ? <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "13px", marginBottom: "12px" }}>{errorMessage}</div> : null}

      {configQuery.isLoading ? <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", fontSize: "13px", color: "#737373" }}>Loading configuration...</div> : null}
      {configQuery.isError ? <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", fontSize: "13px", color: "#991B1B" }}>Failed to load configuration.</div> : null}

      {([
        { key: "scheduling", title: "Scheduling & timing" },
        { key: "quality", title: "Quality thresholds" },
        { key: "other", title: "Other settings" },
      ] as const).map((section) => {
        const rows = grouped[section.key];
        if (rows.length === 0) {
          return null;
        }

        return (
          <div key={section.key} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden", marginBottom: "14px" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E5E5", fontSize: "13px", fontWeight: 600, color: "#171717", display: "flex", alignItems: "center", gap: "6px" }}>
              <Settings2 size={14} strokeWidth={1.5} /> {section.title}
            </div>
            <div style={{ padding: "10px 12px" }}>
              {rows.map((row) => (
                <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr auto", gap: "10px", alignItems: "center", padding: "8px", borderBottom: "1px solid #F5F5F5" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>{row.key}</div>
                    <div style={{ fontSize: "11px", color: "#A3A3A3" }}>Updated: {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}</div>
                  </div>
                  <input
                    defaultValue={row.value}
                    onBlur={(event) => saveValue(row.key, row.value, event.target.value)}
                    style={{ width: "100%", borderRadius: "8px", border: "1px solid #E5E5E5", padding: "8px 10px", fontSize: "13px", color: "#171717" }}
                  />
                  <span style={{ fontSize: "11px", color: savingKey === row.key ? "#171717" : "#A3A3A3", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Save size={11} strokeWidth={1.5} /> {savingKey === row.key ? "Saving..." : "On blur save"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
