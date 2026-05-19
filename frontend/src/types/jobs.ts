export type JobListItem = {
  id: string;
  type: "installation" | "complaint";
  status: string;
  source: "direct" | "via_dealer";
  brandId: string | null;
  brandName: string | null;
  dealerId: string | null;
  dealerName: string | null;
  customerName: string;
  phone: string;
  address: string;
  scheduledAt: string | null;
  createdAt: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  version: number;
};

export type JobListFilter = {
  status?: string;
  type?: "installation" | "complaint";
  technicianId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type JobListQuery = JobListFilter & {
  search?: string;
  page?: number;
  limit?: number;
};

export type JobListPageMeta = {
  page: number;
  limit: number;
  totalPages: number;
};

export type JobListResult = {
  jobs: JobListItem[];
  total: number;
  page: JobListPageMeta;
};

export type JobTimelineItem = {
  id: string;
  eventType: string;
  actorUserId: string | null;
  actorDealerId: string | null;
  previousValue: unknown;
  newValue: unknown;
  reason: string | null;
  occurredAt: string;
};

export type JobRevisitItem = {
  id: string;
  sequenceNumber: number;
  reason: string;
  customReason: string | null;
  status: string;
  assignedTechnicianName: string | null;
  createdAt: string;
};

export type JobPaymentInfo = {
  id: string;
  amount: number;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  status: string;
  recordedByName: string | null;
  recordedAt: string;
};

export type JobDetail = {
  id: string;
  type: "installation" | "complaint";
  status: string;
  source: "direct" | "via_dealer";
  brandId: string | null;
  brandName: string | null;
  dealerId: string | null;
  dealerName: string | null;
  customerName: string;
  phone: string;
  address: string;
  scheduledAt: string | null;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  issueDescription: string | null;
  installationNotes: string | null;
  payment: JobPaymentInfo | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TransitionJobStatusInput = {
  toStatus: string;
  expectedVersion: number;
  reason?: string;
};

export type TransitionJobStatusResult = {
  ok: true;
  status: string;
  version: number;
};

export type RollbackJobStatusInput = {
  expectedVersion: number;
  reason: string;
};

export type OwnerOverrideInput = {
  toStatus: string;
  expectedVersion: number;
  reason: string;
  paymentDecision?: "retain" | "void";
};
