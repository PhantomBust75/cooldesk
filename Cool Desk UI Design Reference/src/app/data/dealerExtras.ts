export interface DealerOngoingJob {
  id: string;
  customer: string;
  address: string;
  type: string;
  status: string;
  scheduled: string;
  technician?: string;
}

export interface DealerHistoryJob {
  id: string;
  customer: string;
  type: string;
  status: string;
  date: string;
  amount?: number;
  technician?: string;
}

export interface DealerExtra {
  phone: string;
  website?: string;
  joined: string;
  total_jobs: number;
  completed_jobs: number;
  cancelled_jobs: number;
  avg_job_value: number;
  ongoing: DealerOngoingJob[];
  history: DealerHistoryJob[];
  completion_trend: { month: string; rate: number }[];
  monthly_perf: { month: string; submitted: number; completed: number }[];
}

export const DEALER_EXTRAS: Record<string, DealerExtra> = {
  d1: {
    phone: '+966 11 400 1100',
    website: 'coolair.sa',
    joined: '2022-06-01',
    total_jobs: 64,
    completed_jobs: 58,
    cancelled_jobs: 3,
    avg_job_value: 890,
    ongoing: [
      { id: 'j-CD789012', customer: 'Badr Al-Zahrani', address: '7 Prince Sultan St, Jeddah', type: 'Complaint', status: 'in_process', scheduled: '2025-05-05T11:00:00', technician: 'Mohamed Ibrahim' },
      { id: 'j-AB123456', customer: 'Rania Al-Omari', address: '14 King Fahd Rd, Riyadh', type: 'Installation', status: 'needs_revisit', scheduled: '2025-05-01T09:00:00', technician: 'Ahmed Al-Rashid' },
    ],
    history: [
      { id: 'j-D1001', customer: 'Nasser Al-Harbi', type: 'Installation', status: 'completed', date: '2025-04-29', amount: 950, technician: 'Omar Hassan' },
      { id: 'j-D1002', customer: 'Mona Al-Ghamdi', type: 'Complaint', status: 'resolved', date: '2025-04-24', amount: 310, technician: 'Ahmed Al-Rashid' },
      { id: 'j-D1003', customer: 'Fahad Khalid', type: 'Installation', status: 'completed', date: '2025-04-19', amount: 1050, technician: 'Mohamed Ibrahim' },
      { id: 'j-D1004', customer: 'Reema Al-Otaibi', type: 'Installation', status: 'completed', date: '2025-04-14', amount: 870, technician: 'Omar Hassan' },
      { id: 'j-D1005', customer: 'Bandar Al-Qahtani', type: 'Complaint', status: 'resolved_on_revisit', date: '2025-04-09', amount: 480, technician: 'Khalid Al-Sayed' },
      { id: 'j-D1006', customer: 'Hind Al-Rashid', type: 'Installation', status: 'completed', date: '2025-04-04', amount: 920, technician: 'Ahmed Al-Rashid' },
      { id: 'j-D1007', customer: 'Sami Al-Osaimi', type: 'Complaint', status: 'cancelled', date: '2025-03-30', technician: 'Mohamed Ibrahim' },
      { id: 'j-D1008', customer: 'Lina Hassan', type: 'Installation', status: 'completed', date: '2025-03-25', amount: 1100, technician: 'Omar Hassan' },
    ],
    completion_trend: [
      { month: 'Dec', rate: 88 }, { month: 'Jan', rate: 90 }, { month: 'Feb', rate: 87 },
      { month: 'Mar', rate: 91 }, { month: 'Apr', rate: 93 }, { month: 'May', rate: 91 },
    ],
    monthly_perf: [
      { month: 'Dec', submitted: 11, completed: 10 },
      { month: 'Jan', submitted: 13, completed: 12 },
      { month: 'Feb', submitted: 9, completed: 8 },
      { month: 'Mar', submitted: 12, completed: 11 },
      { month: 'Apr', submitted: 14, completed: 13 },
      { month: 'May', submitted: 5, completed: 4 },
    ],
  },
  d2: {
    phone: '+966 12 500 2200',
    website: 'premiumhvac.sa',
    joined: '2023-01-15',
    total_jobs: 41,
    completed_jobs: 35,
    cancelled_jobs: 4,
    avg_job_value: 760,
    ongoing: [
      { id: 'j-MN789012', customer: 'Hessa Al-Qahtani', address: '19 Al-Andalus, Jeddah', type: 'Complaint', status: 'cancellation_requested', scheduled: '2025-05-04T14:00:00', technician: 'Ahmed Al-Rashid' },
    ],
    history: [
      { id: 'j-D2001', customer: 'Turki Al-Shehri', type: 'Installation', status: 'completed', date: '2025-04-27', amount: 840, technician: 'Omar Hassan' },
      { id: 'j-D2002', customer: 'Sara Bandar', type: 'Complaint', status: 'resolved', date: '2025-04-22', amount: 290, technician: 'Ahmed Al-Rashid' },
      { id: 'j-D2003', customer: 'Adel Al-Mutairi', type: 'Installation', status: 'completed', date: '2025-04-17', amount: 980, technician: 'Mohamed Ibrahim' },
      { id: 'j-D2004', customer: 'Ghaida Al-Harbi', type: 'Complaint', status: 'resolved', date: '2025-04-12', amount: 340, technician: 'Khalid Al-Sayed' },
      { id: 'j-D2005', customer: 'Nawaf Ibrahim', type: 'Installation', status: 'cancelled', date: '2025-04-07' },
      { id: 'j-D2006', customer: 'Dalal Al-Rasheed', type: 'Installation', status: 'completed', date: '2025-04-02', amount: 790, technician: 'Omar Hassan' },
    ],
    completion_trend: [
      { month: 'Dec', rate: 82 }, { month: 'Jan', rate: 84 }, { month: 'Feb', rate: 80 },
      { month: 'Mar', rate: 85 }, { month: 'Apr', rate: 86 }, { month: 'May', rate: 83 },
    ],
    monthly_perf: [
      { month: 'Dec', submitted: 8, completed: 7 },
      { month: 'Jan', submitted: 9, completed: 8 },
      { month: 'Feb', submitted: 7, completed: 6 },
      { month: 'Mar', submitted: 8, completed: 7 },
      { month: 'Apr', submitted: 7, completed: 6 },
      { month: 'May', submitted: 2, completed: 1 },
    ],
  },
  d3: {
    phone: '+966 13 600 3300',
    website: 'gulfclimate.sa',
    joined: '2022-09-20',
    total_jobs: 53,
    completed_jobs: 49,
    cancelled_jobs: 2,
    avg_job_value: 820,
    ongoing: [
      { id: 'j-GH901234', customer: 'Fahad Al-Dosari', address: '88 Corniche Rd, Dammam', type: 'Installation', status: 'assigned', scheduled: '2025-05-06T08:00:00', technician: 'Khalid Al-Sayed' },
    ],
    history: [
      { id: 'j-D3001', customer: 'Wafa Al-Shammari', type: 'Installation', status: 'completed', date: '2025-04-28', amount: 910, technician: 'Omar Hassan' },
      { id: 'j-D3002', customer: 'Khaled Al-Ansari', type: 'Complaint', status: 'resolved', date: '2025-04-23', amount: 350, technician: 'Ahmed Al-Rashid' },
      { id: 'j-D3003', customer: 'Nadia Al-Juhani', type: 'Installation', status: 'completed', date: '2025-04-18', amount: 860, technician: 'Khalid Al-Sayed' },
      { id: 'j-D3004', customer: 'Yazeed Al-Rashid', type: 'Installation', status: 'completed', date: '2025-04-13', amount: 1080, technician: 'Omar Hassan' },
      { id: 'j-D3005', customer: 'Eman Khalid', type: 'Complaint', status: 'resolved_on_revisit', date: '2025-04-08', amount: 420, technician: 'Mohamed Ibrahim' },
      { id: 'j-D3006', customer: 'Saad Al-Otaibi', type: 'Installation', status: 'completed', date: '2025-04-03', amount: 770, technician: 'Ahmed Al-Rashid' },
      { id: 'j-D3007', customer: 'Hala Al-Qahtani', type: 'Installation', status: 'completed', date: '2025-03-29', amount: 930, technician: 'Omar Hassan' },
    ],
    completion_trend: [
      { month: 'Dec', rate: 91 }, { month: 'Jan', rate: 92 }, { month: 'Feb', rate: 90 },
      { month: 'Mar', rate: 93 }, { month: 'Apr', rate: 94 }, { month: 'May', rate: 92 },
    ],
    monthly_perf: [
      { month: 'Dec', submitted: 10, completed: 9 },
      { month: 'Jan', submitted: 11, completed: 10 },
      { month: 'Feb', submitted: 8, completed: 8 },
      { month: 'Mar', submitted: 12, completed: 11 },
      { month: 'Apr', submitted: 10, completed: 10 },
      { month: 'May', submitted: 2, completed: 1 },
    ],
  },
  d4: {
    phone: '+966 25 700 4400',
    joined: '2023-04-10',
    total_jobs: 22,
    completed_jobs: 17,
    cancelled_jobs: 5,
    avg_job_value: 680,
    ongoing: [],
    history: [
      { id: 'j-D4001', customer: 'Amal Al-Zahrani', type: 'Installation', status: 'completed', date: '2025-02-28', amount: 720, technician: 'Ali Mahmoud' },
      { id: 'j-D4002', customer: 'Noor Al-Sayed', type: 'Complaint', status: 'cancelled', date: '2025-02-20' },
      { id: 'j-D4003', customer: 'Faris Ibrahim', type: 'Installation', status: 'completed', date: '2025-02-14', amount: 650, technician: 'Ali Mahmoud' },
      { id: 'j-D4004', customer: 'Reem Al-Harbi', type: 'Complaint', status: 'resolved', date: '2025-02-08', amount: 280, technician: 'Khalid Al-Sayed' },
    ],
    completion_trend: [
      { month: 'Dec', rate: 76 }, { month: 'Jan', rate: 74 }, { month: 'Feb', rate: 77 },
      { month: 'Mar', rate: 0 },  { month: 'Apr', rate: 0 },  { month: 'May', rate: 0 },
    ],
    monthly_perf: [
      { month: 'Dec', submitted: 5, completed: 4 },
      { month: 'Jan', submitted: 6, completed: 4 },
      { month: 'Feb', submitted: 5, completed: 4 },
      { month: 'Mar', submitted: 0, completed: 0 },
      { month: 'Apr', submitted: 0, completed: 0 },
      { month: 'May', submitted: 0, completed: 0 },
    ],
  },
};
