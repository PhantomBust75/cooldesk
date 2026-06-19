import { apiClient } from "@/lib/api/client";
import type {
  AnalyticsBrandItem,
  AnalyticsDealerItem,
  AnalyticsOverview,
  AnalyticsTechnicianItem,
  DealerJobItem,
  DealerDirectoryItem,
  PaymentMethodItem,
  QuickCreateJobInput,
  QuickCreateJobResult,
  SystemConfigItem,
  TechnicianDirectoryItem,
  TechnicianStats,
} from "@/types/operations";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (typeof value === "object" && value !== null) {
    return value as UnknownRecord;
  }

  return {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
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

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function asNullableString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  return null;
}

function mapTechnician(row: UnknownRecord): TechnicianDirectoryItem {
  return {
    id: asString(row.id),
    name: asString(row.name),
    role: "technician",
    isActive: asBoolean(row.is_active, true),
    activeAssignments: asNumber(row.active_assignments),
  };
}

function mapDealer(row: UnknownRecord): DealerDirectoryItem {
  return {
    id: asString(row.id),
    name: asString(row.name),
    phone: asString(row.phone),
    isActive: asBoolean(row.is_active, true),
    createdAt: asString(row.created_at),
    brandIds: Array.isArray(row.brand_ids) ? (row.brand_ids as string[]) : [],
  };
}

function mapPaymentMethod(row: UnknownRecord): PaymentMethodItem {
  return {
    id: asString(row.id),
    name: asString(row.name),
    isActive: asBoolean(row.is_active, true),
    createdAt: asString(row.created_at),
  };
}

function mapSystemConfig(row: UnknownRecord): SystemConfigItem {
  return {
    key: asString(row.key),
    value: asString(row.value),
    updatedAt: asString(row.updated_at),
  };
}

export function createQuickJob(input: QuickCreateJobInput): Promise<QuickCreateJobResult> {
  return apiClient.post<QuickCreateJobResult>("/jobs", input);
}

export async function fetchTechnicianDirectory(): Promise<TechnicianDirectoryItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>("/office/technicians");
  return rows.map(mapTechnician);
}

export async function createOfficeTechnician(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ technicianId: string }> {
  return apiClient.post<{ technicianId: string }>("/office/technicians", input);
}

export async function fetchOfficeBrands(): Promise<Array<{ id: string; name: string; colorHex?: string }>> {
  const rows = await apiClient.get<UnknownRecord[]>("/office/brands");
  return rows.map((row) => ({
    id: asString(row.id),
    name: asString(row.name),
    colorHex: asNullableString(row.color_hex) ?? undefined,
  }));
}

export function createBrand(input: { name: string; colorHex: string }): Promise<{ id: string }> {
  return apiClient.post<{ id: string }>("/office/brands", {
    name: input.name,
    color_hex: input.colorHex,
  });
}

export async function fetchDealers(): Promise<DealerDirectoryItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>("/dealers");
  return rows.map(mapDealer);
}

export function updateDealer(
  dealerId: string,
  input: { isActive?: boolean },
): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/dealers/${dealerId}`, input);
}

export function updateDealerProfile(
  dealerId: string,
  input: { name?: string; phone?: string },
): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/dealers/${dealerId}/profile`, input);
}

export async function fetchDealerBrandIds(dealerId: string): Promise<string[]> {
  const result = await apiClient.get<{ brandIds: string[] }>(`/dealers/${dealerId}/brands`);
  return result.brandIds;
}

export function setDealerBrands(
  dealerId: string,
  brandIds: string[],
): Promise<{ ok: true; brandCount: number }> {
  return apiClient.put<{ ok: true; brandCount: number }>(`/dealers/${dealerId}/brands`, { brandIds });
}

