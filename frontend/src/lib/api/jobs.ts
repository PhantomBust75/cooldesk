import { apiClient } from "@/lib/api/client";
import type {
  JobDetail,
  JobListItem,
  JobListQuery,
  JobRevisitItem,
  JobListResult,
  JobTimelineItem,
  OwnerOverrideInput,
  RollbackJobStatusInput,
  TransitionJobStatusInput,
  TransitionJobStatusResult,
} from "@/types/jobs";

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function mapJobListItem(row: UnknownRecord): JobListItem {
  const tags: string[] = [];
  if (row.is_chronic === true) tags.push("chronic");
  if (row.is_frequent === true) tags.push("frequent");
  if (row.is_repeat === true) tags.push("repeat");

  return {
    id: asString(row.id),
    type: (asString(row.type) as JobListItem["type"]) || "installation",
    status: asString(row.status),
    source: (asString(row.source) as JobListItem["source"]) || "direct",
    brandId: asNullableString(row.brand_id),
    brandName: asNullableString(row.brand_name),
    dealerId: asNullableString(row.dealer_id),
    dealerName: asNullableString(row.dealer_name),
    customerName: asString(row.customer_name),
    phone: asString(row.phone),
    address: asString(row.address),
    scheduledAt: asNullableString(row.scheduled_at),
    createdAt: asString(row.created_at),
    assignedTechnicianId: asNullableString(row.assigned_technician_id),
    assignedTechnicianName: asNullableString(row.assigned_technician_name),
    version: asNumber(row.version),
    tags,
    amountCollected: typeof row.amount_collected === "number" ? row.amount_collected : typeof row.amount_collected === "string" ? Number(row.amount_collected) || null : null,
    paymentMethodName: asNullableString(row.payment_method_name),
    updatedAt: asString(row.updated_at),
  };
}

function mapJobDetail(row: UnknownRecord): JobDetail {
  const paymentRecord = asRecord(row.payment);
  const hasPayment = Object.keys(paymentRecord).length > 0;

  const tags: string[] = [];
  if (row.is_chronic === true) tags.push("chronic");
  if (row.is_frequent === true) tags.push("frequent");
  if (row.is_repeat === true) tags.push("repeat");

  return {
    id: asString(row.id),
    type: (asString(row.type) as JobDetail["type"]) || "installation",
    status: asString(row.status),
    source: (asString(row.source) as JobDetail["source"]) || "direct",
    brandId: asNullableString(row.brand_id),
    brandName: asNullableString(row.brand_name),
    dealerId: asNullableString(row.dealer_id),
    dealerName: asNullableString(row.dealer_name),
    customerName: asString(row.customer_name),
    phone: asString(row.phone),
    address: asString(row.address),
    scheduledAt: asNullableString(row.scheduled_at),
    assignedTechnicianId: asNullableString(row.assigned_technician_id),
    assignedTechnicianName: asNullableString(row.assigned_technician_name),
    issueDescription: asNullableString(row.issue_description),
    installationNotes: asNullableString(row.installation_notes),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    version: asNumber(row.version),
    tags,
    payment: hasPayment
      ? {
          id: asString(paymentRecord.id),
          amount: asNumber(paymentRecord.amount),
          paymentMethodId: asNullableString(paymentRecord.payment_method_id),
          paymentMethodName: asNullableString(paymentRecord.payment_method_name),
          status: asString(paymentRecord.status),
          installedBrandId: asNullableString(paymentRecord.installed_brand_id),
          installedBrandName: asNullableString(paymentRecord.installed_brand_name),
          installationCharge:
            paymentRecord.installation_charge == null
              ? null
              : asNumber(paymentRecord.installation_charge),
          recordedByName: asNullableString(paymentRecord.recorded_by_name),
          recordedAt: asString(paymentRecord.recorded_at),
          items: Array.isArray(paymentRecord.items)
            ? (paymentRecord.items as Record<string, unknown>[]).map((it) => ({
                id: asString(it.id),
                name: asString(it.name),
                unitPrice: asNumber(it.unit_price),
                quantity: asNumber(it.quantity, 1),
                total: asNumber(it.total),
              }))
            : [],
        }
      : null,
    units: Array.isArray(row.units)
      ? (row.units as UnknownRecord[]).map((unit) => ({
          id: asString(unit.id),
          model: asNullableString(unit.model),
          unitType: asNullableString(unit.unit_type),
          // NUMERIC arrives from pg as a string.
          tonnage: unit.tonnage == null ? null : asNumber(unit.tonnage),
          serialOuter: asNullableString(unit.serial_outer),
          serialInner: asNullableString(unit.serial_inner),
          label: asString(unit.label),
        }))
      : [],
  };
}

