import { apiClient } from "@/lib/api/client";
import type {
  CustomerLookupResult,
  OfficeTechnician,
  PendingScheduleJob,
  SchedulePendingJobInput,
  SchedulePendingJobResult,
} from "@/types/office";

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function mapPendingScheduleJob(row: UnknownRecord): PendingScheduleJob {
  return {
    id: asString(row.id),
    type: (asString(row.type) as PendingScheduleJob["type"]) || "installation",
    status: asString(row.status),
    source: (asString(row.source) as PendingScheduleJob["source"]) || "via_dealer",
    brandId: asNullableString(row.brand_id),
    dealerId: asNullableString(row.dealer_id),
    customerName: asString(row.customer_name),
    phone: asString(row.phone),
    address: asString(row.address),
    scheduledAt: asNullableString(row.scheduled_at),
    createdAt: asString(row.created_at),
    version: asNumber(row.version),
  };
}

function mapLookupResult(row: UnknownRecord): CustomerLookupResult {
  return {
    phone: asString(row.phone),
    vcid: asString(row.vcid),
    customerName: asString(row.customer_name),
    address: asString(row.address),
    jobId: asString(row.job_id),
    createdAt: asString(row.created_at),
  };
}

function mapTechnician(row: UnknownRecord): OfficeTechnician {
  return {
    id: asString(row.id),
    name: asString(row.name),
    activeAssignments: asNumber(row.active_assignments),
  };
}

export async function fetchPendingScheduleJobs(limit = 100): Promise<PendingScheduleJob[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/office/jobs/pending-schedule?limit=${limit}`);
  return rows.map(mapPendingScheduleJob);
}

export async function fetchOfficeTechnicians(): Promise<OfficeTechnician[]> {
  const rows = await apiClient.get<UnknownRecord[]>("/office/technicians");
  return rows.map(mapTechnician);
}

export async function schedulePendingJob(
  jobId: string,
  input: SchedulePendingJobInput,
): Promise<SchedulePendingJobResult> {
  return apiClient.post<SchedulePendingJobResult>(`/office/jobs/${jobId}/schedule`, input);
}

export async function lookupCustomers(input: {
  phone?: string;
  name?: string;
  limit?: number;
}): Promise<CustomerLookupResult[]> {
  const params = new URLSearchParams();
  if (input.phone) {
    params.set("phone", input.phone);
  }
  if (input.name) {
    params.set("name", input.name);
  }
  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const query = params.toString();
  const path = query ? `/office/customers/lookup?${query}` : "/office/customers/lookup";
  const rows = await apiClient.get<UnknownRecord[]>(path);
  return rows.map(mapLookupResult);
}
