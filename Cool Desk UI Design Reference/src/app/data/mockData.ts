export type JobStatus =
  | 'pending_schedule'
  | 'scheduled'
  | 'assigned'
  | 'acknowledged'
  | 'in_transit'
  | 'in_process'
  | 'completed'
  | 'new'
  | 'resolved'
  | 'needs_revisit'
  | 'revisit_scheduled'
  | 'resolved_on_revisit'
  | 'cancellation_requested'
  | 'cancelled';

export type JobType = 'installation' | 'complaint';
export type JobSource = 'direct' | 'via_dealer';

export interface Job {
  id: string;
  customer_name: string;
  address: string;
  phone: string;
  type: JobType;
  source: JobSource;
  status: JobStatus;
  brand_id: string;
  brand_name: string;
  brand_color: string | null;
  dealer_id?: string;
  dealer_name?: string;
  scheduled_at?: string;
  created_at: string;
  technician_id?: string;
  technician_name?: string;
  is_repeat: boolean;
  is_frequent: boolean;
  is_chronic: boolean;
  revisit_sequence?: number;
  payment_amount?: number;
  payment_method?: string;
  cancellation_reason?: string;
  issue_description?: string;
  vcid: string;
}

export interface KPIData {
  total_active: number;
  pending_schedule: number;
  amber_alerts: number;
  chronic_jobs: number;
  todays_revenue: number;
  completion_rate: number;
  no_show_count: number;
  revenue_trend: number;
  completion_trend: number;
}

export interface Technician {
  id: string;
  name: string;
  is_active: boolean;
  jobs_assigned: number;
  on_time_rate: number;
  avg_star_rating: number;
}

export interface Brand {
  id: string;
  name: string;
  colour_hex: string | null;
  is_active: boolean;
}

