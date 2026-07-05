"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { ApiError } from "@/lib/api/client";
import {
  fetchOfficeBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from "@/lib/api/operations";
import {
  fetchServiceItems,
  createServiceItem,
  updateServiceItem,
  deleteServiceItem,
  type CreateServiceItemInput,
} from "@/lib/api/service-items";
import type { OfficeBrand, ServiceItem } from "@/types/operations";
import { PaymentMethodsSection } from "@/components/payment-methods/PaymentMethodsSection";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
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

// ─── Brand Modal ─────────────────────────────────────────────────────────────

const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "Ocean Blue",    hex: "#0066CC" },
  { name: "Sunset Orange", hex: "#E85A1B" },
  { name: "Crimson Red",   hex: "#C8131B" },
  { name: "Magenta",       hex: "#A50034" },
  { name: "Royal Blue",    hex: "#1428A0" },
  { name: "Forest Green",  hex: "#009B48" },
  { name: "Navy",          hex: "#003087" },
  { name: "Amber",         hex: "#F59E0B" },
  { name: "Violet",        hex: "#7C3AED" },
  { name: "Sky Blue",      hex: "#0EA5E9" },
  { name: "Emerald",       hex: "#10B981" },
  { name: "Coral Red",     hex: "#EF4444" },
  { name: "Slate",         hex: "#475569" },
  { name: "Charcoal",      hex: "#0A0A0A" },
];

type BrandModalProps = {
  brand?: OfficeBrand | null;
  onClose: () => void;
  onSaved: () => void;
};

