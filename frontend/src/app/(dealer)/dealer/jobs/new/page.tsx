"use client";

import { createDealerJob, fetchDealerBrands } from "@/lib/api/dealer";
import { ApiError } from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { useSnackbar } from "notistack";

type Step = 1 | 2 | 3;

type FormState = {
  type: "installation" | "complaint";
  brandId: string;
  customerName: string;
  phone: string;
  address: string;
  notes: string;
};

const INITIAL_FORM: FormState = {
  type: "installation",
  brandId: "",
  customerName: "",
  phone: "",
  address: "",
  notes: "",
};

function StepHeader({ current, total }: { current: Step; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "28px" }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((value) => (
        <div key={value} style={{ display: "flex", alignItems: "center", flex: value < total ? 1 : 0 }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 500,
              flexShrink: 0,
              backgroundColor: value < current ? "#065F46" : value === current ? "#0A0A0A" : "#F5F5F5",
              color: value <= current ? "#fff" : "#A3A3A3",
              border: value > current ? "1px solid #E5E5E5" : "none",
            }}
          >
            {value < current ? <CheckCircle size={14} strokeWidth={1.5} /> : value}
          </div>
          {value < total ? (
            <div style={{ flex: 1, height: "2px", backgroundColor: value < current ? "#10B981" : "#E5E5E5", minWidth: "40px" }} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function DealerLogNewJobPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: brands = [] } = useQuery({
    queryKey: ["dealer", "brands"],
    queryFn: fetchDealerBrands,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createDealerJob({
        type: form.type,
        brandId: form.brandId,
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        ...(form.type === "installation" && form.notes.trim() ? { installationNotes: form.notes.trim() } : {}),
        ...(form.type === "complaint" && form.notes.trim() ? { issueDescription: form.notes.trim() } : {}),
      }),
    onSuccess: (data) => {
      enqueueSnackbar("Job created successfully", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dealer", "jobs"] });
      setCreatedJobId(data.jobId);
    },
    onError: (error) => {
      const msg = error instanceof ApiError ? error.message : "Unable to create job.";
      setErrorMessage(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const step1Valid = Boolean(form.type);
  const step2Valid = Boolean(form.customerName.trim() && form.phone.trim() && form.address.trim());
  const step3Valid = Boolean(
    form.brandId &&
      (form.type === "complaint" ? form.notes.trim().length > 0 : true),
  );

  const notesLabel = form.type === "complaint" ? "Issue Description" : "Installation Notes";

  if (createdJobId) {
    return (
      <section style={{ padding: "24px", maxWidth: "720px" }}>
        <div
          style={{
            backgroundColor: "#FAFAFA",
            borderRadius: "12px",
            border: "1px solid #E5E5E5",
            padding: "56px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "9999px",
              backgroundColor: "rgba(16,185,129,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            <CheckCircle size={28} strokeWidth={1.5} color="#10B981" />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 600, color: "#0A0A0A" }}>
            Job created
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#737373" }}>
            Job has been logged successfully.
          </p>
          <div
            style={{
              backgroundColor: "#F9F9F9",
              border: "1px solid #E5E5E5",
              borderRadius: "8px",
              padding: "8px 16px",
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#404040",
              marginBottom: "28px",
              letterSpacing: "0.04em",
            }}
          >
            {createdJobId.slice(0, 8).toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => router.push(`/dealer/jobs/${createdJobId}`)}
              style={{
                padding: "9px 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#0A0A0A",
                color: "#FAFAFA",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              View job <ArrowRight size={13} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatedJobId(null);
                setStep(1);
                setForm(INITIAL_FORM);
                setErrorMessage(null);
              }}
              style={{
                padding: "9px 20px",
                borderRadius: "8px",
                border: "1px solid #E5E5E5",
                backgroundColor: "#FAFAFA",
                color: "#404040",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Log another job
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "24px", maxWidth: "720px" }}>
      <div style={{ marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => router.push("/dealer/jobs")}
          style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#525252", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "12px" }}
        >
          <ArrowLeft size={13} strokeWidth={1.5} /> Back to jobs
        </button>
        <h1 style={{ fontSize: "18px", fontWeight: 600, color: "#171717", margin: 0 }}>Log new job</h1>
        <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>Step {step} of 3</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (step === 3 && step3Valid) createMutation.mutate(); }}
        style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "24px" }}
      >
        <StepHeader current={step} total={3} />

        {/* Step 1: Job type */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#171717", marginBottom: "20px", marginTop: 0 }}>
              Job type
            </h2>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#525252", display: "block", marginBottom: "5px" }}>
                Job type <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                {(["installation", "complaint"] as const).map((type) => (
                  <label
                    key={type}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "14px 16px",
                      border: form.type === type ? "1.5px solid #0A0A0A" : "1px solid #E5E5E5",
                      borderRadius: "10px",
                      cursor: "pointer",
                      backgroundColor: form.type === type ? "#FAFAFA" : "#fff",
                    }}
                  >
                    <input
                      type="radio"
                      name="jobType"
                      value={type}
                      checked={form.type === type}
                      onChange={() => setForm((f) => ({ ...f, type }))}
                      style={{ display: "none" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: form.type === type ? 500 : 400, color: form.type === type ? "#0A0A0A" : "#525252", textTransform: "capitalize" }}>
                      {type}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Customer identity */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#171717", marginBottom: "20px", marginTop: 0 }}>
              Customer identity
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "#525252", display: "block", marginBottom: "5px" }}>
                  Primary phone <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+92 300 0000000"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#171717", fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "#525252", display: "block", marginBottom: "5px" }}>
                  Customer name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#171717", fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "#525252", display: "block", marginBottom: "5px" }}>
                  Address <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#171717", fontFamily: "inherit" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Job details */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#171717", marginBottom: "20px", marginTop: 0 }}>
              Job details
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "#525252", display: "block", marginBottom: "5px" }}>
                  Brand <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  value={form.brandId}
                  onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: form.brandId ? "#171717" : "#A3A3A3" }}
                >
                  <option value="">Select brand…</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "#525252", display: "block", marginBottom: "5px" }}>
                  {notesLabel}
                  {form.type === "complaint" ? <span style={{ color: "#EF4444" }}> *</span> : <span style={{ color: "#A3A3A3", fontWeight: 400 }}> (optional)</span>}
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#171717", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                />
              </div>

              {errorMessage && (
                <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "13px" }}>
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #E5E5E5" }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", cursor: "pointer", fontSize: "13px", color: "#404040" }}
            >
              <ArrowLeft size={13} strokeWidth={1.5} /> Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "none",
                backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px",
                opacity: (step === 1 && !step1Valid) || (step === 2 && !step2Valid) ? 0.45 : 1,
              }}
            >
              Next <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!step3Valid || createMutation.isPending}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "none",
                backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px",
                opacity: !step3Valid || createMutation.isPending ? 0.45 : 1,
              }}
            >
              {createMutation.isPending ? "Creating…" : "Create job"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
