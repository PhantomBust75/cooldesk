"use client";

import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { StatusToggle } from "@/components/ui/status-toggle";
import { RoleGate } from "@/components/auth/role-gate";
import { ApiError } from "@/lib/api/client";
import { createDealer, fetchDealers, fetchOfficeBrands, setDealerBrands, updateDealer, updateDealerProfile } from "@/lib/api/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Search } from "lucide-react";
import { FormEvent, useMemo, useState, useCallback } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

export default function DealerManagementPage() {
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [editBrandIds, setEditBrandIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const value = `${dealer.name} ${dealer.phone}`.toLowerCase();
      return value.includes(query);
    });
  }, [search, dealersQuery.data]);

  const openEditModal = useCallback((dealer: { id: string; name: string; phone: string; brandIds: string[] }) => {
    setSelectedDealerId(dealer.id);
    setName(dealer.name);
    setPhone(dealer.phone);
    setEditBrandIds(dealer.brandIds);
    setShowEdit(true);
  }, []);

  const createMutation = useMutation({
    mutationFn: () => createDealer({
      name: name.trim(),
      email: email.trim(),
      password,
      brandIds: selectedBrandIds,
    }),
    onSuccess: () => {
      setMessage("Dealer created.");
      setErrorMessage(null);
      setName("");
      setEmail("");
      setPassword("");
      setSelectedBrandIds([]);
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
        phone: phone.trim() || undefined,
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
      setErrorMessage("Name, email, and password are required.");
      return;
    }
    createMutation.mutate();
  }

  const total = dealersQuery.data?.length ?? 0;

  return (
    <RoleGate allowedRoles={["owner", "office_staff"]}>
      <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "980px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Dealer Management</h1>
            <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>
              {dealersQuery.data ? `${total} dealer${total === 1 ? "" : "s"}` : "Loading..."}
            </p>
          </div>
          <RoleGate allowedRoles={["owner"]}>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#0A0A0A", color: "#FAFAFA", cursor: "pointer", fontSize: "13px" }}
            >
              <Plus size={14} strokeWidth={1.5} /> Add dealer
            </button>
          </RoleGate>
        </div>

        <div style={{ marginBottom: "16px", position: "relative", maxWidth: "320px" }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dealers"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", backgroundColor: "#FAFAFA", color: "#171717" }}
          />
        </div>

        {message ? (
          <div style={{ borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "12px", color: "#166534", fontSize: "13px", marginBottom: "12px" }}>
            {message}
          </div>
        ) : null}
        {errorMessage ? (
          <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "13px", marginBottom: "12px" }}>
            {errorMessage}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {dealersQuery.isLoading ? (
            <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>
              Loading dealers...
            </div>
          ) : null}
          {dealersQuery.isError ? (
            <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>
              Unable to load dealers.
            </div>
          ) : null}
          {!dealersQuery.isLoading && !dealersQuery.isError && filteredDealers.length === 0 ? (
            <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>
              No dealers found.
            </div>
          ) : null}

          {filteredDealers.map((dealer) => (
            <div
              key={dealer.id}
              style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={dealer.name} size={40} />
                <span style={{ fontSize: "15px", fontWeight: 500, color: dealer.isActive ? "#0A0A0A" : "#737373" }}>
                  {dealer.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                    onClick={() => openEditModal({ id: dealer.id, name: dealer.name, phone: dealer.phone, brandIds: dealer.brandIds })}
                    style={{ border: "none", backgroundColor: "transparent", color: "#525252", fontSize: "13px", cursor: "pointer", padding: "4px 8px" }}
                  >
                    ✎ Edit
                  </button>
                </RoleGate>
              </div>
            </div>
          ))}
        </div>

        <RoleGate allowedRoles={["owner"]}>
          <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add dealer">
            <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>
                  Dealer name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }}
                  placeholder="Dealer name"
                />
                {!name.trim() && errorMessage ? (
                  <div style={{ marginTop: "5px", fontSize: "12px", color: "#EF4444", display: "flex", alignItems: "center", gap: "4px" }}>
                    <AlertCircle size={12} strokeWidth={1.5} /> Name is required.
                  </div>
                ) : null}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>
                  Email <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }}
                  placeholder="Dealer email"
                  type="email"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>
                  Password <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }}
                  placeholder="Dealer password"
                  type="password"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Linked brands</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", padding: "10px", border: "1px solid #E5E5E5", borderRadius: "8px", maxHeight: "160px", overflowY: "auto" }}>
                  {(brandsQuery.data ?? []).map((brand) => {
                    const checked = selectedBrandIds.includes(brand.id);
                    return (
                      <label key={brand.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#404040" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedBrandIds((current) => {
                              if (event.target.checked) {
                                return [...current, brand.id];
                              }
                              return current.filter((brandId) => brandId !== brand.id);
                            });
                          }}
                        />
                        {brand.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                style={{ border: "none", borderRadius: "8px", padding: "10px 14px", backgroundColor: "#0A0A0A", color: "#FAFAFA", fontSize: "13px", fontWeight: 500, cursor: "pointer", opacity: createMutation.isPending ? 0.6 : 1 }}
              >
                {createMutation.isPending ? "Creating..." : "Save dealer"}
              </button>
            </form>
          </Modal>
        </RoleGate>

        <RoleGate allowedRoles={["owner"]}>
          <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit dealer">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(null);
                setErrorMessage(null);
                if (!name.trim()) {
                  setErrorMessage("Dealer name is required.");
                  return;
                }
                updateMutation.mutate();
              }}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>
                  Dealer name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }}
                  placeholder="Dealer name"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Phone</label>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }}
                  placeholder="Dealer phone"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Linked brands</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", padding: "10px", border: "1px solid #E5E5E5", borderRadius: "8px", maxHeight: "160px", overflowY: "auto" }}>
                  {(brandsQuery.data ?? []).map((brand) => {
                    const checked = editBrandIds.includes(brand.id);
                    return (
                      <label key={brand.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#404040" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setEditBrandIds((current) => {
                              if (event.target.checked) {
                                return [...current, brand.id];
                              }
                              return current.filter((brandId) => brandId !== brand.id);
                            });
                          }}
                        />
                        {brand.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={updateMutation.isPending}
                style={{ border: "none", borderRadius: "8px", padding: "10px 14px", backgroundColor: "#0A0A0A", color: "#FAFAFA", fontSize: "13px", fontWeight: 500, cursor: "pointer", opacity: updateMutation.isPending ? 0.6 : 1 }}
              >
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </form>
          </Modal>
        </RoleGate>
      </section>
    </RoleGate>
  );
}