function BrandModal({ brand, onClose, onSaved }: BrandModalProps) {
  const isEdit = !!brand;
  const [name, setName] = useState(brand?.name ?? "");
  const [colorHex, setColorHex] = useState(brand?.colorHex ?? COLOR_PALETTE[0].hex);
  const [charge, setCharge] = useState(brand ? String(brand.installationCharge) : "");
  const [error, setError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const selectedColor = COLOR_PALETTE.find((c) => c.hex === colorHex);

  const createMutation = useMutation({
    mutationFn: () => createBrand({ name: name.trim(), colorHex, installationCharge: Number(charge) }),
    onSuccess: () => {
      enqueueSnackbar("Brand created", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["office-brands"] });
      onSaved();
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : "Failed to create brand.";
      setError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateBrand(brand!.id, { name: name.trim(), colorHex, installationCharge: Number(charge) }),
    onSuccess: () => {
      enqueueSnackbar("Brand updated", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["office-brands"] });
      onSaved();
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : "Failed to update brand.";
      setError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Brand name is required."); return; }
    const chargeVal = Number(charge);
    if (Number.isNaN(chargeVal) || chargeVal < 0) { setError("Installation charge must be a valid number."); return; }
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isValid = name.trim() && Number(charge) >= 0;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "12px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 38px rgba(0,0,0,0.10)", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #E5E5E5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{isEdit ? "Edit brand" : "Add brand"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", lineHeight: 0, padding: "4px" }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit}>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>
                Brand name <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mitsubishi"
                autoFocus
                style={{ width: "100%", padding: "11px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#171717", minHeight: "44px" }}
                onFocus={(e) => (e.target.style.borderColor = "#A3A3A3")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E5E5")}
              />
            </div>

            {/* Color */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Colour</label>
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", minHeight: "44px" }}>
                  <div style={{ width: "18px", height: "18px", borderRadius: "4px", backgroundColor: colorHex, border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />
                  <select
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", border: "none" }}
                  >
                    {COLOR_PALETTE.map((c) => <option key={c.hex} value={c.hex}>{c.name}</option>)}
                  </select>
                  <span style={{ fontSize: "13px", color: "#404040", flex: 1 }}>{selectedColor?.name ?? "Select colour"}</span>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, color: "#A3A3A3" }}>
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Installation charge */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>
                Installation charge (RS) <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "#737373", pointerEvents: "none" }}>RS</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={charge}
                  onChange={(e) => setCharge(e.target.value)}
                  placeholder="0.00"
                  style={{ width: "100%", padding: "11px 10px", paddingLeft: "42px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#171717", minHeight: "44px" }}
                  onFocus={(e) => (e.target.style.borderColor = "#A3A3A3")}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E5E5")}
                />
              </div>
            </div>

            {error && <div style={{ fontSize: "12px", color: "#EF4444" }}>{error}</div>}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", cursor: "pointer", fontSize: "13px", color: "#404040", minHeight: "44px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !isValid}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: isValid && !isPending ? "#0A0A0A" : "#E5E5E5", color: isValid && !isPending ? "#fff" : "#A3A3A3", cursor: isValid && !isPending ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: 500, minHeight: "44px" }}
              >
                {isPending ? "Saving…" : isEdit ? "Save changes" : "Add brand"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Brands Section ──────────────────────────────────────────────────────────

function BrandsSection() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  // undefined = closed, null = adding, OfficeBrand = editing
  const [modalBrand, setModalBrand] = useState<OfficeBrand | null | undefined>(undefined);

  const brandsQuery = useQuery({
    queryKey: ["office-brands"],
    queryFn: fetchOfficeBrands,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateBrand(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office-brands"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to update brand status.", { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBrand(id),
    onSuccess: () => {
      enqueueSnackbar("Brand deleted", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["office-brands"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to delete brand.", { variant: "error" });
    },
  });

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden", marginBottom: "24px" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", backgroundColor: "#FAFAFA", borderBottom: "1px solid #E5E5E5", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: 0 }}>
          <div style={{ color: "#525252", lineHeight: 0, marginTop: "2px", flexShrink: 0 }}>
            <Layers size={16} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>Brands</div>
            <div style={{ fontSize: "12px", color: "#737373", marginTop: "1px" }}>
              Colour coding for the owner portal and installation charges for the technician payment flow
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalBrand(null)}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "8px", backgroundColor: "#0A0A0A", color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <Plus size={13} strokeWidth={1.5} /> Add
        </button>
      </div>

      {/* Table */}
      {brandsQuery.isLoading && (
        <div style={{ padding: "20px", fontSize: "13px", color: "#737373" }}>Loading…</div>
      )}
      {brandsQuery.isError && (
        <div style={{ padding: "20px", fontSize: "13px", color: "#EF4444" }}>Failed to load brands.</div>
      )}
      {brandsQuery.data && brandsQuery.data.length === 0 && (
        <div style={{ padding: "20px", fontSize: "13px", color: "#737373", textAlign: "center" }}>No brands yet. Add your first brand.</div>
      )}
      {brandsQuery.data && brandsQuery.data.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
              {["Brand", "Installation Charge (RS)", "Status", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 500, color: "#A3A3A3", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {brandsQuery.data.map((brand) => (
              <tr
                key={brand.id}
                style={{ borderBottom: "1px solid #F5F5F5", opacity: brand.isActive ? 1 : 0.55 }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
              >
                {/* Brand (swatch + name) */}
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "22px", height: "22px", borderRadius: "5px", backgroundColor: brand.colorHex ?? "#E5E5E5", border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }} />
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{brand.name}</span>
                  </div>
                </td>
                {/* Charge */}
                <td style={{ padding: "13px 16px", fontSize: "14px", fontWeight: 500, color: "#065F46", fontVariantNumeric: "tabular-nums" }}>
                  RS {brand.installationCharge.toLocaleString()}
                </td>
                {/* Status chip */}
                <td style={{ padding: "13px 16px" }}>
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: brand.id, isActive: !brand.isActive })}
                    title={brand.isActive ? "Click to deactivate" : "Click to activate"}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      padding: "4px 10px", borderRadius: "9999px", border: "none",
                      fontSize: "12px", fontWeight: 500, cursor: "pointer",
                      backgroundColor: brand.isActive ? "#D1FAE5" : "#F5F5F5",
                      color: brand.isActive ? "#065F46" : "#525252",
                    }}
                  >
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: brand.isActive ? "#10B981" : "#A3A3A3", flexShrink: 0 }} />
                    {brand.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                {/* Actions */}
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setModalBrand(brand)}
                      title="Edit"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "7px", border: "none", cursor: "pointer", backgroundColor: "#FAFAFA", color: "#525252" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F0F0")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm("Delete this brand?")) deleteMutation.mutate(brand.id); }}
                      title="Delete"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "7px", border: "none", cursor: "pointer", backgroundColor: "#FFF5F5", color: "#EF4444" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FEE2E2")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFF5F5")}
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

      {/* Footer note */}
      <div style={{ padding: "10px 16px", backgroundColor: "#FAFAFA", borderTop: "1px solid #F5F5F5" }}>
        <p style={{ fontSize: "12px", color: "#737373", margin: 0 }}>
          Inactive brands are hidden from new job forms and the technician payment flow but retained in historical records.
        </p>
      </div>

      {/* Modal */}
      {modalBrand !== undefined && (
        <BrandModal
          brand={modalBrand}
          onClose={() => setModalBrand(undefined)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["office-brands"] })}
        />
      )}
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