export interface Dealer {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  region: string;
  is_active: boolean;
  brand_ids: string[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  job_id?: string;
  job_ref?: string;
  is_read: boolean;
  created_at: string;
  is_urgent: boolean;
  urgent_color?: 'amber' | 'red';
}

export interface TimelineEvent {
  id: string;
  job_id: string;
  event_type: string;
  occurred_at: string;
  actor: string;
  is_system: boolean;
  previous_value?: string;
  new_value?: string;
  reason?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const mockBrands: Brand[] = [
  { id: 'b1', name: 'Daikin', colour_hex: '#0066CC', is_active: true },
  { id: 'b2', name: 'Carrier', colour_hex: '#E85A1B', is_active: true },
  { id: 'b3', name: 'Midea', colour_hex: '#C8131B', is_active: true },
  { id: 'b4', name: 'LG Electronics', colour_hex: '#A50034', is_active: true },
  { id: 'b5', name: 'Samsung', colour_hex: '#1428A0', is_active: true },
  { id: 'b6', name: 'Gree', colour_hex: '#009B48', is_active: true },
  { id: 'b7', name: 'Haier', colour_hex: '#003087', is_active: false },
];

export const mockTechnicians: Technician[] = [
  { id: 't1', name: 'Ahmed Al-Rashid', is_active: true, jobs_assigned: 8, on_time_rate: 0.91, avg_star_rating: 4.6 },
  { id: 't2', name: 'Mohamed Ibrahim', is_active: true, jobs_assigned: 6, on_time_rate: 0.85, avg_star_rating: 4.2 },
  { id: 't3', name: 'Khalid Al-Sayed', is_active: true, jobs_assigned: 5, on_time_rate: 0.78, avg_star_rating: 3.9 },
  { id: 't4', name: 'Omar Hassan', is_active: true, jobs_assigned: 7, on_time_rate: 0.94, avg_star_rating: 4.8 },
  { id: 't5', name: 'Ali Mahmoud', is_active: false, jobs_assigned: 0, on_time_rate: 0.72, avg_star_rating: 3.5 },
];

export const mockDealers: Dealer[] = [
  { id: 'd1', business_name: 'CoolAir Solutions LLC', contact_name: 'Faisal Al-Harbi', email: 'faisal@coolair.sa', region: 'Riyadh', is_active: true, brand_ids: ['b1', 'b2', 'b3'] },
  { id: 'd2', business_name: 'Premium HVAC Trading', contact_name: 'Tariq Nasser', email: 'tariq@premiumhvac.sa', region: 'Jeddah', is_active: true, brand_ids: ['b4', 'b5'] },
  { id: 'd3', business_name: 'Gulf Climate Systems', contact_name: 'Sami Al-Qahtani', email: 'sami@gulfclimate.sa', region: 'Dammam', is_active: true, brand_ids: ['b1', 'b6'] },
  { id: 'd4', business_name: 'AlMutlaq Cooling', contact_name: 'Ibrahim Al-Mutlaq', email: 'ibrahimm@almutlaq.sa', region: 'Makkah', is_active: false, brand_ids: ['b2'] },
];

export const mockPaymentMethods: PaymentMethod[] = [
  { id: 'pm1', name: 'Cash', is_active: true },
  { id: 'pm2', name: 'Bank Transfer', is_active: true },
  { id: 'pm3', name: 'Credit Card (POS)', is_active: true },
  { id: 'pm4', name: 'STC Pay', is_active: true },
  { id: 'pm5', name: 'Cheque', is_active: false },
];

export const mockJobs: Job[] = [
  {
    id: 'j-AB123456', customer_name: 'Rania Al-Omari', address: '14 King Fahd Road, Riyadh 11411', phone: '+966501234567',
    type: 'installation', source: 'direct', status: 'needs_revisit',
    brand_id: 'b1', brand_name: 'Daikin', brand_color: '#0066CC',
    scheduled_at: '2025-05-01T09:00:00', created_at: '2025-04-28T10:30:00',
    technician_id: 't1', technician_name: 'Ahmed Al-Rashid',
    is_repeat: false, is_frequent: false, is_chronic: true, revisit_sequence: 3,
    vcid: 'vc-00001',
  },
  {
    id: 'j-CD789012', customer_name: 'Badr Al-Zahrani', address: '7 Prince Sultan St, Jeddah 21452', phone: '+966507654321',
    type: 'complaint', source: 'via_dealer', status: 'in_process',
    brand_id: 'b4', brand_name: 'LG Electronics', brand_color: '#A50034',
    dealer_id: 'd1', dealer_name: 'CoolAir Solutions LLC',
    scheduled_at: '2025-05-05T11:00:00', created_at: '2025-05-03T08:00:00',
    technician_id: 't2', technician_name: 'Mohamed Ibrahim',
    is_repeat: true, is_frequent: false, is_chronic: false,
    issue_description: 'Unit making unusual noise and not cooling effectively',
    vcid: 'vc-00002',
  },
  {
    id: 'j-EF345678', customer_name: 'Sara Al-Mutairi', address: '22 Olaya St, Riyadh 12244', phone: '+966509876543',
    type: 'installation', source: 'direct', status: 'pending_schedule',
    brand_id: 'b2', brand_name: 'Carrier', brand_color: '#E85A1B',
    created_at: '2025-05-01T14:00:00',
    is_repeat: false, is_frequent: false, is_chronic: false,
    vcid: 'vc-00003',
  },
  {
    id: 'j-GH901234', customer_name: 'Fahad Al-Dosari', address: '88 Corniche Rd, Dammam 31952', phone: '+966503456789',
    type: 'installation', source: 'via_dealer', status: 'assigned',
    brand_id: 'b5', brand_name: 'Samsung', brand_color: '#1428A0',
    dealer_id: 'd3', dealer_name: 'Gulf Climate Systems',
    scheduled_at: '2025-05-06T08:00:00', created_at: '2025-05-04T09:00:00',
    technician_id: 't3', technician_name: 'Khalid Al-Sayed',
    is_repeat: false, is_frequent: false, is_chronic: false,
    vcid: 'vc-00004',
  },
  {
    id: 'j-IJ567890', customer_name: 'Nora Al-Shehri', address: '3 Madinah Rd, Jeddah 21589', phone: '+966506789012',
    type: 'complaint', source: 'direct', status: 'needs_revisit',
    brand_id: 'b3', brand_name: 'Midea', brand_color: '#C8131B',
    scheduled_at: '2025-04-29T10:00:00', created_at: '2025-04-25T11:00:00',
    technician_id: 't4', technician_name: 'Omar Hassan',
    is_repeat: true, is_frequent: true, is_chronic: false, revisit_sequence: 2,
    issue_description: 'Refrigerant leak suspected — second visit needed',
    vcid: 'vc-00005',
  },
  {
    id: 'j-KL123456', customer_name: 'Abdulaziz Al-Ghamdi', address: '56 Al-Rawdah, Riyadh 14211', phone: '+966512345678',
    type: 'installation', source: 'direct', status: 'scheduled',
    brand_id: 'b1', brand_name: 'Daikin', brand_color: '#0066CC',
    scheduled_at: '2025-05-07T09:00:00', created_at: '2025-05-05T08:00:00',
    is_repeat: false, is_frequent: false, is_chronic: false,
    vcid: 'vc-00006',
  },
  {
    id: 'j-MN789012', customer_name: 'Hessa Al-Qahtani', address: '19 Al-Andalus, Jeddah 23419', phone: '+966518901234',
    type: 'complaint', source: 'via_dealer', status: 'cancellation_requested',
    brand_id: 'b6', brand_name: 'Gree', brand_color: '#009B48',
    dealer_id: 'd2', dealer_name: 'Premium HVAC Trading',
    scheduled_at: '2025-05-04T14:00:00', created_at: '2025-05-02T10:00:00',
    technician_id: 't1', technician_name: 'Ahmed Al-Rashid',
    is_repeat: false, is_frequent: false, is_chronic: false,
    issue_description: 'Unit completely stopped working',
    vcid: 'vc-00007',
  },
  {
    id: 'j-OP345678', customer_name: 'Turki Al-Rasheed', address: '44 Tahlia St, Riyadh 12212', phone: '+966523456789',
    type: 'installation', source: 'direct', status: 'completed',
    brand_id: 'b4', brand_name: 'LG Electronics', brand_color: '#A50034',
    scheduled_at: '2025-05-05T08:00:00', created_at: '2025-05-03T12:00:00',
    technician_id: 't4', technician_name: 'Omar Hassan',
    is_repeat: false, is_frequent: false, is_chronic: false,
    payment_amount: 1200, payment_method: 'Cash',
    vcid: 'vc-00008',
  },
  {
    id: 'j-QR901234', customer_name: 'Mona Al-Harbi', address: '12 Sitteen St, Jeddah 22233', phone: '+966529012345',
    type: 'complaint', source: 'direct', status: 'pending_schedule',
    brand_id: 'b2', brand_name: 'Carrier', brand_color: '#E85A1B',
    created_at: '2025-05-02T09:00:00',
    is_repeat: true, is_frequent: false, is_chronic: false,
    issue_description: 'Thermostat malfunction — temp not regulating',
    vcid: 'vc-00009',
  },
  {
    id: 'j-ST567890', customer_name: 'Waleed Al-Otaibi', address: '91 King Abdullah Rd, Dammam 32231', phone: '+966534567890',
    type: 'installation', source: 'via_dealer', status: 'acknowledged',
    brand_id: 'b3', brand_name: 'Midea', brand_color: '#C8131B',
    dealer_id: 'd3', dealer_name: 'Gulf Climate Systems',
    scheduled_at: '2025-05-05T13:00:00', created_at: '2025-05-04T11:00:00',
    technician_id: 't2', technician_name: 'Mohamed Ibrahim',
    is_repeat: false, is_frequent: false, is_chronic: false,
    vcid: 'vc-00010',
  },
];

export const mockKPI: KPIData = {
  total_active: 8,
  pending_schedule: 2,
  amber_alerts: 2,
  chronic_jobs: 1,
  todays_revenue: 8450,
  completion_rate: 0.87,
  no_show_count: 1,
  revenue_trend: 12.4,
  completion_trend: 3.1,
};

export const mockNotifications: Notification[] = [
  {
    id: 'n1', type: 'needs_revisit_raised', title: 'Needs Revisit — Job #AB123456',
    body: 'Ahmed Al-Rashid flagged job for Rania Al-Omari as needing a revisit (Revisit #3).',
    job_id: 'j-AB123456', job_ref: 'AB123456', is_read: false, created_at: '2025-05-05T10:30:00',
    is_urgent: true, urgent_color: 'amber',
  },
  {
    id: 'n2', type: 'chronic_flagged', title: 'CHRONIC — Job #AB123456',
    body: 'Job for Rania Al-Omari (Daikin) has been flagged as CHRONIC after 3 revisits.',
    job_id: 'j-AB123456', job_ref: 'AB123456', is_read: false, created_at: '2025-05-05T10:31:00',
    is_urgent: true, urgent_color: 'red',
  },
  {
    id: 'n3', type: 'pre_chronic_warning', title: 'Pre-Chronic Warning — Job #IJ567890',
    body: 'Job for Nora Al-Shehri has had 2 revisits. One more will flag it as Chronic.',
    job_id: 'j-IJ567890', job_ref: 'IJ567890', is_read: false, created_at: '2025-05-04T15:00:00',
    is_urgent: true, urgent_color: 'amber',
  },
  {
    id: 'n4', type: 'cancellation_request', title: 'Cancellation Request — Job #MN789012',
    body: 'Premium HVAC Trading has requested cancellation of job for Hessa Al-Qahtani.',
    job_id: 'j-MN789012', job_ref: 'MN789012', is_read: false, created_at: '2025-05-05T09:15:00',
    is_urgent: false,
  },
  {
    id: 'n5', type: 'dealer_job_submitted', title: 'New Dealer Job — Gulf Climate Systems',
    body: 'Gulf Climate Systems submitted a new installation job (Samsung) for Fahad Al-Dosari.',
    job_id: 'j-GH901234', job_ref: 'GH901234', is_read: true, created_at: '2025-05-04T09:00:00',
    is_urgent: false,
  },
  {
    id: 'n6', type: 'low_rating_received', title: 'Low Rating — Job #CD789012',
    body: 'Customer rated 2/5 stars for Job #CD789012 (LG Electronics, Badr Al-Zahrani).',
    job_id: 'j-CD789012', job_ref: 'CD789012', is_read: true, created_at: '2025-05-03T16:00:00',
    is_urgent: true, urgent_color: 'red',
  },
];

export const mockTimeline: TimelineEvent[] = [
  {
    id: 'tl1', job_id: 'j-AB123456', event_type: 'needs_revisit_raised',
    occurred_at: '2025-05-05T10:30:00', actor: 'Ahmed Al-Rashid', is_system: false,
    reason: 'Refrigerant level still low after first fix — part needs replacement',
  },
  {
    id: 'tl2', job_id: 'j-AB123456', event_type: 'chronic_threshold_reached',
    occurred_at: '2025-05-05T10:31:00', actor: 'System', is_system: true,
    new_value: 'is_chronic = TRUE',
  },
  {
    id: 'tl3', job_id: 'j-AB123456', event_type: 'status_changed',
    occurred_at: '2025-05-05T10:29:00', actor: 'Ahmed Al-Rashid', is_system: false,
    previous_value: 'in_process', new_value: 'needs_revisit',
  },
  {
    id: 'tl4', job_id: 'j-AB123456', event_type: 'status_changed',
    occurred_at: '2025-05-05T09:00:00', actor: 'Ahmed Al-Rashid', is_system: false,
    previous_value: 'in_transit', new_value: 'in_process',
  },
  {
    id: 'tl5', job_id: 'j-AB123456', event_type: 'status_changed',
    occurred_at: '2025-05-05T08:45:00', actor: 'Ahmed Al-Rashid', is_system: false,
    previous_value: 'acknowledged', new_value: 'in_transit',
  },
  {
    id: 'tl6', job_id: 'j-AB123456', event_type: 'assigned',
    occurred_at: '2025-05-01T14:00:00', actor: 'Sarah (Office Staff)', is_system: false,
    new_value: 'Ahmed Al-Rashid',
  },
  {
    id: 'tl7', job_id: 'j-AB123456', event_type: 'scheduled',
    occurred_at: '2025-04-29T11:00:00', actor: 'Sarah (Office Staff)', is_system: false,
    previous_value: 'pending_schedule', new_value: 'scheduled',
  },
  {
    id: 'tl8', job_id: 'j-AB123456', event_type: 'job_created',
    occurred_at: '2025-04-28T10:30:00', actor: 'Sarah (Office Staff)', is_system: false,
  },
];

export const SYSTEM_CONFIG = {
  repeat_complaint_window_days: 30,
  frequent_complaint_threshold: 3,
  frequent_complaint_window_days: 90,
  punctuality_grace_period_mins: 15,
  customer_review_mode: 'optional' as 'off' | 'optional' | 'mandatory',
  standard_job_duration_mins: 120,
  pending_schedule_amber_days_installation: 2,
  pending_schedule_red_days_installation: 4,
  pending_schedule_amber_days_complaint: 1,
  pending_schedule_red_days_complaint: 2,
  cancellation_request_escalation_minutes: 30,
};
