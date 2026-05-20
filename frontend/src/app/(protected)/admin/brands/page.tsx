"use client";

import { ApiError } from "@/lib/api/client";
import { createBrand, fetchOfficeBrands } from "@/lib/api/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

export default function BrandsAdminPage() {
  const queryClient = useQueryClient();
  const [brandName, setBrandName] = useState("");
  const [brandColor, setBrandColor] = useState("#1E40AF");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const brandsQuery = useQuery({
    queryKey: ["office", "brands"],
    queryFn: fetchOfficeBrands,
  });

  const createMutation = useMutation({
    mutationFn: () => createBrand({ name: brandName.trim(), colorHex: brandColor }),
    onSuccess: () => {
      setSuccessMessage("Brand created successfully.");
      setErrorMessage(null);
      setBrandName("");
      setBrandColor("#1E40AF");
      queryClient.invalidateQueries({ queryKey: ["office", "brands"] });
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create brand.");
      }
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!brandName.trim()) {
      setErrorMessage("Brand name is required.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <section style={{ padding: "24px", maxWidth: "800px" }}>
      <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", marginBottom: "8px" }}>
        Brands
      </h1>
      <p style={{ fontSize: "13px", color: "#737373", margin: "0 0 24px", fontWeight: 400 }}>
        Create and manage AC brands for this organization.
      </p>

      <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#171717", margin: "0 0 16px" }}>New brand</h2>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr auto auto" }}>
          <input
            type="text"
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            placeholder="Brand name (e.g., Daikin)"
            style={{
              border: "1px solid #E5E5E5",
              borderRadius: "8px",
              padding: "9px 12px",
              fontSize: "13px",
              color: "#171717",
            }}
          />

          <input
            type="color"
            value={brandColor}
            onChange={(event) => setBrandColor(event.target.value)}
            style={{
              border: "1px solid #E5E5E5",
              borderRadius: "8px",
              width: "50px",
              height: "38px",
              cursor: "pointer",
            }}
          />

          <button
            type="submit"
            disabled={createMutation.isPending}
            style={{
              border: "none",
              borderRadius: "8px",
              backgroundColor: "#0A0A0A",
              color: "#fff",
              padding: "9px 14px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: createMutation.isPending ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              opacity: createMutation.isPending ? 0.6 : 1,
            }}
          >
            <Plus size={14} strokeWidth={1.5} />
            {createMutation.isPending ? "Creating..." : "Add"}
          </button>
        </form>

        {errorMessage ? (
          <div style={{ marginTop: "12px", borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "13px" }}>
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div style={{ marginTop: "12px", borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "12px", color: "#166534", fontSize: "13px" }}>
            {successMessage}
          </div>
        ) : null}
      </div>

      <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#FAFAFA", color: "#737373", textAlign: "left", borderBottom: "1px solid #E5E5E5" }}>
              <th style={{ padding: "12px", fontWeight: 500 }}>Name</th>
              <th style={{ padding: "12px", fontWeight: 500 }}>Color</th>
              <th style={{ padding: "12px", fontWeight: 500, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {brandsQuery.isLoading ? (
              <tr>
                <td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "#737373" }}>
                  Loading brands...
                </td>
              </tr>
            ) : null}
            {brandsQuery.isError ? (
              <tr>
                <td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "#991B1B" }}>
                  Unable to load brands.
                </td>
              </tr>
            ) : null}
            {!brandsQuery.isLoading && !brandsQuery.isError && (brandsQuery.data?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "#737373" }}>
                  No brands yet.
                </td>
              </tr>
            ) : null}
            {brandsQuery.data?.map((brand) => (
              <tr key={brand.id} style={{ borderBottom: "1px solid #F5F5F5" }}>
                <td style={{ padding: "12px", color: "#171717" }}>{brand.name}</td>
                <td style={{ padding: "12px" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        backgroundColor: brand.colorHex ?? "#1E40AF",
                        border: "1px solid #E5E5E5",
                      }}
                    />
                    <span style={{ fontSize: "12px", color: "#737373" }}>{brand.colorHex ?? "#1E40AF"}</span>
                  </div>
                </td>
                <td style={{ padding: "12px", textAlign: "center" }}>
                  <button
                    type="button"
                    style={{
                      border: "1px solid #FECACA",
                      borderRadius: "6px",
                      backgroundColor: "transparent",
                      color: "#991B1B",
                      padding: "6px 8px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                    }}
                    disabled
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
