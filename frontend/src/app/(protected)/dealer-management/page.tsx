"use client";

import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { RoleGate } from "@/components/auth/role-gate";
import { ApiError } from "@/lib/api/client";
import { createDealer, fetchDealers, fetchOfficeBrands, setDealerBrands, updateDealer, updateDealerProfile } from "@/lib/api/operations";
import type { DealerDirectoryItem } from "@/types/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Search, Eye, Copy, Pencil } from "lucide-react";
import { FormEvent, useMemo, useState, useCallback } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

function SegmentedStatusToggle({ active, onToggle, disabled = false, loading = false }: { active: boolean; onToggle: () => void; disabled?: boolean; loading?: boolean }) {
  const isDisabled = disabled || loading;
  
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px",
        borderRadius: "9999px",
        border: "1px solid #E5E5E5",
        backgroundColor: "#F5F5F5",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        transition: "opacity 120ms ease",
        position: "relative",
        boxSizing: "border-box",
      }}
      aria-pressed={active}
      aria-label={active ? "Set inactive" : "Set active"}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 12px",
          borderRadius: "9999px",
          backgroundColor: active ? "#FFFFFF" : "transparent",
          boxShadow: active ? "0px 1px 2px rgba(0, 0, 0, 0.05)" : "none",
          color: active ? "#10B981" : "#737373",
          fontSize: "12px",
          fontWeight: 500,
          transition: "all 150ms ease",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: active ? "#10B981" : "transparent",
          }}
        />
        Active
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 12px",
          borderRadius: "9999px",
          backgroundColor: !active ? "#FFFFFF" : "transparent",
          boxShadow: !active ? "0px 1px 2px rgba(0, 0, 0, 0.05)" : "none",
          color: !active ? "#737373" : "#A3A3A3",
          fontSize: "12px",
          fontWeight: 500,
          transition: "all 150ms ease",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: !active ? "#737373" : "transparent",
          }}
        />
        Inactive
      </div>
    </button>
  );
}

