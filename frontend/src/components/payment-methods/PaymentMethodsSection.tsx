"use client";

import { ApiError } from "@/lib/api/client";
import {
  createPaymentMethod,
  deletePaymentMethod,
  fetchPaymentMethods,
  togglePaymentMethod,
  updatePaymentMethodName,
} from "@/lib/api/operations";
import type { PaymentMethodItem } from "@/types/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Pencil, Plus, X } from "lucide-react";
import { useSnackbar } from "notistack";
import { FormEvent, useState } from "react";

// ─── Modal ────────────────────────────────────────────────────────────────────

type ModalProps = {
  item?: PaymentMethodItem | null;
  onClose: () => void;
};

function PaymentMethodModal({ item, onClose }: ModalProps) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => createPaymentMethod({ name: name.trim() }),
    onSuccess: () => {
      enqueueSnackbar("Payment method added", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      onClose();
    },
    onError: (e) => {
      enqueueSnackbar(e instanceof ApiError ? e.message : "Failed to add.", { variant: "error" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: () => updatePaymentMethodName(item!.id, name.trim()),
    onSuccess: () => {
      enqueueSnackbar("Payment method updated", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      onClose();
    },
    onError: (e) => {
      enqueueSnackbar(e instanceof ApiError ? e.message : "Failed to update.", { variant: "error" });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    if (isEdit) renameMutation.mutate();
    else createMutation.mutate();
  }

  const isPending = createMutation.isPending || renameMutation.isPending;
  const isValid = name.trim().length > 0;

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px", boxShadow: "0 10px 40px rgba(0,0,0,0.14)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E5E5E5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "17px", fontWeight: 600, color: "#0A0A0A" }}>
            {isEdit ? "Edit payment method" : "Add payment method"}
          </span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", lineHeight: 0, padding: "4px" }}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit}>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#404040", marginBottom: "6px" }}>
                Method name <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cash, Bank Transfer, Easypaisa"
                autoFocus
                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: "1px solid #E5E5E5", borderRadius: "10px", fontSize: "14px", color: "#171717", outline: "none", fontFamily: "inherit" }}
                onFocus={(e) => (e.target.style.borderColor = "#A3A3A3")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E5E5")}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingTop: "4px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "10px 18px", borderRadius: "9px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !isValid}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "10px 18px", borderRadius: "9px", border: "none",
                  backgroundColor: isPending || !isValid ? "#E5E5E5" : "#0A0A0A",
                  color: isPending || !isValid ? "#A3A3A3" : "#fff",
                  fontSize: "13px", fontWeight: 500,
                  cursor: isPending || !isValid ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Saving…" : isEdit ? "Save changes" : "Add method"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function PaymentMethodsSection() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  // undefined = closed, null = adding new, PaymentMethodItem = editing
  const [modal, setModal] = useState<PaymentMethodItem | null | undefined>(undefined);

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => togglePaymentMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to update status.", { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: () => {
      enqueueSnackbar("Payment method deleted", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to delete payment method.", { variant: "error" });
    },
  });

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden", marginBottom: "24px" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: 0 }}>
          <div style={{ color: "#525252", lineHeight: 0, marginTop: "2px", flexShrink: 0 }}>
            <CreditCard size={16} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>Payment Methods</div>
            <div style={{ fontSize: "12px", color: "#737373", marginTop: "1px" }}>
              Options shown to technicians when collecting payment
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModal(null)}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <Plus size={13} strokeWidth={1.5} /> Add
        </button>
      </div>

      {/* Table */}
      {methodsQuery.isLoading && (
        <div style={{ padding: "20px", fontSize: "13px", color: "#737373" }}>Loading…</div>
      )}
      {methodsQuery.isError && (
        <div style={{ padding: "20px", fontSize: "13px", color: "#EF4444" }}>Failed to load payment methods.</div>
      )}
      {methodsQuery.data && methodsQuery.data.length === 0 && (
        <div style={{ padding: "24px", fontSize: "13px", color: "#737373", textAlign: "center" }}>
          No payment methods yet. Add your first method.
        </div>
      )}
      {methodsQuery.data && methodsQuery.data.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
              {["Method", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 16px",
                    textAlign: h === "Actions" ? "right" : "left",
                    fontSize: "11px", fontWeight: 500, color: "#A3A3A3",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {methodsQuery.data.map((method) => (
              <tr
                key={method.id}
                style={{ borderBottom: "1px solid #F5F5F5", opacity: method.isActive ? 1 : 0.55 }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
              >
                <td style={{ padding: "13px 16px", fontSize: "14px", fontWeight: 500, color: "#171717" }}>
                  {method.name}
                </td>
                <td style={{ padding: "13px 16px" }}>
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate(method.id)}
                    title={method.isActive ? "Click to deactivate" : "Click to activate"}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      padding: "4px 10px", borderRadius: "9999px", border: "none",
                      fontSize: "12px", fontWeight: 500, cursor: "pointer",
                      backgroundColor: method.isActive ? "#D1FAE5" : "#F5F5F5",
                      color: method.isActive ? "#065F46" : "#525252",
                    }}
                  >
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: method.isActive ? "#10B981" : "#A3A3A3", flexShrink: 0 }} />
                    {method.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td style={{ padding: "13px 16px", textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setModal(method)}
                      title="Edit"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "7px", border: "none", cursor: "pointer", backgroundColor: "#FAFAFA", color: "#525252" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F0F0")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(method.id)}
                      title="Delete"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "7px", border: "none", cursor: "pointer", backgroundColor: "#FFF5F5", color: "#EF4444" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FEE2E2")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFF5F5")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Footer note */}
      <div style={{ padding: "10px 16px", backgroundColor: "#FAFAFA", borderTop: "1px solid #F5F5F5" }}>
        <p style={{ fontSize: "12px", color: "#737373", margin: 0 }}>
          Inactive methods are hidden from the technician payment flow but retained in historical records.
        </p>
      </div>

      {/* Modal */}
      {modal !== undefined && (
        <PaymentMethodModal item={modal} onClose={() => setModal(undefined)} />
      )}
    </div>
  );
}
