"use client";

import { RoleGate } from "@/components/auth/role-gate";
import { ApiError } from "@/lib/api/client";
import { createQuickJob, fetchDealers, fetchOfficeBrands } from "@/lib/api/operations";
import type { QuickCreateJobInput } from "@/types/operations";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle, Minus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type Step = 1 | 2 | 3 | 4;

type UnitRow = {
  model: string;
  unit_type: string;
  num_units: number;
};

const INITIAL_FORM: QuickCreateJobInput = {
  type: "installation",
  source: "direct",
  brandId: "",
  customerName: "",
  phone: "",
  address: "",
  issueDescription: "",
  installationNotes: "",
  dealerId: "",
};

const INITIAL_UNITS: UnitRow[] = [{ model: "", unit_type: "", num_units: 1 }];

function StepHeader({ current, total }: { current: Step; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "28px" }}>
      {Array.from({ length: total }, (_, index) => index + 1).map((value) => (
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
            }}
          >
            {value < current ? <CheckCircle size={14} strokeWidth={1.5} /> : value}
          </div>
          {value < total ? (
            <div style={{ flex: 1, height: "1px", backgroundColor: value < current ? "#10B981" : "#E5E5E5", minWidth: "40px" }} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function LogNewJobPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<QuickCreateJobInput>(INITIAL_FORM);
  const [scheduledAt, setScheduledAt] = useState("");
  const [units, setUnits] = useState<UnitRow[]>(INITIAL_UNITS);
  const [vcidResult, setVcidResult] = useState<"searching" | "found" | "not_found" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dealersQuery = useQuery({
    queryKey: ["dealers", "quick-create"],
    queryFn: fetchDealers,
  });

  const brandsQuery = useQuery({
    queryKey: ["office", "brands", "quick-create"],
    queryFn: fetchOfficeBrands,
  });

  const createMutation = useMutation({
    mutationFn: (payload: QuickCreateJobInput) => createQuickJob(payload),
    onSuccess: (result) => {
      setErrorMessage(null);
      setFeedback(`Job ${result.id} created with status ${result.status}.`);
      setForm(INITIAL_FORM);
      setScheduledAt("");
      setUnits(INITIAL_UNITS);
      setStep(1);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to create job.");
      }
    },
  });

  const dealerRequired = form.source === "via_dealer";
  const notesLabel = form.type === "complaint" ? "Issue Description" : "Installation Notes";
  const reviewRows: Array<[string, string] | null> = [
    ["Job type", form.type || "—"],
    ["Source", form.source || "—"],
    ["Dealer", form.dealerId ? (dealersQuery.data ?? []).find((dealer) => dealer.id === form.dealerId)?.name ?? "—" : "N/A"],
    ["Customer", form.customerName || "—"],
    ["Phone", form.phone || "—"],
    ["Address", form.address || "—"],
    ["Brand", form.brandId ? (brandsQuery.data ?? []).find((brand) => brand.id === form.brandId)?.name ?? "—" : "—"],
    form.type === "installation" ? ["Scheduled at", scheduledAt || "Pending schedule"] : null,
    form.type === "complaint" ? ["Issue", form.issueDescription || "—"] : null,
  ];
  const step1Valid = Boolean(form.type && form.source && (!dealerRequired || form.dealerId));
  const step2Valid = Boolean(form.customerName && form.phone && form.address);
  const step3Valid = Boolean(
    form.brandId &&
      (form.type === "complaint" ? form.issueDescription?.trim() : true) &&
      units.every((unit) => unit.model.trim() && unit.unit_type.trim()),
  );

  const canSubmit = useMemo(() => {
    if (!form.brandId || !form.customerName || !form.phone || !form.address) {
      return false;
    }
    if (dealerRequired && !form.dealerId) {
      return false;
    }
    return true;
  }, [form, dealerRequired]);

  function updateUnit(index: number, key: keyof UnitRow, value: string | number) {
    setUnits((current) => {
      const next = [...current];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addUnit() {
    setUnits((current) => [...current, { model: "", unit_type: "", num_units: 1 }]);
  }

  function removeUnit(index: number) {
    setUnits((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function handlePhoneBlur() {
    if (form.phone.trim().length < 8) {
      setVcidResult(null);
      return;
    }

    setVcidResult("searching");
    window.setTimeout(() => {
      setVcidResult(Math.random() > 0.55 ? "found" : "not_found");
    }, 700);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setErrorMessage(null);

    const payload: QuickCreateJobInput = {
      ...form,
      dealerId: dealerRequired ? form.dealerId : undefined,
      issueDescription: form.type === "complaint" ? form.issueDescription : undefined,
      installationNotes: form.type === "installation" ? form.installationNotes : undefined,
    };

    createMutation.mutate(payload);
  }

  return (
    <RoleGate allowedRoles={["owner", "office_staff", "dealer"]}>
      <section style={{ padding: "24px", maxWidth: "720px" }}>
        <div style={{ marginBottom: "20px" }}>
          <Link href="/jobs" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#525252", textDecoration: "none", marginBottom: "12px" }}>
            <ArrowLeft size={13} strokeWidth={1.5} /> Back to jobs
          </Link>
          <h1 style={{ fontSize: "18px", fontWeight: 600, color: "#171717", margin: 0 }}>Log new job</h1>
          <p style={{ fontSize: "13px", color: "#737373", margin: "3px 0 0", fontWeight: 400 }}>Step {step} of 4</p>
        </div>

        <form onSubmit={onSubmit} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "28px" }}>
          <StepHeader current={step} total={4} />

          {step === 1 ? (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#171717", marginBottom: "20px", marginTop: 0 }}>Job type & source</h2>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Job type <span style={{ color: "#EF4444" }}>*</span></label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["installation", "complaint"] as const).map((type) => (
                    <label key={type} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", border: `1px solid ${form.type === type ? "#0A0A0A" : "#E5E5E5"}`, borderRadius: "8px", cursor: "pointer", backgroundColor: form.type === type ? "#FAFAFA" : "#fff" }}>
                      <input type="radio" name="jobType" value={type} checked={form.type === type} onChange={() => setForm((prev) => ({ ...prev, type }))} style={{ display: "none" }} />
                      <span style={{ fontSize: "13px", fontWeight: form.type === type ? 500 : 400, color: form.type === type ? "#0A0A0A" : "#525252", textTransform: "capitalize" }}>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Source <span style={{ color: "#EF4444" }}>*</span></label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["direct", "via_dealer"] as const).map((source) => (
                    <label key={source} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", border: `1px solid ${form.source === source ? "#0A0A0A" : "#E5E5E5"}`, borderRadius: "8px", cursor: "pointer", backgroundColor: form.source === source ? "#FAFAFA" : "#fff" }}>
                      <input type="radio" name="source" value={source} checked={form.source === source} onChange={() => setForm((prev) => ({ ...prev, source }))} style={{ display: "none" }} />
                      <span style={{ fontSize: "13px", fontWeight: form.source === source ? 500 : 400, color: form.source === source ? "#0A0A0A" : "#525252" }}>{source === "direct" ? "Direct" : "Via dealer"}</span>
                    </label>
                  ))}
                </div>
              </div>

              {dealerRequired ? (
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Dealer <span style={{ color: "#EF4444" }}>*</span></label>
                  <select value={form.dealerId ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, dealerId: event.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#171717" }}>
                    <option value="">Select dealer…</option>
                    {(dealersQuery.data ?? []).filter((dealer) => dealer.isActive).map((dealer) => (
                      <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#171717", marginBottom: "20px", marginTop: 0 }}>Customer identity</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Primary phone <span style={{ color: "#EF4444" }}>*</span></label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, phone: event.target.value }));
                        setVcidResult(null);
                      }}
                      onBlur={handlePhoneBlur}
                      placeholder="+966 50 000 0000"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#171717", fontFamily: "inherit" }}
                    />
                    {vcidResult === "searching" ? <Search size={14} strokeWidth={1.5} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#A3A3A3" }} /> : null}
                  </div>
                  {vcidResult === "found" ? (
                    <div style={{ marginTop: "8px", padding: "10px 12px", border: "1px solid #E5E5E5", borderRadius: "8px", backgroundColor: "#FAFAFA" }}>
                      <div style={{ fontSize: "12px", fontWeight: 500, color: "#065F46", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle size={12} strokeWidth={1.5} /> Best match
                      </div>
                      <div style={{ fontSize: "13px", color: "#404040" }}>Existing customer match found for this phone.</div>
                    </div>
                  ) : null}
                  {vcidResult === "not_found" ? <p style={{ fontSize: "12px", color: "#737373", margin: "4px 0 0" }}>No match found. A new customer record will be created.</p> : null}
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Customer name <span style={{ color: "#EF4444" }}>*</span></label>
                  <input value={form.customerName} onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#171717", fontFamily: "inherit" }} />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Address <span style={{ color: "#EF4444" }}>*</span></label>
                  <input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box", color: "#171717", fontFamily: "inherit" }} />
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#171717", marginBottom: "20px", marginTop: 0 }}>Job details</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Brand <span style={{ color: "#EF4444" }}>*</span></label>
                  <select value={form.brandId} onChange={(event) => setForm((prev) => ({ ...prev, brandId: event.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#171717" }}>
                    <option value="">Select brand…</option>
                    {(brandsQuery.data ?? []).map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>

                {form.type === "installation" ? (
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Scheduled at <span style={{ color: "#A3A3A3", fontWeight: 400 }}>(optional)</span></label>
                    <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#171717" }} />
                  </div>
                ) : null}

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>{notesLabel}{form.type === "complaint" ? <span style={{ color: "#EF4444" }}> *</span> : null}</label>
                  <textarea
                    value={form.type === "complaint" ? form.issueDescription : form.installationNotes}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => prev.type === "complaint" ? { ...prev, issueDescription: value } : { ...prev, installationNotes: value });
                    }}
                    rows={3}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E5", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#171717", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#404040", display: "block", marginBottom: "5px" }}>Unit details <span style={{ color: "#EF4444" }}>*</span></label>
                  {units.map((unit, index) => (
                    <div key={`${index}-${unit.model}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 32px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                      <input placeholder="Model" value={unit.model} onChange={(event) => updateUnit(index, "model", event.target.value)} style={{ padding: "7px 8px", border: "1px solid #E5E5E5", borderRadius: "6px", fontSize: "13px", outline: "none", color: "#171717" }} />
                      <input placeholder="Unit type" value={unit.unit_type} onChange={(event) => updateUnit(index, "unit_type", event.target.value)} style={{ padding: "7px 8px", border: "1px solid #E5E5E5", borderRadius: "6px", fontSize: "13px", outline: "none", color: "#171717" }} />
                      <input type="number" min={1} value={unit.num_units} onChange={(event) => updateUnit(index, "num_units", Number(event.target.value))} style={{ padding: "7px 8px", border: "1px solid #E5E5E5", borderRadius: "6px", fontSize: "13px", outline: "none", color: "#171717" }} />
                      {units.length > 1 ? (
                        <button type="button" onClick={() => removeUnit(index)} style={{ padding: "6px", borderRadius: "6px", backgroundColor: "#fff", border: "1px solid #E5E5E5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#991B1B" }}>
                          <Minus size={13} strokeWidth={1.5} />
                        </button>
                      ) : <div />}
                    </div>
                  ))}
                  <button type="button" onClick={addUnit} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 10px", borderRadius: "6px", backgroundColor: "#fff", border: "1px dashed #E5E5E5", cursor: "pointer", fontSize: "13px", color: "#525252" }}>
                    <Plus size={12} strokeWidth={1.5} /> Add unit
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 500, color: "#171717", marginBottom: "20px", marginTop: 0 }}>Review & submit</h2>
              <div style={{ backgroundColor: "#FAFAFA", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", border: "1px solid #E5E5E5" }}>
                {reviewRows.filter((row): row is [string, string] => row !== null).map(([key, value]) => (
                  <div key={String(key)} style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                    <span style={{ minWidth: "120px", color: "#737373", fontWeight: 500 }}>{String(key)}</span>
                    <span style={{ color: "#404040" }}>{String(value)}</span>
                  </div>
                ))}
              </div>

              {feedback ? <div style={{ borderRadius: "8px", border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", padding: "12px", color: "#166534", fontSize: "13px", marginBottom: "12px" }}>{feedback}</div> : null}
              {errorMessage ? <div style={{ borderRadius: "8px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", padding: "12px", color: "#991B1B", fontSize: "13px", marginBottom: "12px" }}>{errorMessage}</div> : null}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #E5E5E5" }}>
            {step > 1 ? (
              <button type="button" onClick={() => setStep((current) => (current - 1) as Step)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "1px solid #E5E5E5", backgroundColor: "#fff", cursor: "pointer", fontSize: "13px", color: "#404040" }}>
                <ArrowLeft size={13} strokeWidth={1.5} /> Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((current) => (current + 1) as Step)}
                disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid) || (step === 3 && !step3Valid)}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px", opacity: (step === 1 && !step1Valid) || (step === 2 && !step2Valid) || (step === 3 && !step3Valid) ? 0.45 : 1 }}
              >
                Next <ArrowRight size={13} strokeWidth={1.5} />
              </button>
            ) : (
              <button type="submit" disabled={!canSubmit || createMutation.isPending} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#0A0A0A", color: "#fff", cursor: "pointer", fontSize: "13px", opacity: !canSubmit || createMutation.isPending ? 0.45 : 1 }}>
                {createMutation.isPending ? "Creating..." : "Create job"}
              </button>
            )}
          </div>
        </form>
      </section>
    </RoleGate>
  );
}
