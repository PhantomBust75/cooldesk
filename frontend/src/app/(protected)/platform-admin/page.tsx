"use client";

import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle, XCircle, LogOut, Shield } from "lucide-react";

type OrgRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

async function fetchOrganizations(): Promise<OrgRow[]> {
  return apiClient.get<OrgRow[]>("/platform/organizations");
}

async function toggleOrgStatus(id: string, isActive: boolean): Promise<void> {
  await apiClient.patch(`/platform/organizations/${id}`, { isActive });
}

export default function PlatformAdminPage() {
  const { session, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: orgs = [], isLoading, error } = useQuery({
    queryKey: ["platform", "organizations"],
    queryFn: fetchOrganizations,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleOrgStatus(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] }),
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA" }}>
      {/* Header */}
      <header
        style={{
          height: "56px",
          borderBottom: "1px solid #E5E5E5",
          backgroundColor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Shield size={18} strokeWidth={1.5} color="#6366F1" />
          <span style={{ fontSize: "15px", fontWeight: 500, color: "#171717" }}>CoolDesk Platform</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#737373" }}>
            {session?.user.name ?? "Platform Admin"}
          </span>
          <button
            type="button"
            onClick={() => logout()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid #E5E5E5",
              borderRadius: "8px",
              padding: "7px 12px",
              backgroundColor: "#fff",
              color: "#991B1B",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <LogOut size={13} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em" }}>
            Organizations
          </h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "4px 0 0" }}>
            Manage all tenant organizations across the platform
          </p>
        </div>

        {isLoading && (
          <div style={{ color: "#737373", fontSize: "14px" }}>Loading organizations…</div>
        )}

        {error && (
          <div style={{ color: "#991B1B", fontSize: "14px", padding: "12px", backgroundColor: "#FEF2F2", borderRadius: "8px", border: "1px solid #FECACA" }}>
            Failed to load organizations. Check that your session is valid.
          </div>
        )}

        {!isLoading && !error && (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                  {["Organization", "ID", "Status", "Created", "Action"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "12px",
                        color: "#737373",
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#737373", fontSize: "14px" }}>
                      <Building2 size={32} strokeWidth={1} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                      No organizations yet.
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => (
                    <tr key={org.id} style={{ borderBottom: "1px solid #F5F5F5" }}>
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 500, color: "#171717" }}>
                        {org.name}
                      </td>
                      <td style={{ padding: "14px 16px", fontFamily: '"JetBrains Mono", monospace', fontSize: "11px", color: "#737373" }}>
                        {org.id}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: org.is_active ? "#059669" : "#DC2626",
                            backgroundColor: org.is_active ? "#ECFDF5" : "#FEF2F2",
                            borderRadius: "6px",
                            padding: "3px 8px",
                          }}
                        >
                          {org.is_active ? (
                            <CheckCircle size={12} strokeWidth={2} />
                          ) : (
                            <XCircle size={12} strokeWidth={2} />
                          )}
                          {org.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#737373" }}>
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          type="button"
                          disabled={toggleMutation.isPending}
                          onClick={() => toggleMutation.mutate({ id: org.id, isActive: !org.is_active })}
                          style={{
                            border: "1px solid #E5E5E5",
                            borderRadius: "6px",
                            padding: "5px 10px",
                            backgroundColor: "#fff",
                            fontSize: "12px",
                            color: org.is_active ? "#DC2626" : "#059669",
                            cursor: "pointer",
                            opacity: toggleMutation.isPending ? 0.5 : 1,
                          }}
                        >
                          {org.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
