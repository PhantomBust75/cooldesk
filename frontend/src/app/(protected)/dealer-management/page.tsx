"use client";

import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { StatusToggle } from "@/components/ui/status-toggle";
import { RoleGate } from "@/components/auth/role-gate";
import { ApiError } from "@/lib/api/client";
import { createDealer, fetchDealerJobs, fetchDealers, fetchOfficeBrands, updateDealer } from "@/lib/api/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, ChevronRight, Pencil, Plus, Search, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
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

  const selectedDealer = useMemo(
    () => (dealersQuery.data ?? []).find((item) => item.id === selectedDealerId) ?? null,
    [selectedDealerId, dealersQuery.data],
  );

  const dealerJobsQuery = useQuery({
    queryKey: ["dealer-jobs", selectedDealerId],
    queryFn: () => fetchDealerJobs(selectedDealerId ?? ""),
    enabled: Boolean(selectedDealerId),
  });

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
    mutationFn: () => {
      if (!selectedDealerId) {
        return Promise.resolve({ ok: true });
      }
      return updateDealer(selectedDealerId, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        brandIds: editBrandIds.length > 0 ? editBrandIds : undefined,
      });
    },
    onSuccess: () => {
      setMessage("Dealer updated.");
      setErrorMessage(null);
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ["dealers", "management"] });
      queryClient.invalidateQueries({ queryKey: ["dealer-jobs", selectedDealerId] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to update dealer.");
      }
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

  return (
    <RoleGate allowedRoles={["owner", "office_staff"]}>
      <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "980px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Dealer Management</h1>
            <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>Dealer network directory scoped to your organization.</p>
          </div>
          <RoleGate allowedRoles={["owner"]}>
            <button type="button" onClick={() => setShowCreate(true)} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px" }}>
              <Plus size={14} strokeWidth={1.5} /> Add dealer
            </button>
          </RoleGate>
        </div>

        <div style={{ marginBottom: "16px", position: "relative", maxWidth: "320px" }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#A3A3A3" }} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dealers" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", backgroundColor: "#fff" }} />
        </div>

        {message ? <div style={{ borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "12px", color: "#166534", fontSize: "13px", marginBottom: "12px" }}>{message}</div> : null}
        {errorMessage ? <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "13px", marginBottom: "12px" }}>{errorMessage}</div> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {dealersQuery.isLoading ? <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>Loading dealers...</div> : null}
          {dealersQuery.isError ? <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>No dealers found.</div> : null}
          {!dealersQuery.isLoading && filteredDealers.length === 0 ? <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373", display: "flex", alignItems: "center", gap: "8px" }}><Building2 size={14} strokeWidth={1.5} /> No dealers found.</div> : null}

          {filteredDealers.map((dealer) => (
            <div
              key={dealer.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDealerId(dealer.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedDealerId(dealer.id);
                }
              }}
              style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={dealer.name} />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{dealer.name}</div>
                  <div style={{ fontSize: "12px", color: "#737373" }}>Phone: {dealer.phone || "—"}</div>
                  <div style={{ fontSize: "12px", color: "#A3A3A3" }}>Created: {dealer.createdAt ? new Date(dealer.createdAt).toLocaleDateString() : "—"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <StatusToggle active={dealer.isActive} onToggle={() => undefined} disabled />
                <RoleGate allowedRoles={["owner"]}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedDealerId(dealer.id);
                      setName(dealer.name);
                      setEmail("");
                      setPhone(dealer.phone || "");
                      setEditBrandIds([]);
                      setShowEdit(true);
                    }}
                    style={{ border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", color: "#404040", padding: "6px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                  >
                    <Pencil size={12} strokeWidth={1.5} />
                    Edit
                  </button>
                </RoleGate>
                <ChevronRight size={16} strokeWidth={1.5} color="#A3A3A3" />
              </div>
            </div>
          ))}
        </div>

        <RoleGate allowedRoles={["owner"]}>
          <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add dealer">
            <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Dealer name <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={name} onChange={(event) => setName(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Dealer name" />
                {!name.trim() && errorMessage ? <div style={{ marginTop: "5px", fontSize: "12px", color: "#EF4444", display: "flex", alignItems: "center", gap: "4px" }}><AlertCircle size={12} strokeWidth={1.5} /> Name is required.</div> : null}
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Email <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Dealer email" type="email" />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Password <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Dealer password" type="password" />
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

              <button type="submit" disabled={createMutation.isPending} style={{ border: "none", borderRadius: "8px", padding: "10px 14px", backgroundColor: "#0A0A0A", color: "#fff", fontSize: "13px", fontWeight: 500, cursor: "pointer", opacity: createMutation.isPending ? 0.6 : 1 }}>
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
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Dealer name <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={name} onChange={(event) => setName(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Dealer name" />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Email</label>
                <input value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Dealer email" type="email" />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Phone</label>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Dealer phone" />
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

              <button type="submit" disabled={updateMutation.isPending} style={{ border: "none", borderRadius: "8px", padding: "10px 14px", backgroundColor: "#0A0A0A", color: "#fff", fontSize: "13px", fontWeight: 500, cursor: "pointer", opacity: updateMutation.isPending ? 0.6 : 1 }}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </form>
          </Modal>
        </RoleGate>

        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "420px",
            height: "100vh",
            backgroundColor: "#fff",
            borderLeft: "1px solid #E5E5E5",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.05)",
            transform: selectedDealer ? "translateX(0)" : "translateX(100%)",
            transition: "transform 220ms ease",
            zIndex: 40,
            padding: "20px",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#171717" }}>Dealer profile</h3>
            <button type="button" onClick={() => setSelectedDealerId(null)} style={{ border: "1px solid #E5E5E5", backgroundColor: "#fff", borderRadius: "8px", width: "28px", height: "28px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {!selectedDealer ? <p style={{ fontSize: "13px", color: "#737373", margin: 0 }}>Select a dealer to view details.</p> : null}

          {selectedDealer ? (
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Avatar name={selectedDealer.name} size={42} />
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#171717" }}>{selectedDealer.name}</div>
                  <div style={{ fontSize: "12px", color: "#737373" }}>Phone: {selectedDealer.phone || "—"}</div>
                </div>
              </div>

              <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", padding: "12px", backgroundColor: "#FAFAFA" }}>
                <div style={{ fontSize: "12px", color: "#737373", marginBottom: "8px" }}>Submitted jobs</div>
                {dealerJobsQuery.isLoading ? <div style={{ fontSize: "12px", color: "#737373" }}>Loading jobs...</div> : null}
                {dealerJobsQuery.isError ? <div style={{ fontSize: "12px", color: "#991B1B" }}>Unable to load dealer jobs.</div> : null}
                {!dealerJobsQuery.isLoading && !dealerJobsQuery.isError && (dealerJobsQuery.data?.length ?? 0) === 0 ? (
                  <div style={{ fontSize: "12px", color: "#737373" }}>No jobs submitted yet.</div>
                ) : null}

                <div style={{ display: "grid", gap: "8px", marginTop: "6px" }}>
                  {dealerJobsQuery.data?.slice(0, 8).map((job) => (
                    <div key={job.id} style={{ border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#fff", padding: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#171717", fontWeight: 600 }}>#{job.id}</span>
                        <span style={{ fontSize: "11px", color: "#737373" }}>{job.status}</span>
                      </div>
                      <div style={{ marginTop: "4px", fontSize: "12px", color: "#404040" }}>{job.customerName}</div>
                      <div style={{ marginTop: "2px", fontSize: "11px", color: "#A3A3A3" }}>{new Date(job.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </RoleGate>
  );
}
