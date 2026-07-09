"use client";

import { Avatar } from "@/components/ui/avatar";
import { StatusToggle } from "@/components/ui/status-toggle";
import { RoleGate } from "@/components/auth/role-gate";
import { DealerDetailPanel } from "@/components/dealers/DealerDetailPanel";
import { ApiError } from "@/lib/api/client";
import { createDealer, fetchDealers, fetchOfficeBrands, setDealerBrands, updateDealer, updateDealerProfile } from "@/lib/api/operations";
import type { DealerDirectoryItem } from "@/types/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Copy, Edit, Eye, Plus, Save, Search, X } from "lucide-react";
import { useSnackbar } from "notistack";
import { FormEvent, useMemo, useState, useCallback } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

export default function DealerManagementPage() {
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();
  const { enqueueSnackbar } = useSnackbar();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [panelDealer, setPanelDealer] = useState<DealerDirectoryItem | null>(null);

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
      enqueueSnackbar("Dealer created successfully", { variant: "success" });
      setMessage("Dealer created.");
      setErrorMessage(null);
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["dealers", "management"] });
    },
    onError: (error) => {
      const msg = error instanceof ApiError ? error.message : "Unable to create dealer.";
      setErrorMessage(msg);
      enqueueSnackbar(msg, { variant: "error" });
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
      enqueueSnackbar("Dealer updated successfully", { variant: "success" });
      setMessage("Dealer updated.");
      setErrorMessage(null);
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ["dealers", "management"] });
    },
    onError: (error) => {
      const msg = error instanceof ApiError ? error.message : "Unable to update dealer.";
      setErrorMessage(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateDealer(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealers", "management"] });
    },
    onError: () => {
      enqueueSnackbar("Unable to update dealer status.", { variant: "error" });
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
      <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1100px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em" }}>Dealers</h1>
            <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
              {dealersQuery.data ? `${total} dealer${total === 1 ? "" : "s"}` : "Loading..."}
            </p>
          </div>
          <RoleGate allowedRoles={["owner"]}>
            <button
              type="button"
              onClick={openCreateModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#FFFFFF", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
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

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
              style={{
                backgroundColor: '#fff',
                border: '1px solid #E5E5E5',
                borderRadius: '12px',
                padding: isMobile ? '14px 16px' : '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                opacity: dealer.isActive ? 1 : 0.6,
                transition: 'box-shadow 140ms, border-color 140ms, opacity 200ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                (e.currentTarget as HTMLElement).style.borderColor = '#D4D4D4';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLElement).style.borderColor = '#E5E5E5';
              }}
            >
              {/* Clickable area: avatar + name */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPanelDealer(dealer)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPanelDealer(dealer); }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1, minWidth: 0 }}
              >
                <Avatar name={dealer.name} size={40} />
                <span style={{ fontSize: '15px', fontWeight: 500, color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dealer.name}
                </span>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div style={{ width: '1px', height: '32px', backgroundColor: '#E5E5E5' }} />
                <RoleGate allowedRoles={["owner"]}>
                  <StatusToggle
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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #E5E5E5',
                      backgroundColor: '#FAFAFA',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#525252',
                      flexShrink: 0,
                    }}
                  >
                    <Edit size={12} strokeWidth={1.5} /> Edit
                  </button>
                </RoleGate>
              </div>
            </div>
          ))}
        </div>

        {/* Create Bottom-Sheet */}
        <RoleGate allowedRoles={["owner"]}>
          {showCreate && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999 }}
              onClick={() => setShowCreate(false)}
            >
              <div
                style={{ backgroundColor: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '520px', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Add dealer</span>
                  <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>
                {/* Body */}
                <form onSubmit={onCreate} style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {errorMessage && (
                    <div style={{ borderRadius: '8px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: '10px 12px', color: '#991B1B', fontSize: '13px' }}>
                      {errorMessage}
                    </div>
                  )}
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

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px', borderTop: '1px solid #E5E5E5', marginTop: '6px' }}>
                    <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
                    <button type="submit" disabled={createMutation.isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: createMutation.isPending ? 0.6 : 1 }}>
                      {createMutation.isPending ? "Saving..." : "Add dealer"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </RoleGate>

        {/* Dealer Detail Panel */}
        {panelDealer && (
          <DealerDetailPanel
            dealer={panelDealer}
            onClose={() => setPanelDealer(null)}
          />
        )}

        {/* Edit Bottom-Sheet */}
        <RoleGate allowedRoles={["owner"]}>
          {showEdit && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999 }}
              onClick={() => setShowEdit(false)}
            >
              <div
                style={{ backgroundColor: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '520px', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Edit dealer</span>
                  <button type="button" onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>
                {/* Body */}
                <form onSubmit={onUpdate} style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {errorMessage && (
                    <div style={{ borderRadius: '8px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: '10px 12px', color: '#991B1B', fontSize: '13px' }}>
                      {errorMessage}
                    </div>
                  )}
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
                          To change the password, use the &ldquo;Reset password&rdquo; flow in system settings.
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

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px', borderTop: '1px solid #E5E5E5', marginTop: '6px' }}>
                    <button type="button" onClick={() => setShowEdit(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
                    <button type="submit" disabled={updateMutation.isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: updateMutation.isPending ? 0.6 : 1 }}>
                      <Save size={13} strokeWidth={1.5} /> {updateMutation.isPending ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </RoleGate>
      </section>
    </RoleGate>
  );
}
