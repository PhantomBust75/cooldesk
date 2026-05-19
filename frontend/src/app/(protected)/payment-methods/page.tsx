"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { ApiError } from "@/lib/api/client";
import {
  createPaymentMethod,
  fetchPaymentMethods,
  setPaymentMethodActive,
} from "@/lib/api/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Plus } from "lucide-react";
import { FormEvent, useState } from "react";

export default function PaymentMethodsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
  });

  const createMutation = useMutation({
    mutationFn: () => createPaymentMethod({ name: name.trim() }),
    onSuccess: () => {
      setName("");
      setMessage("Payment method created.");
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create payment method.");
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setPaymentMethodActive(id, { isActive }),
    onSuccess: () => {
      setMessage("Payment method updated.");
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to update payment method.");
      }
    },
  });

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    if (!name.trim()) {
      setErrorMessage("Name is required.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <RoleGate allowedRoles={["owner"]}>
      <section style={{ padding: "24px", maxWidth: "880px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Payment Methods</h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>Owner-managed organization payment methods.</p>
        </div>

        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", marginBottom: "14px" }}>
          <form onSubmit={onCreate} style={{ display: "flex", gap: "8px" }}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Add payment method"
              style={{ flex: 1, borderRadius: "8px", border: "1px solid #E5E5E5", padding: "9px 12px", fontSize: "13px" }}
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{ borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", padding: "9px 14px", fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px", opacity: createMutation.isPending ? 0.6 : 1 }}
            >
              <Plus size={13} strokeWidth={1.5} /> Add
            </button>
          </form>
        </div>

        {message ? <div style={{ borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "12px", color: "#166534", fontSize: "13px", marginBottom: "12px" }}>{message}</div> : null}
        {errorMessage ? <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "13px", marginBottom: "12px" }}>{errorMessage}</div> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {methodsQuery.isLoading ? <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", fontSize: "13px", color: "#737373" }}>Loading payment methods...</div> : null}
          {methodsQuery.isError ? <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "16px", fontSize: "13px", color: "#991B1B" }}>Failed to load payment methods.</div> : null}
          {methodsQuery.data?.map((method) => (
            <article key={method.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "8px", border: "1px solid #E5E5E5", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAFA" }}>
                  <CreditCard size={15} strokeWidth={1.5} color="#525252" />
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>{method.name}</div>
                  <div style={{ fontSize: "12px", color: "#737373" }}>Created: {method.createdAt ? new Date(method.createdAt).toLocaleDateString() : "-"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ borderRadius: "9999px", border: `1px solid ${method.isActive ? "#CCFBF1" : "#E5E5E5"}`, backgroundColor: method.isActive ? "#F0FDFA" : "#F5F5F5", color: method.isActive ? "#134E4A" : "#525252", padding: "4px 9px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <CheckCircle2 size={11} strokeWidth={1.5} /> {method.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate({ id: method.id, isActive: !method.isActive })}
                  style={{ borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", padding: "6px 10px", fontSize: "12px", cursor: "pointer" }}
                >
                  {method.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </RoleGate>
  );
}
