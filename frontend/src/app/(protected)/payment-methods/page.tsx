"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { ApiError } from "@/lib/api/client";
import {
  fetchOfficeBrands,
  createBrand,
} from "@/lib/api/operations";
import {
  fetchServiceItems,
  createServiceItem,
  updateServiceItem,
  deleteServiceItem,
  type CreateServiceItemInput,
} from "@/lib/api/service-items";
import type { ServiceItem } from "@/types/operations";
import { PaymentMethodsSection } from "@/components/payment-methods/PaymentMethodsSection";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useSnackbar } from "notistack";
import { FormEvent, useState } from "react";

// ─── Service Items Modal ─────────────────────────────────────────────────────

type ServiceItemModalProps = {
  item?: ServiceItem | null;
  onClose: () => void;
  onSaved: () => void;
};

function ServiceItemModal({ item, onClose, onSaved }: ServiceItemModalProps) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [pricingType, setPricingType] = useState<"fixed" | "variable">(item?.pricingType ?? "fixed");
  const [unitPrice, setUnitPrice] = useState(item ? String(item.unitPrice) : "");
  const [unitLabel, setUnitLabel] = useState(item?.unitLabel ?? "");
  const [error, setError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const createMutation = useMutation({
    mutationFn: (input: CreateServiceItemInput) => createServiceItem(input),
    onSuccess: () => {
      enqueueSnackbar("Service item created successfully", { variant: "success" });
      onSaved();
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : "Failed to save.";
      setError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: Partial<CreateServiceItemInput>) => updateServiceItem(item!.id, input),
    onSuccess: () => {
      enqueueSnackbar("Service item updated successfully", { variant: "success" });
      onSaved();
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : "Failed to save.";
      setError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    const price = Number(unitPrice);
    if (Number.isNaN(price) || price < 0) { setError("Unit price must be a valid number."); return; }
    const input: CreateServiceItemInput = {
      name: name.trim(),
      pricingType,
      unitPrice: price,
      unitLabel: pricingType === "variable" && unitLabel.trim() ? unitLabel.trim() : undefined,
    };
    if (isEdit) {
      updateMutation.mutate(input);
    } else {
      createMutation.mutate(input);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "24px", width: "100%", maxWidth: "420px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#171717" }}>{isEdit ? "Edit Service Item" : "Add Service Item"}</div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", display: "flex", alignItems: "center" }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#525252", marginBottom: "6px" }}>Item Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AC Service, Filter Replacement"
              autoFocus
              style={{ width: "100%", borderRadius: "8px", border: "1px solid #E5E5E5", padding: "9px 12px", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          {/* Pricing type toggle */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#525252", marginBottom: "6px" }}>Pricing Type</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["fixed", "variable"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPricingType(t)}
                  style={{
                    flex: 1,
                    borderRadius: "8px",
                    border: `1px solid ${pricingType === t ? "#0A0A0A" : "#E5E5E5"}`,
                    backgroundColor: pricingType === t ? "#0A0A0A" : "#fff",
                    color: pricingType === t ? "#fff" : "#525252",
                    padding: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontWeight: pricingType === t ? 600 : 400,
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Unit price */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#525252", marginBottom: "6px" }}>Unit Price</label>
            <input
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              style={{ width: "100%", borderRadius: "8px", border: "1px solid #E5E5E5", padding: "9px 12px", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          {/* Unit label — only for variable */}
          {pricingType === "variable" && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#525252", marginBottom: "6px" }}>Unit Label <span style={{ color: "#737373", fontWeight: 400 }}>(optional)</span></label>
              <input
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="e.g. per unit, per hour"
                style={{ width: "100%", borderRadius: "8px", border: "1px solid #E5E5E5", padding: "9px 12px", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          )}

          {error && (
            <div style={{ fontSize: "12px", color: "#EF4444" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button
              type="submit"
              disabled={isPending}
              style={{ flex: 1, borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", padding: "10px", fontSize: "13px", cursor: "pointer", fontWeight: 500, opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", padding: "10px 16px", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Service Items Section ───────────────────────────────────────────────────

function ServiceItemsSection() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [modalItem, setModalItem] = useState<ServiceItem | null | undefined>(undefined);
  // undefined = modal closed, null = adding new, ServiceItem = editing

  const itemsQuery = useQuery({
    queryKey: ["service-items"],
    queryFn: fetchServiceItems,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteServiceItem(id),
    onSuccess: () => {
      enqueueSnackbar("Service item deleted", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["service-items"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to delete service item.", { variant: "error" });
    },
  });

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "0", marginBottom: "24px", overflow: "hidden" }}>
      {/* FAFAFA Header Bar */}
      <div style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Tag size={18} strokeWidth={1.5} color="#525252" />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>Service Items & Pricing</div>
            <div style={{ fontSize: "12px", color: "#737373" }}>Standard items and pricing for job invoices</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalItem(null)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", fontSize: "13px", cursor: "pointer" }}
        >
          <Plus size={13} strokeWidth={1.5} /> Add
        </button>
      </div>

      {/* Section content */}
      <div style={{ padding: "20px" }}>

      {/* Table */}
      {itemsQuery.isLoading && (
        <div style={{ fontSize: "13px", color: "#737373", padding: "12px 0" }}>Loading…</div>
      )}
      {itemsQuery.isError && (
        <div style={{ fontSize: "13px", color: "#EF4444", padding: "12px 0" }}>Failed to load service items.</div>
      )}
      {itemsQuery.data && itemsQuery.data.length === 0 && (
        <div style={{ fontSize: "13px", color: "#737373", padding: "12px 0", textAlign: "center" }}>No service items yet. Add your first item.</div>
      )}
      {itemsQuery.data && itemsQuery.data.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
              <th style={{ textAlign: "left", fontSize: "11px", fontWeight: 500, color: "#737373", padding: "10px 16px" }}>ITEM</th>
              <th style={{ textAlign: "left", fontSize: "11px", fontWeight: 500, color: "#737373", padding: "10px 16px" }}>PRICING</th>
              <th style={{ textAlign: "right", fontSize: "11px", fontWeight: 500, color: "#737373", padding: "10px 16px" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {itemsQuery.data.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #E5E5E5" }}>
                <td style={{ padding: "13px 16px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>{item.name}</td>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      borderRadius: "6px",
                      backgroundColor: item.pricingType === "variable" ? "rgba(59,130,246,0.12)" : "#F5F5F5",
                      color: item.pricingType === "variable" ? "#3B82F6" : "#525252",
                      padding: "3px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}>
                      {item.pricingType}
                    </span>
                    <span style={{ fontSize: "13px", color: "#404040", fontWeight: 500 }}>
                      {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {item.unitLabel ? <span style={{ fontSize: "11px", color: "#737373", fontWeight: 400 }}> {item.unitLabel}</span> : null}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "13px 16px", textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setModalItem(item)}
                      style={{ borderRadius: "7px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#404040", padding: "6px 8px", fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                      title="Edit"
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Delete this service item?")) deleteMutation.mutate(item.id); }}
                      style={{ borderRadius: "7px", border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)", color: "#EF4444", padding: "6px 8px", fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                      title="Delete"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {modalItem !== undefined && (
        <ServiceItemModal
          item={modalItem}
          onClose={() => setModalItem(undefined)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["service-items"] })}
        />
      )}
      </div>
    </div>
  );
}

// ─── Brands Section ──────────────────────────────────────────────────────────

function BrandsSection() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [showAdd, setShowAdd] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandColor, setBrandColor] = useState("#3B82F6");
  const [error, setError] = useState<string | null>(null);

  const brandsQuery = useQuery({
    queryKey: ["office-brands"],
    queryFn: fetchOfficeBrands,
  });

  const createMutation = useMutation({
    mutationFn: () => createBrand({ name: brandName.trim(), colorHex: brandColor }),
    onSuccess: () => {
      enqueueSnackbar("Brand created successfully", { variant: "success" });
      setBrandName("");
      setBrandColor("#3B82F6");
      setShowAdd(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["office-brands"] });
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : "Unable to create brand.";
      setError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!brandName.trim()) { setError("Brand name is required."); return; }
    createMutation.mutate();
  }

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "0", overflow: "hidden" }}>
      {/* FAFAFA Header Bar */}
      <div style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Building2 size={18} strokeWidth={1.5} color="#525252" />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>Brands</div>
            <div style={{ fontSize: "12px", color: "#737373" }}>Product brands handled by your organization</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(true); setBrandName(""); setError(null); }}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", border: "none", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", fontSize: "13px", cursor: "pointer" }}
        >
          <Plus size={13} strokeWidth={1.5} /> Add brand
        </button>
      </div>

      {/* Section content */}
      <div style={{ padding: "20px" }}>

      {/* Add form */}
      {showAdd && (
        <div style={{ marginBottom: "16px", padding: "14px", backgroundColor: "#F5F5F5", borderRadius: "10px" }}>
          <form onSubmit={onSubmit} style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Brand name"
              autoFocus
              style={{ flex: "1 1 200px", borderRadius: "8px", border: "1px solid #E5E5E5", padding: "9px 12px", fontSize: "13px", backgroundColor: "#fff" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "#525252", fontWeight: 500 }}>Color</label>
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                style={{ width: "36px", height: "36px", borderRadius: "6px", border: "1px solid #E5E5E5", cursor: "pointer", padding: "2px", backgroundColor: "#fff" }}
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{ borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", padding: "9px 14px", fontSize: "13px", cursor: "pointer", opacity: createMutation.isPending ? 0.6 : 1 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setError(null); }}
              style={{ borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", color: "#525252", padding: "9px 12px", fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </form>
          {error && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#EF4444" }}>{error}</div>
          )}
        </div>
      )}

      {/* Brands list */}
      {brandsQuery.isLoading && (
        <div style={{ fontSize: "13px", color: "#737373", padding: "12px 0" }}>Loading…</div>
      )}
      {brandsQuery.isError && (
        <div style={{ fontSize: "13px", color: "#EF4444", padding: "12px 0" }}>Failed to load brands.</div>
      )}
      {brandsQuery.data && brandsQuery.data.length === 0 && (
        <div style={{ fontSize: "13px", color: "#737373", padding: "12px 0", textAlign: "center" }}>No brands yet. Add your first brand.</div>
      )}
      {brandsQuery.data && brandsQuery.data.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
              <th style={{ textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#737373", padding: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>BRAND</th>
              <th style={{ textAlign: "right", fontSize: "11px", fontWeight: 600, color: "#737373", padding: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>INSTALLATION CHARGE</th>
            </tr>
          </thead>
          <tbody>
            {brandsQuery.data.map((brand) => (
              <tr key={brand.id} style={{ borderBottom: "1px solid #E5E5E5" }}>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        backgroundColor: brand.colorHex ?? "#E5E5E5",
                        flexShrink: 0,
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>{brand.name}</span>
                  </div>
                </td>
                <td style={{ padding: "13px 16px", textAlign: "right", fontSize: "13px", color: "#404040", fontWeight: 500 }}>
                  {brand.installationCharge > 0
                    ? brand.installationCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : <span style={{ color: "#737373" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PaymentMethodsPage() {
  return (
    <RoleGate allowedRoles={["owner"]}>
      <section style={{ padding: "24px", maxWidth: "960px" }}>
        {/* Page title */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Payments &amp; Brands
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0" }}>
            Manage payment methods, service item pricing, and brands
          </p>
        </div>

        <PaymentMethodsSection />
        <ServiceItemsSection />
        <BrandsSection />
      </section>
    </RoleGate>
  );
}
