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
  tags: string[];
  amountCollected: number | null;
  paymentMethodName: string | null;
  updatedAt: string;
};

export type JobListFilter = {
  status?: string;
  type?: "installation" | "complaint";
  technicianId?: string;
  brandId?: string;
  dateFrom?: string;
  dateTo?: string;
  chronicOnly?: boolean;
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
  actorName: string | null;
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

export type JobPaymentItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
};

export type JobPaymentInfo = {
  id: string;
  amount: number;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  status: string;
  installedBrandId: string | null;
  installedBrandName: string | null;
  installationCharge: number | null;
  recordedByName: string | null;
  recordedAt: string;
  items: JobPaymentItem[];
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
  tags: string[];
};

export type TransitionJobStatusInput = {
  toStatus: string;
  expectedVersion: number;
  reason?: string;
  paymentAmount?: number;
  paymentMethodId?: string;
  serviceItems?: Array<{
    serviceItemId?: string;
    name: string;
    unitPrice: number;
    quantity: number;
    total: number;
  }>;
  installedBrandId?: string;
  installationCharge?: number;
  paymentStatus?: "collected" | "pending";
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
