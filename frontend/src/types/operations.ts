export type QuickCreateJobInput = {
  type: "installation" | "complaint";
  source: "direct" | "via_dealer";
  brandId: string;
  customerName: string;
  phone: string;
  address: string;
  issueDescription?: string;
  installationNotes?: string;
  dealerId?: string;
  scheduledAt?: string;
  technicianId?: string;
  units?: Array<{ label: string; notes?: string }>;
};

export type QuickCreateJobResult = {
  id: string;
  status: string;
  version: number;
};

export type TechnicianDirectoryItem = {
  id: string;
  name: string;
  role: "technician";
  isActive: boolean;
  activeAssignments: number;
};

export type TechnicianStats = {
  activeJobs: number;
  completionRate: number | null;
};

export type DealerDirectoryItem = {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  brandIds: string[];
};

export type DealerJobItem = {
  id: string;
  type: "installation" | "complaint";
  status: string;
  customerName: string;
  createdAt: string;
};

export type PaymentMethodItem = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type SystemConfigItem = {
  key: string;
  value: string;
  updatedAt: string;
};

export type AnalyticsOverview = {
  totalJobs: number;
  resolvedOrCompleted: number;
  cancelled: number;
  revisitPending: number;
  avgStarRating: number | null;
};

export type AnalyticsTechnicianItem = {
  technicianId: string;
  technicianName: string;
  totalJobs: number;
  completionRate: number;
  avgStarRating: number | null;
};

export type AnalyticsBrandItem = {
  brandId: string;
  brandName: string;
  totalJobs: number;
  completionRate: number;
};

export type AnalyticsDealerItem = {
  dealerId: string;
  dealerName: string;
  totalJobs: number;
  completionRate: number;
};