export async function fetchDealerJobs(dealerId: string): Promise<DealerJobItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/dealers/${dealerId}/jobs`);
  return rows.map((row) => ({
    id: asString(row.id),
    type: (asString(row.type) as DealerJobItem["type"]) || "installation",
    status: asString(row.status),
    customerName: asString(row.customer_name),
    createdAt: asString(row.created_at),
  }));
}

export async function createDealer(input: {
  name: string;
  email: string;
  password: string;
  brandIds?: string[];
}): Promise<{ dealerId: string }> {
  return apiClient.post<{ dealerId: string }>("/dealers", input);
}

export async function fetchPaymentMethods(): Promise<PaymentMethodItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>("/payment-methods");
  return rows.map(mapPaymentMethod);
}

export function createPaymentMethod(input: { name: string }): Promise<PaymentMethodItem> {
  return apiClient.post<PaymentMethodItem>("/payment-methods", input);
}

export function setPaymentMethodActive(
  paymentMethodId: string,
  input: { isActive: boolean },
): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/payment-methods/${paymentMethodId}`, input);
}

export function togglePaymentMethod(paymentMethodId: string): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/payment-methods/${paymentMethodId}/toggle`);
}

export async function fetchSystemConfig(): Promise<SystemConfigItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>("/settings/system-config");
  return rows.map(mapSystemConfig);
}

export function updateSystemConfig(input: { key: string; value: string }): Promise<{ ok: true }> {
  return apiClient.patch<{ ok: true }>(`/settings/system-config/${input.key}`, { value: input.value });
}

export async function fetchAnalyticsOverview(days = 30): Promise<AnalyticsOverview> {
  const payload = await apiClient.get<unknown>(`/analytics/business/overview?days=${days}`);
  const row = asRecord(payload);

  return {
    totalJobs: asNumber(row.total_jobs),
    resolvedOrCompleted: asNumber(row.resolved_or_completed),
    cancelled: asNumber(row.cancelled),
    revisitPending: asNumber(row.revisit_pending),
    avgStarRating: asNullableNumber(row.avg_star_rating),
  };
}

export function fetchAnalyticsBusiness(days = 30): Promise<AnalyticsOverview> {
  return fetchAnalyticsOverview(days);
}

export async function fetchAnalyticsTechnicians(days = 30): Promise<AnalyticsTechnicianItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/technicians?days=${days}`);
  return rows.map((row) => ({
    technicianId: asString(row.technician_id),
    technicianName: asString(row.technician_name),
    totalJobs: asNumber(row.total_jobs),
    completionRate: asNumber(row.completion_rate),
    avgStarRating: asNullableNumber(row.avg_star_rating),
  }));
}

export async function fetchAnalyticsBrands(days = 30): Promise<AnalyticsBrandItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/brands?days=${days}`);
  return rows.map((row) => ({
    brandId: asString(row.brand_id),
    brandName: asString(row.brand_name),
    totalJobs: asNumber(row.total_jobs),
    completionRate: asNumber(row.completion_rate),
  }));
}

export async function fetchAnalyticsDealers(days = 30): Promise<AnalyticsDealerItem[]> {
  const rows = await apiClient.get<UnknownRecord[]>(`/analytics/dealers?days=${days}`);
  return rows.map((row) => ({
    dealerId: asString(row.dealer_id),
    dealerName: asString(row.dealer_name),
    totalJobs: asNumber(row.total_jobs),
    completionRate: asNumber(row.completion_rate),
  }));
}

export async function fetchTechnicianStats(technicianId: string): Promise<TechnicianStats> {
  const row = await apiClient.get<UnknownRecord>(`/users/${technicianId}/stats`);
  return {
    activeJobs: asNumber(row.active_jobs),
    completionRate: asNullableNumber(row.completion_rate),
  };
}

export type ReviewTokenDetail = {
  token: string;
  expiresAt: string;
  isSubmitted: boolean;
  jobId: string;
};

export async function fetchReviewToken(token: string): Promise<ReviewTokenDetail> {
  const row = await apiClient.get<UnknownRecord>(`/reviews/public/${token}`, { auth: false });

  return {
    token,
    expiresAt: asString(row.expires_at),
    isSubmitted: asBoolean(row.is_submitted),
    jobId: asString(row.job_id),
  };
}

export function submitReviewToken(input: {
  token: string;
  rating: number;
  comment?: string;
}): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>(`/reviews/public/${input.token}`, {
    rating: input.rating,
    comment: input.comment,
  }, { auth: false });
}
