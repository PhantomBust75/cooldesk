export type OfficeBrand = {
  id: string;
  name: string;
  colorHex?: string;
  installationCharge: number;
  isActive: boolean;
};

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
  email: string;
  phone: string | null;
  region: string | null;
  role: "technician";
  isActive: boolean;
  activeAssignments: number;
  createdAt: string | null;
};

export type TechnicianStats = {
  activeJobs: number;
  completionRate: number | null;
};

export type DealerDirectoryItem = {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone: string;
  region?: string | null;
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
  scheduledAt: string | null;
  address: string | null;
  technicianName: string | null;
  amountCollected: number;
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
  activeJobs: number;
  completedJobs: number;
  totalRevenue: number;
  firstVisitResolutionRate: number | null;
  revisitRate: number | null;
};

export type AnalyticsTechnicianItem = {
  technicianId: string;
  technicianName: string;
  jobsCompleted: number;
  revenueCollected: number;
  firstVisitResolutionRate: number | null;
  avgResolutionMinutes: number | null;
  onTimeRate: number | null;
  avgStarRating: number | null;
};

export type AnalyticsBrandItem = {
  brandId: string;
  brandName: string;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  revenueCollected: number;
  revisitRate: number | null;
};

export type AnalyticsDealerItem = {
  dealerId: string;
  dealerName: string;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  revenueGenerated: number;
};

export type AnalyticsDailyItem = {
  date: string;
  revenue: number;
  total: number;
  completed: number;
};

export type ServiceItem = {
  id: string;
  name: string;
  pricingType: 'fixed' | 'variable';
  unitPrice: number;
  unitLabel: string | null;
  createdAt: string;
};

export type TechnicianJob = {
  id: string;
  customerName: string;
  type: "installation" | "complaint";
  status: string;
  createdAt: string;
  address: string | null;
  scheduledAt: string | null;
  amountCollected: number;
  avgRating: number | null;
};
