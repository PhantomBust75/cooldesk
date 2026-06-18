"use client";

import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { StatusToggle } from "@/components/ui/status-toggle";
import { RoleGate } from "@/components/auth/role-gate";
import { ApiError } from "@/lib/api/client";
import { createOfficeTechnician, fetchTechnicianDirectory, fetchTechnicianStats } from "@/lib/api/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, Plus, Search, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

export default function TechniciansPage() {
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const techniciansQuery = useQuery({
    queryKey: ["technicians", "directory"],
    queryFn: fetchTechnicianDirectory,
  });

  const filteredTechnicians = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return techniciansQuery.data ?? [];
    }

    return (techniciansQuery.data ?? []).filter((technician) => technician.name.toLowerCase().includes(query));
  }, [search, techniciansQuery.data]);

  const selectedTechnician = useMemo(
    () => (techniciansQuery.data ?? []).find((item) => item.id === selectedTechnicianId) ?? null,
    [selectedTechnicianId, techniciansQuery.data],
  );

  const technicianStatsQuery = useQuery({
    queryKey: ["technician-stats", selectedTechnicianId],
    queryFn: () => fetchTechnicianStats(selectedTechnicianId ?? ""),
    enabled: Boolean(selectedTechnicianId),
  });

  const createMutation = useMutation({
    mutationFn: () => createOfficeTechnician({ fullName: fullName.trim(), email: email.trim(), password }),
    onSuccess: () => {
      setMessage("Technician created.");
      setErrorMessage(null);
      setFullName("");
      setEmail("");
      setPassword("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["technicians", "directory"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create technician.");
      }
    },
  });

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage("Full name, email, and password are required.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <RoleGate allowedRoles={["owner", "office_staff"]}>
      <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "980px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Technicians</h1>
            <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>Organization-scoped technician directory and active workload.</p>
          </div>
          <RoleGate allowedRoles={["owner"]}>
            <button type="button" onClick={() => setShowCreate(true)} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px" }}>
              <Plus size={14} strokeWidth={1.5} /> Add technician
            </button>
          </RoleGate>
        </div>

        <div style={{ marginBottom: "16px", position: "relative", maxWidth: "320px" }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#A3A3A3" }} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search technicians" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", backgroundColor: "#fff" }} />
        </div>

        {message ? <div style={{ borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "12px", color: "#166534", fontSize: "13px", marginBottom: "12px" }}>{message}</div> : null}
        {errorMessage ? <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "13px", marginBottom: "12px" }}>{errorMessage}</div> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {techniciansQuery.isLoading ? <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>Loading technicians...</div> : null}
          {techniciansQuery.isError ? <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>No technicians found.</div> : null}
          {!techniciansQuery.isLoading && filteredTechnicians.length === 0 ? <div style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>No technicians found.</div> : null}

          {filteredTechnicians.map((technician) => (
            <div
              key={technician.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTechnicianId(technician.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedTechnicianId(technician.id);
                }
              }}
              style={{ backgroundColor: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={technician.name} />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#171717" }}>{technician.name}</div>
                  <div style={{ fontSize: "12px", color: "#737373" }}>Assignments: {technician.activeAssignments}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <StatusToggle active={technician.isActive} onToggle={() => undefined} disabled />
                <ChevronRight size={16} strokeWidth={1.5} color="#A3A3A3" />
              </div>
            </div>
          ))}
        </div>

        <RoleGate allowedRoles={["owner"]}>
          <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add technician">
            <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Full name <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Full name" />
                {!fullName.trim() && errorMessage ? <div style={{ marginTop: "5px", fontSize: "12px", color: "#EF4444", display: "flex", alignItems: "center", gap: "4px" }}><AlertCircle size={12} strokeWidth={1.5} /> Full name is required.</div> : null}
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Email <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={email} onChange={(event) => setEmail(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Email" type="email" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Password <span style={{ color: "#EF4444" }}>*</span></label>
                <input value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} placeholder="Password" type="password" />
              </div>
              <button type="submit" disabled={createMutation.isPending} style={{ border: "none", borderRadius: "8px", padding: "10px 14px", backgroundColor: "#0A0A0A", color: "#fff", fontSize: "13px", fontWeight: 500, cursor: "pointer", opacity: createMutation.isPending ? 0.6 : 1 }}>
                {createMutation.isPending ? "Creating..." : "Save technician"}
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
            transform: selectedTechnician ? "translateX(0)" : "translateX(100%)",
            transition: "transform 220ms ease",
            zIndex: 40,
            padding: "20px",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#171717" }}>Technician profile</h3>
            <button type="button" onClick={() => setSelectedTechnicianId(null)} style={{ border: "1px solid #E5E5E5", backgroundColor: "#fff", borderRadius: "8px", width: "28px", height: "28px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {!selectedTechnician ? <p style={{ fontSize: "13px", color: "#737373", margin: 0 }}>Select a technician to view details.</p> : null}

          {selectedTechnician ? (
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Avatar name={selectedTechnician.name} size={42} />
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#171717" }}>{selectedTechnician.name}</div>
                  <div style={{ fontSize: "12px", color: "#737373" }}>Technician ID: {selectedTechnician.id}</div>
                </div>
              </div>

              <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", padding: "12px", backgroundColor: "#FAFAFA" }}>
                <div style={{ fontSize: "12px", color: "#737373", marginBottom: "8px" }}>Current workload</div>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "#171717" }}>{selectedTechnician.activeAssignments}</div>
                <div style={{ fontSize: "12px", color: "#737373" }}>Active assignments</div>
              </div>

              <div style={{ border: "1px solid #E5E5E5", borderRadius: "10px", padding: "12px", backgroundColor: "#FAFAFA" }}>
                <div style={{ fontSize: "12px", color: "#737373", marginBottom: "8px" }}>Performance</div>
                {technicianStatsQuery.isLoading ? <div style={{ fontSize: "12px", color: "#737373" }}>Loading stats...</div> : null}
                {technicianStatsQuery.isError ? <div style={{ fontSize: "12px", color: "#991B1B" }}>Unable to load stats.</div> : null}
                {technicianStatsQuery.data ? (
                  <>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "#171717" }}>{technicianStatsQuery.data.activeJobs}</div>
                    <div style={{ fontSize: "12px", color: "#737373", marginBottom: "6px" }}>Active jobs</div>
                    <div style={{ fontSize: "13px", color: "#404040" }}>
                      Completion rate: {technicianStatsQuery.data.completionRate == null ? "—" : `${technicianStatsQuery.data.completionRate}%`}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </RoleGate>
  );
}
