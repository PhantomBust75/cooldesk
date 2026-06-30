export type PendingScheduleJob = {
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
  technicianId: string | null;
  createdAt: string;
  version: number;
};

export type CustomerLookupResult = {
  phone: string;
  vcid: string;
  customerName: string;
  address: string;
  jobId: string;
  createdAt: string;
};

export type OfficeTechnician = {
  id: string;
  name: string;
  activeAssignments: number;
};

export type SchedulePendingJobInput = {
  scheduledAt: string;
  expectedVersion: number;
  technicianId?: string;
  acknowledgeConflict?: boolean;
};

export type SchedulePendingJobResult = {
  ok: true;
  status: string;
  version: number;
  conflictJobIds?: string[];
};