export default function DealerManagementPage() {
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();
  
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [password, setPassword] = useState("");
  
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [editBrandIds, setEditBrandIds] = useState<string[]>([]);
  
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);

  const dealersQuery = useQuery({
    queryKey: ["dealers", "management"],
    queryFn: fetchDealers,
  });

  const brandsQuery = useQuery({
    queryKey: ["office", "brands"],
    queryFn: fetchOfficeBrands,
  });

  const filteredDealers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return dealersQuery.data ?? [];
    }
    return (dealersQuery.data ?? []).filter((dealer) => {
      const value = `${dealer.name} ${dealer.contactName ?? ""} ${dealer.phone}`.toLowerCase();
      return value.includes(query);
    });
  }, [search, dealersQuery.data]);

  const openCreateModal = useCallback(() => {
    setName("");
    setContactName("");
    setEmail("");
    setRegion("");
    setPassword("");
    setSelectedBrandIds([]);
    setShowCreate(true);
    setMessage(null);
    setErrorMessage(null);
  }, []);

  const openEditModal = useCallback((dealer: DealerDirectoryItem) => {
    setSelectedDealerId(dealer.id);
    setName(dealer.name);
    setContactName(dealer.contactName ?? "");
    setEmail(dealer.email ?? "");
    setRegion(dealer.region ?? "");
    setEditBrandIds(dealer.brandIds);
    setShowEdit(true);
    setMessage(null);
    setErrorMessage(null);
  }, []);

  const createMutation = useMutation({
    mutationFn: () => createDealer({
      name: name.trim(),
      contactName: contactName.trim() || undefined,
      email: email.trim(),
      region: region.trim() || undefined,
      password,
      brandIds: selectedBrandIds,
    }),
    onSuccess: () => {
      setMessage("Dealer created.");
      setErrorMessage(null);
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["dealers", "management"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create dealer.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDealerId) return;
      await updateDealerProfile(selectedDealerId, {
        name: name.trim() || undefined,
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        region: region.trim() || undefined,
      });
      await setDealerBrands(selectedDealerId, editBrandIds);
    },
    onSuccess: () => {
      setMessage("Dealer updated.");
      setErrorMessage(null);
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ["dealers", "management"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to update dealer.");
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateDealer(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers", "management"] });
    },
    onError: () => {
      setErrorMessage("Unable to update dealer status.");
    },
  });

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMessage("Business name, email, and password are required.");
      return;
    }
    createMutation.mutate();
  }

  function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    if (!name.trim()) {
      setErrorMessage("Business name is required.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Email address is required.");
      return;
    }
    updateMutation.mutate();
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const total = dealersQuery.data?.length ?? 0;

  return (
    <RoleGate allowedRoles={["owner", "office_staff"]}>
      <section style={{ padding: isMobile ? "16px" : "32px", maxWidth: "980px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em" }}>Dealers</h1>
            <p style={{ fontSize: "14px", color: "#737373", margin: "4px 0 0", fontWeight: 400 }}>
              {dealersQuery.data ? `${total} dealer${total === 1 ? "" : "s"}` : "Loading..."}
            </p>
          </div>
          <RoleGate allowedRoles={["owner"]}>
            <button
              type="button"
              onClick={openCreateModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "8px", border: "1px solid #0A0A0A", backgroundColor: "#0A0A0A", color: "#FFFFFF", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}
            >
              <Plus size={16} strokeWidth={2} /> Add dealer
            </button>
          </RoleGate>
        </div>

        <div style={{ marginBottom: "24px", position: "relative", maxWidth: "320px" }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs, customers..."
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", backgroundColor: "#FAFAFA", color: "#171717" }}
          />
        </div>

        {message ? (
          <div style={{ borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "12px", color: "#166534", fontSize: "14px", marginBottom: "16px" }}>
            {message}
          </div>
        ) : null}
        {errorMessage ? (
          <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "14px", marginBottom: "16px" }}>
            {errorMessage}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {dealersQuery.isLoading ? (
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "20px", fontSize: "14px", color: "#737373" }}>
              Loading dealers...
            </div>
          ) : null}
          {dealersQuery.isError ? (
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "20px", fontSize: "14px", color: "#737373" }}>
              Unable to load dealers.
            </div>
          ) : null}
          {!dealersQuery.isLoading && !dealersQuery.isError && filteredDealers.length === 0 ? (
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "20px", fontSize: "14px", color: "#737373" }}>
              No dealers found.
            </div>
          ) : null}

          {filteredDealers.map((dealer) => (
            <div
              key={dealer.id}
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.02)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <Avatar name={dealer.name} size={48} />
                <span style={{ fontSize: "16px", fontWeight: 600, color: dealer.isActive ? "#171717" : "#A3A3A3" }}>
                  {dealer.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <RoleGate allowedRoles={["owner"]}>
                  <SegmentedStatusToggle
                    active={dealer.isActive}
                    onToggle={() => toggleMutation.mutate({ id: dealer.id, isActive: !dealer.isActive })}
                    loading={toggleMutation.isPending}
                  />
                </RoleGate>
                <RoleGate allowedRoles={["owner"]}>
                  <button
                    type="button"
                    onClick={() => openEditModal(dealer)}
                    style={{ 
                      border: "1px solid #E5E5E5", 
                      borderRadius: "8px",
                      backgroundColor: "#FFFFFF", 
                      color: "#404040", 
                      fontSize: "13px", 
                      fontWeight: 500,
                      cursor: "pointer", 
                      padding: "8px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Pencil size={14} strokeWidth={2} />
                    Edit
                  </button>
                </RoleGate>
              </div>
            </div>
          ))}
        </div>

        {/* Create Modal */}
        <RoleGate allowedRoles={["owner"]}>
          <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add dealer">
            <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Business name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                    placeholder="E.g., CoolAir Solutions LLC"
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Contact name
                  </label>
                  <input
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                    placeholder="E.g., Faisal Al-Harbi"
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Email address <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                    placeholder="faisal@coolair.sa"
                    type="email"
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Region
                  </label>
                  <input
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                    placeholder="E.g., Riyadh"
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Password <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                    placeholder="Min 8 characters"
                    type="password"
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "12px", fontSize: "13px", fontWeight: 600, color: "#171717" }}>
                    Brand assignment
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                    {(brandsQuery.data ?? []).map((brand) => {
                      const checked = selectedBrandIds.includes(brand.id);
                      return (
                        <label key={brand.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#171717", fontWeight: 500, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedBrandIds((current) => {
                                if (event.target.checked) return [...current, brand.id];
                                return current.filter((brandId) => brandId !== brand.id);
                              });
                            }}
                            style={{ 
                              width: "16px", height: "16px", borderRadius: "4px", border: "1px solid #D4D4D4", cursor: "pointer"
                            }}
                          />
                          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: brand.colorHex || "#10B981" }} />
                          {brand.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "16px", borderTop: "1px solid #E5E5E5" }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{ border: "1px solid #E5E5E5", borderRadius: "8px", padding: "10px 16px", backgroundColor: "#FFFFFF", color: "#404040", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{ border: "none", borderRadius: "8px", padding: "10px 16px", backgroundColor: "#0A0A0A", color: "#FFFFFF", fontSize: "14px", fontWeight: 500, cursor: "pointer", opacity: createMutation.isPending ? 0.6 : 1 }}
                >
                  {createMutation.isPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </Modal>
        </RoleGate>

        {/* Edit Modal */}
        <RoleGate allowedRoles={["owner"]}>
          <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit dealer">
            <form onSubmit={onUpdate} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Business name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Contact name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Email address <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                    type="email"
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                    Region
                  </label>
                  <input
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#171717" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: 600, color: "#171717" }}>
                  Account credentials
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      USERNAME
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        value={email}
                        readOnly
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 40px 10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#737373", backgroundColor: "#FAFAFA" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(email)}
                        style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#A3A3A3", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "11px", fontWeight: 600, color: "#737373", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      PASSWORD
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        value="••••••••••••"
                        readOnly
                        type={showPassword ? "text" : "password"}
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 72px 10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "14px", color: "#737373", backgroundColor: "#FAFAFA" }}
                      />
                      <div style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#A3A3A3", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy("dummy-password")}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#A3A3A3", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: "12px", color: "#737373", margin: "8px 0 0 0" }}>
                      To change the password, use the "Reset password" flow in system settings.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: 600, color: "#171717" }}>
                  Brand assignment
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                  {(brandsQuery.data ?? []).map((brand) => {
                    const checked = editBrandIds.includes(brand.id);
                    return (
                      <label key={brand.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#171717", fontWeight: 500, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setEditBrandIds((current) => {
                              if (event.target.checked) return [...current, brand.id];
                              return current.filter((brandId) => brandId !== brand.id);
                            });
                          }}
                          style={{ 
                            width: "16px", height: "16px", borderRadius: "4px", border: "1px solid #D4D4D4", cursor: "pointer"
                          }}
                        />
                        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: brand.colorHex || "#10B981" }} />
                        {brand.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "24px", borderTop: "1px solid #E5E5E5" }}>
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  style={{ border: "1px solid #E5E5E5", borderRadius: "8px", padding: "10px 16px", backgroundColor: "#FFFFFF", color: "#404040", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  style={{ border: "none", borderRadius: "8px", padding: "10px 16px", backgroundColor: "#0A0A0A", color: "#FFFFFF", fontSize: "14px", fontWeight: 500, cursor: "pointer", opacity: updateMutation.isPending ? 0.6 : 1 }}
                >
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </Modal>
        </RoleGate>
      </section>
    </RoleGate>
  );
}