function mapTimelineItem(row: UnknownRecord): JobTimelineItem {
  return {
    id: asString(row.id),
    eventType: asString(row.event_type),
    actorUserId: asNullableString(row.actor_user_id),
    actorDealerId: asNullableString(row.actor_dealer_id),
    actorName: asNullableString(row.actor_name),
    previousValue: row.previous_value,
    newValue: row.new_value,
    reason: asNullableString(row.reason),
    occurredAt: asString(row.occurred_at),
  };
}

function mapRevisitItem(row: UnknownRecord): JobRevisitItem {
  return {
    id: asString(row.id),
    sequenceNumber: asNumber(row.sequence_number),
    reason: asString(row.reason),
    customReason: asNullableString(row.custom_reason),
    status: asString(row.status),
    assignedTechnicianName: asNullableString(row.assigned_technician_name),
    createdAt: asString(row.created_at),
  };
}

function asRecord(value: unknown): UnknownRecord {
  if (typeof value === "object" && value !== null) {
    return value as UnknownRecord;
  }

  return {};
}

export async function fetchJobs(filter: JobListQuery = {}): Promise<JobListResult> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.type) params.set("type", filter.type);
  if (filter.technicianId) params.set("technicianId", filter.technicianId);
  if (filter.brandId) params.set("brandId", filter.brandId);
  if (filter.dateFrom) params.set("dateFrom", filter.dateFrom);
  if (filter.dateTo) params.set("dateTo", filter.dateTo);
  if (filter.search) params.set("search", filter.search);
  if (filter.chronicOnly) params.set("chronicOnly", "true");
  params.set("page", String(filter.page ?? 1));
  params.set("limit", String(filter.limit ?? 10));
  const query = params.toString();
  const path = query ? `/office/jobs?${query}` : "/office/jobs";

  const result = await apiClient.get<{
    jobs: UnknownRecord[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    total_pages?: number;
    meta?: UnknownRecord;
  }>(path);

  const meta = asRecord(result.meta);
  const total = asNumber(result.total ?? meta.total, 0);
  const page = asNumber(result.page ?? meta.page, filter.page ?? 1);
  const limit = asNumber(result.limit ?? meta.limit, filter.limit ?? 10);
  const totalPages = asNumber(result.totalPages ?? result.total_pages ?? meta.totalPages ?? meta.total_pages, 1);

  return {
    jobs: result.jobs.map(mapJobListItem),
    total,
    page: {
      page,
      limit,
      totalPages: Math.max(1, totalPages),
    },
  };
}

export async function fetchJobDetail(jobId: string): Promise<JobDetail> {
  const row = await apiClient.get<UnknownRecord>(`/office/jobs/${jobId}`);
  return mapJobDetail(row);
}

export async function fetchJobTimeline(jobId: string, limit = 100): Promise<JobTimelineItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/office/jobs/${jobId}/timeline?limit=${limit}`);
  return rows.map(mapTimelineItem);
}

export function transitionJobStatus(
  jobId: string,
  input: TransitionJobStatusInput,
): Promise<TransitionJobStatusResult> {
  return apiClient.post<TransitionJobStatusResult>(`/office/jobs/${jobId}/transition`, input);
}

export function rollbackJobStatus(jobId: string, input: RollbackJobStatusInput): Promise<TransitionJobStatusResult> {
  return apiClient.post<TransitionJobStatusResult>(`/office/jobs/${jobId}/rollback`, input);
}

export function ownerOverrideJobStatus(jobId: string, input: OwnerOverrideInput): Promise<TransitionJobStatusResult> {
  return apiClient.post<TransitionJobStatusResult>(`/office/jobs/${jobId}/override-status`, input);
}

export async function fetchJobRevisits(jobId: string): Promise<JobRevisitItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/office/jobs/${jobId}/revisits`);
  return rows.map(mapRevisitItem);
}

export function updateJobPayment(
  jobId: string,
  input: { paymentMethodId?: string; amount?: number },
): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/office/jobs/${jobId}/payment`, input);
}

export async function reassignTechnician(
  jobId: string,
  technicianId: string
): Promise<void> {
  await apiClient.post(`/office/jobs/${jobId}/reassign`, {
    technicianId,
    acknowledgeConflict: false,
  });
}
