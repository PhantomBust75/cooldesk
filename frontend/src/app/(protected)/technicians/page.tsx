"use client";

import { Avatar } from "@/components/ui/avatar";
import { StatusToggle } from "@/components/ui/status-toggle";
import { RoleGate } from "@/components/auth/role-gate";
import { TechnicianDetailPanel } from "@/components/technicians/TechnicianDetailPanel";
import { ApiError } from "@/lib/api/client";
import { createOfficeTechnician, fetchTechnicianDirectory, toggleTechnicianActive, updateOfficeTechnician } from "@/lib/api/operations";
import { TechnicianDirectoryItem } from "@/types/operations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Copy, Edit, Eye, EyeOff, Plus, Save, Search, X } from "lucide-react";
import { useSnackbar } from "notistack";
import { FormEvent, useMemo, useState } from "react";
import { useMobileBreakpoint } from "@/hooks/use-mobile-breakpoint";

export default function TechniciansPage() {
  const queryClient = useQueryClient();
  const isMobile = useMobileBreakpoint();
  const { enqueueSnackbar } = useSnackbar();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<TechnicianDirectoryItem | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianDirectoryItem | null>(null);
  const [search, setSearch] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

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

  const activeTechnicians = useMemo(
    () => (techniciansQuery.data ?? []).filter((t) => t.isActive).length,
    [techniciansQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: () => createOfficeTechnician({ fullName: fullName.trim(), email: email.trim(), password }),
    onSuccess: () => {
      enqueueSnackbar("Technician created successfully", { variant: "success" });
      setMessage("Technician created.");
      setErrorMessage(null);
      setFullName("");
      setEmail("");
      setPassword("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["technicians", "directory"] });
    },
    onError: (error) => {
      const msg = error instanceof ApiError ? error.message : "Unable to create technician.";
      setErrorMessage(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleTechnicianActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians", "directory"] });
    },
    onError: () => {
      enqueueSnackbar("Unable to update technician status.", { variant: "error" });
    },
  });

  const editMutation = useMutation({
    mutationFn: (id: string) =>
      updateOfficeTechnician(id, {
        fullName: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        region: editRegion.trim(),
      }),
    onSuccess: () => {
      enqueueSnackbar("Technician updated successfully", { variant: "success" });
      setMessage("Technician updated.");
      setErrorMessage(null);
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["technicians", "directory"] });
    },
    onError: () => {
      enqueueSnackbar("Unable to update technician.", { variant: "error" });
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

  const total = techniciansQuery.data?.length ?? 0;

  return (
    <RoleGate allowedRoles={["owner", "office_staff"]}>
      <section style={{ padding: isMobile ? "16px" : "24px", maxWidth: "1100px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Technicians</h1>
            <p style={{ fontSize: "13px", color: "#737373", margin: "4px 0 0", fontWeight: 400 }}>
              {techniciansQuery.data ? `${activeTechnicians} active · ${total} total` : "Loading..."}
            </p>
          </div>
          <RoleGate allowedRoles={["owner"]}>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px" }}
            >
              <Plus size={14} strokeWidth={1.5} /> Add technician
            </button>
          </RoleGate>
        </div>

        <div style={{ marginBottom: "16px", position: "relative", maxWidth: "320px" }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search technicians"
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
          {techniciansQuery.isLoading ? (
            <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>
              Loading technicians...
            </div>
          ) : null}
          {techniciansQuery.isError ? (
            <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>
              Unable to load technicians.
            </div>
          ) : null}
          {!techniciansQuery.isLoading && !techniciansQuery.isError && filteredTechnicians.length === 0 ? (
            <div style={{ backgroundColor: "#FAFAFA", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "18px", fontSize: "13px", color: "#737373" }}>
              No technicians found.
            </div>
          ) : null}

          {filteredTechnicians.map((technician) => (
            <div
              key={technician.id}
              onClick={() => setSelectedTechnician(technician)}
              style={{
                backgroundColor: '#fff',
                border: '1px solid #E5E5E5',
                borderRadius: '12px',
                padding: isMobile ? '14px 16px' : '18px 20px',
                cursor: 'pointer',
                opacity: technician.isActive ? 1 : 0.6,
                transition: 'box-shadow 140ms, border-color 140ms, opacity 200ms',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: isMobile ? 'wrap' : 'nowrap',
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
              <Avatar name={technician.name} size={40} />
              <span style={{ fontSize: '15px', fontWeight: 500, color: '#171717', flex: 1, minWidth: 0 }}>
                {technician.name}
              </span>

              {/* Desktop: divider + controls inline */}
              {!isMobile && (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ width: '1px', height: '32px', backgroundColor: '#E5E5E5', flexShrink: 0 }} />
                  <RoleGate allowedRoles={["owner"]}>
                    <StatusToggle
                      active={technician.isActive}
                      onToggle={() => toggleMutation.mutate({ id: technician.id, isActive: !technician.isActive })}
                      loading={toggleMutation.isPending}
                    />
                  </RoleGate>
                  <RoleGate allowedRoles={["owner"]}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditTarget(technician); setEditName(technician.name); setEditEmail(technician.email); setEditPhone(technician.phone ?? ""); setEditRegion(technician.region ?? ""); setShowEditPassword(false); setErrorMessage(null); }}
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
              )}

              {/* Mobile: controls below name */}
              {isMobile && (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'flex-end' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <RoleGate allowedRoles={["owner"]}>
                    <StatusToggle
                      active={technician.isActive}
                      onToggle={() => toggleMutation.mutate({ id: technician.id, isActive: !technician.isActive })}
                      loading={toggleMutation.isPending}
                    />
                  </RoleGate>
                  <RoleGate allowedRoles={["owner"]}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditTarget(technician); setEditName(technician.name); setEditEmail(technician.email); setEditPhone(technician.phone ?? ""); setEditRegion(technician.region ?? ""); setShowEditPassword(false); setErrorMessage(null); }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '7px 12px',
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
              )}
            </div>
          ))}
        </div>

        <RoleGate allowedRoles={["owner"]}>
          {showCreate && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999,
              }}
              onClick={() => setShowCreate(false)}
            >
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '520px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  overflow: 'hidden',
                  maxHeight: '90vh',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>Add new technician</div>
                    <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>New account will be set to Active by default</div>
                  </div>
                  <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>
                {/* Body */}
                <form onSubmit={onCreate} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>
                  {errorMessage && (
                    <div style={{ borderRadius: '8px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: '10px 12px', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={13} strokeWidth={1.5} /> {errorMessage}
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>Full name <span style={{ color: '#EF4444' }}>*</span></label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="E.g., Ahmed Al-Rashid" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#171717' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>Email address <span style={{ color: '#EF4444' }}>*</span></label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="ahmed@cooldesk.sa" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#171717' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>Password <span style={{ color: '#EF4444' }}>*</span></label>
                    <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Min 8 characters" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#171717' }} />
                  </div>
                  {/* Footer inside form so submit works */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px', borderTop: '1px solid #E5E5E5', marginTop: '6px' }}>
                    <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: createMutation.isPending ? 0.6 : 1 }}
                    >
                      Create account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </RoleGate>

        <RoleGate allowedRoles={["owner"]}>
          {editTarget && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '24px' }}
              onClick={() => setEditTarget(null)}
            >
              <div
                style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: '20px 24px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#171717' }}>Edit technician</span>
                  <button type="button" onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}>
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>
                {/* Body */}
                <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
                  {errorMessage && (
                    <div style={{ borderRadius: '8px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', padding: '10px 12px', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={13} strokeWidth={1.5} /> {errorMessage}
                    </div>
                  )}

                  {/* Full name */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: '#171717', display: 'block', marginBottom: '6px' }}>
                      Full name <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '14px', color: '#171717', outline: 'none' }}
                    />
                  </div>

                  {/* Phone + Region side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: '#171717', display: 'block', marginBottom: '6px' }}>
                        Phone <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+966 50 111 2233"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '14px', color: '#171717', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: '#171717', display: 'block', marginBottom: '6px' }}>
                        Region / Area <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        value={editRegion}
                        onChange={(e) => setEditRegion(e.target.value)}
                        placeholder="Riyadh"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '14px', color: '#171717', outline: 'none' }}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: '#171717', display: 'block', marginBottom: '6px' }}>
                      Email <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      type="email"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '14px', color: '#171717', outline: 'none' }}
                    />
                  </div>

                  {/* Account credentials */}
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#171717', margin: '0 0 10px' }}>Account credentials</p>
                    <div style={{ border: '1px solid #E5E5E5', borderRadius: '10px', padding: '16px', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Username */}
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Username</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            value={editTarget.email}
                            readOnly
                            style={{ flex: 1, padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#404040', backgroundColor: '#fff', outline: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(editTarget.email)}
                            style={{ padding: '9px', border: '1px solid #E5E5E5', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', lineHeight: 0, color: '#737373', flexShrink: 0 }}
                            title="Copy username"
                          >
                            <Copy size={14} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                      {/* Password */}
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Password</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            value="••••••••••••••••"
                            readOnly
                            type={showEditPassword ? 'text' : 'password'}
                            style={{ flex: 1, padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', color: '#404040', backgroundColor: '#fff', outline: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditPassword((v) => !v)}
                            style={{ padding: '9px', border: '1px solid #E5E5E5', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', lineHeight: 0, color: '#737373', flexShrink: 0 }}
                            title={showEditPassword ? 'Hide password' : 'Show password'}
                          >
                            {showEditPassword ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText('••••••••••••••••')}
                            style={{ padding: '9px', border: '1px solid #E5E5E5', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', lineHeight: 0, color: '#737373', flexShrink: 0 }}
                            title="Copy password"
                          >
                            <Copy size={14} strokeWidth={1.5} />
                          </button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#737373', margin: '8px 0 0' }}>
                          To change the password, use the &quot;Reset password&quot; flow in system settings.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Footer */}
                <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E5E5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => setEditTarget(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
                  <button
                    type="button"
                    disabled={editMutation.isPending}
                    onClick={() => {
                      if (!editName.trim()) {
                        setErrorMessage("Full name is required.");
                        return;
                      }
                      if (!editEmail.trim()) {
                        setErrorMessage("Email is required.");
                        return;
                      }
                      setMessage(null);
                      setErrorMessage(null);
                      editMutation.mutate(editTarget.id);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, opacity: editMutation.isPending ? 0.6 : 1 }}
                  >
                    <Save size={13} strokeWidth={1.5} /> Save changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </RoleGate>
      </section>

      {selectedTechnician && (
        <TechnicianDetailPanel
          technician={selectedTechnician}
          onClose={() => setSelectedTechnician(null)}
        />
      )}
    </RoleGate>
  );
}
