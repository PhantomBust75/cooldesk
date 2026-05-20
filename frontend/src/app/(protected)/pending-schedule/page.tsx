"use client";

import { JobTypeChip } from "@/components/ui/job-type-chip";
import { SlaCell } from "@/components/ui/sla-cell";
import { ApiError } from "@/lib/api/client";
import {
  fetchOfficeTechnicians,
  fetchPendingScheduleJobs,
  lookupCustomers,
  schedulePendingJob,
} from "@/lib/api/office";
import type { PendingScheduleJob, SchedulePendingJobInput } from "@/types/office";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle, ChevronRight, Clock, Users } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

function toDateTimeLocalValue(value: Date): string {
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}`;
}

function initialScheduleAt(): string {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  return toDateTimeLocalValue(next);
}

function toIsoStringFromLocal(value: string): string {
  const date = new Date(value);
  return date.toISOString();
}

export default function PendingSchedulePage() {
  const queryClient = useQueryClient();

  const [batchMode, setBatchMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupName, setLookupName] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState(initialScheduleAt());
  const [technicianId, setTechnicianId] = useState("");
  const [acknowledgeConflict, setAcknowledgeConflict] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const pendingScheduleQuery = useQuery({
    queryKey: ["office", "pending-schedule"],
    queryFn: () => fetchPendingScheduleJobs(100),
  });

  const techniciansQuery = useQuery({
    queryKey: ["office", "technicians"],
    queryFn: fetchOfficeTechnicians,
  });

  const lookupMutation = useMutation({
    mutationFn: lookupCustomers,
    onError: (error) => {
      if (error instanceof ApiError) {
        setLookupError(error.message);
      } else {
        setLookupError("Unable to fetch customer lookup results.");
      }
    },
    onSuccess: () => {
      setLookupError(null);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ jobId, payload }: { jobId: string; payload: SchedulePendingJobInput }) =>
      schedulePendingJob(jobId, payload),
    onSuccess: (result) => {
      const conflictCount = result.conflictJobIds?.length ?? 0;
      const conflictNote =
        conflictCount > 0
          ? ` Scheduled with ${conflictCount} conflict reference(s) acknowledged.`
          : "";
      setScheduleMessage(`Job updated to ${result.status}.${conflictNote}`);
      setScheduleError(null);
      queryClient.invalidateQueries({ queryKey: ["office", "pending-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["office", "technicians"] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setScheduleError("Version conflict detected. Refresh queue and retry.");
          return;
        }
        setScheduleError(error.message);
        return;
      }
      setScheduleError("Unable to schedule job right now.");
    },
  });

  const queue = useMemo(() => pendingScheduleQuery.data ?? [], [pendingScheduleQuery.data]);
  const now = Date.now();
  const selectedJob = useMemo(
    () => queue.find((job) => job.id === selectedJobId) ?? null,
    [queue, selectedJobId],
  );

  function selectJob(job: PendingScheduleJob) {
    setSelectedJobId(job.id);
    setScheduleMessage(null);
    setScheduleError(null);
  }

  function toggleSelected(jobId: string) {
    setSelectedJobIds((current) => current.includes(jobId) ? current.filter((value) => value !== jobId) : [...current, jobId]);
  }

  function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupError(null);
    const phone = lookupPhone.trim();
    const name = lookupName.trim();

    if (!phone && !name) {
      setLookupError("Enter phone or name to search.");
      return;
    }

    lookupMutation.mutate({
      phone: phone || undefined,
      name: name || undefined,
      limit: 20,
    });
  }

  function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScheduleMessage(null);
    setScheduleError(null);

    if (!selectedJob) {
      setScheduleError("Select a pending job before scheduling.");
      return;
    }

    if (!scheduledAt) {
      setScheduleError("Select a scheduled date/time.");
      return;
    }

    scheduleMutation.mutate({
      jobId: selectedJob.id,
      payload: {
        scheduledAt: toIsoStringFromLocal(scheduledAt),
        expectedVersion: selectedJob.version,
        technicianId: technicianId || undefined,
        acknowledgeConflict,
      },
    });
  }

  return (
    <section style={{ padding: "24px", maxWidth: "1100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "36px", fontWeight: 600, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Pending Schedule</h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>{queue.length} jobs awaiting scheduling</p>
        </div>
        <button
          type="button"
          onClick={() => { setBatchMode((current) => !current); setSelectedJobIds([]); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: `1px solid ${batchMode ? "#0A0A0A" : "#E5E5E5"}`, backgroundColor: batchMode ? "#0A0A0A" : "#fff", color: batchMode ? "#fff" : "#404040", cursor: "pointer", fontSize: "13px" }}
        >
          <Users size={14} strokeWidth={1.5} /> {batchMode ? "Exit batch mode" : "Batch schedule"}
        </button>
      </div>

      {batchMode && selectedJobIds.length > 0 ? (
        <div style={{ marginBottom: "16px", backgroundColor: "#FAFAFA", borderRadius: "8px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E5E5E5" }}>
          <span style={{ fontSize: "13px", color: "#171717", fontWeight: 500 }}>{selectedJobIds.length} job{selectedJobIds.length > 1 ? "s" : ""} selected</span>
          <span style={{ fontSize: "12px", color: "#737373" }}>Batch UI staged; individual scheduling remains active.</span>
        </div>
      ) : null}

      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden", marginBottom: "20px" }}>
        {pendingScheduleQuery.isLoading ? <div style={{ padding: "20px", fontSize: "13px", color: "#737373" }}>Loading queue...</div> : null}
        {pendingScheduleQuery.isError ? <div style={{ padding: "20px", fontSize: "13px", color: "#991B1B" }}>Failed to load pending-schedule jobs.</div> : null}
        {!pendingScheduleQuery.isLoading && queue.length === 0 ? <div style={{ padding: "20px", fontSize: "13px", color: "#737373" }}>No pending-schedule jobs right now.</div> : null}

        {queue.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                {batchMode ? <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "#525252" }}>Select</th> : null}
                {['Customer', 'Type', 'Waiting', 'Created', 'Version', 'Action'].map((heading) => (
                  <th key={heading} style={{ padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "#525252" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.map((job) => {
                const selected = selectedJobId === job.id;
                const days = Math.max(0, Math.floor((now - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24)));

                return (
                  <tr key={job.id} style={{ borderBottom: "1px solid #F5F5F5", backgroundColor: selected ? "#FAFAFA" : "#fff" }}>
                    {batchMode ? (
                      <td style={{ padding: "14px 12px" }}>
                        <input type="checkbox" checked={selectedJobIds.includes(job.id)} onChange={() => toggleSelected(job.id)} />
                      </td>
                    ) : null}
                    <td style={{ padding: "14px 12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#171717" }}>{job.customerName}</div>
                      <div style={{ fontSize: "12px", color: "#737373" }}>{job.address}</div>
                    </td>
                    <td style={{ padding: "14px 12px" }}><JobTypeChip type={job.type} /></td>
                    <td style={{ padding: "14px 12px" }}><SlaCell days={days} type={job.type} /></td>
                    <td style={{ padding: "14px 12px", fontSize: "13px", color: "#404040" }}>{new Date(job.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: "14px 12px", fontSize: "13px", color: "#404040" }}>{job.version}</td>
                    <td style={{ padding: "14px 12px" }}>
                      <button type="button" onClick={() => selectJob(job)} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px", borderRadius: "8px", border: `1px solid ${selected ? "#0A0A0A" : "#E5E5E5"}`, backgroundColor: selected ? "#0A0A0A" : "#fff", color: selected ? "#fff" : "#404040", cursor: "pointer", fontSize: "12px" }}>
                        {selected ? <CheckCircle size={12} strokeWidth={1.5} /> : <ChevronRight size={12} strokeWidth={1.5} />}
                        {selected ? "Selected" : "Schedule"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "#171717" }}>Customer lookup</h3>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#737373" }}>Search by exact phone or customer name.</p>

          <form onSubmit={submitLookup} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: "10px", marginTop: "16px" }}>
            <input type="text" value={lookupPhone} onChange={(event) => setLookupPhone(event.target.value)} placeholder="Phone" style={{ border: "1px solid #E5E5E5", borderRadius: "8px", padding: "8px 10px", fontSize: "13px" }} />
            <input type="text" value={lookupName} onChange={(event) => setLookupName(event.target.value)} placeholder="Customer name" style={{ border: "1px solid #E5E5E5", borderRadius: "8px", padding: "8px 10px", fontSize: "13px" }} />
            <button type="submit" disabled={lookupMutation.isPending} style={{ border: "none", borderRadius: "8px", padding: "8px 12px", backgroundColor: "#0A0A0A", color: "#fff", fontSize: "13px", cursor: "pointer" }}>{lookupMutation.isPending ? "Searching..." : "Search"}</button>
            <button type="button" onClick={() => { setLookupPhone(""); setLookupName(""); lookupMutation.reset(); setLookupError(null); }} style={{ border: "1px solid #E5E5E5", borderRadius: "8px", padding: "8px 12px", backgroundColor: "#fff", color: "#404040", fontSize: "13px", cursor: "pointer" }}>Clear</button>
          </form>

          {lookupError ? <p style={{ marginTop: "12px", fontSize: "13px", color: "#991B1B" }}>{lookupError}</p> : null}
          {lookupMutation.data && lookupMutation.data.length === 0 ? <p style={{ marginTop: "12px", fontSize: "13px", color: "#737373" }}>No customers found for this search.</p> : null}
          {lookupMutation.data && lookupMutation.data.length > 0 ? (
            <div style={{ overflowX: "auto", marginTop: "14px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E5E5E5" }}>
                    {['Customer', 'Phone', 'Address', 'Latest Job'].map((heading) => (
                      <th key={heading} style={{ padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "#525252" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lookupMutation.data.map((row) => (
                    <tr key={`${row.jobId}-${row.phone}`} style={{ borderBottom: "1px solid #F5F5F5" }}>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#404040" }}>{row.customerName}</td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#404040" }}>{row.phone}</td>
                      <td style={{ padding: "12px", fontSize: "13px", color: "#404040" }}>{row.address}</td>
                      <td style={{ padding: "12px", fontSize: "12px", color: "#737373" }}>{row.jobId}<br />{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "20px", alignSelf: "start" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "#171717" }}>Schedule selected job</h3>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#737373" }}>{selectedJob ? `Selected: ${selectedJob.customerName} (${selectedJob.id})` : "Select a queue row to schedule."}</p>

          <form onSubmit={submitSchedule} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
            <div>
              <label htmlFor="scheduledAt" style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Scheduled at</label>
              <div style={{ position: "relative" }}>
                <Calendar size={14} strokeWidth={1.5} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#A3A3A3" }} />
                <input id="scheduledAt" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 32px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }} required />
              </div>
            </div>

            <div>
              <label htmlFor="technician" style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 500, color: "#404040" }}>Technician (optional)</label>
              <select id="technician" value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px" }}>
                <option value="">No technician assignment</option>
                {(techniciansQuery.data ?? []).map((technician) => (
                  <option key={technician.id} value={technician.id}>{technician.name} ({technician.activeAssignments})</option>
                ))}
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#404040" }}>
              <input type="checkbox" checked={acknowledgeConflict} onChange={(event) => setAcknowledgeConflict(event.target.checked)} />
              <Clock size={13} strokeWidth={1.5} /> Acknowledge scheduling conflicts if detected
            </label>

            {scheduleError ? <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "10px 12px", color: "#991B1B", fontSize: "13px" }}>{scheduleError}</div> : null}
            {scheduleMessage ? <div style={{ borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "10px 12px", color: "#166534", fontSize: "13px" }}>{scheduleMessage}</div> : null}

            <button type="submit" disabled={scheduleMutation.isPending || !selectedJob} style={{ width: "100%", border: "none", borderRadius: "8px", padding: "10px 14px", backgroundColor: "#0A0A0A", color: "#fff", fontSize: "13px", fontWeight: 500, cursor: "pointer", opacity: scheduleMutation.isPending || !selectedJob ? 0.5 : 1 }}>
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule Job"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
