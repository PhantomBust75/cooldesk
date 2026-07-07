import { apiClient } from "./client";

export type DealerJob = {
  id: string;
  type: string;
  status: string;
  brand_id: string | null;
  brand_name: string | null;
  brand_color: string | null;
  customer_name: string;
  phone: string;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DealerJobDetail = {
  id: string;
  type: string;
  status: string;
  source: string;
  brand_id: string | null;
  brand_name: string | null;
  brand_color: string | null;
  customer_name: string;
  phone: string;
  address: string;
  issue_description: string | null;
  installation_notes: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  technician_name: string | null;
};

export type DealerBrand = {
  id: string;
  name: string;
};

export async function fetchDealerJobs(limit?: number): Promise<DealerJob[]> {
  const params = limit ? `?limit=${limit}` : "";
  return apiClient.get<DealerJob[]>(`/dealer/jobs/history${params}`);
}

export async function fetchDealerJobDetail(jobId: string): Promise<DealerJobDetail> {
  return apiClient.get<DealerJobDetail>(`/dealer/jobs/${jobId}`);
}

export async function fetchDealerBrands(): Promise<DealerBrand[]> {
  return apiClient.get<DealerBrand[]>("/dealer/brands");
}

export async function requestDealerJobCancellation(jobId: string): Promise<void> {
  return apiClient.post(`/dealer/jobs/${jobId}/cancellation-request`, {});
}

export type CreateDealerJobInput = {
  type: "installation" | "complaint";
  brandId: string;
  customerName: string;
  phone: string;
  address: string;
  installationNotes?: string;
  issueDescription?: string;
};

export async function createDealerJob(input: CreateDealerJobInput): Promise<{ jobId: string }> {
  return apiClient.post<{ jobId: string }>("/dealer/jobs", { ...input, source: "via_dealer" });
}
