export interface OngoingJob {
  id: string;
  customer: string;
  address: string;
  type: string;
  status: string;
  scheduled: string;
}

export interface HistoryJob {
  id: string;
  customer: string;
  type: string;
  status: string;
  date: string;
  amount?: number;
  rating?: number;
}

export interface TechExtra {
  phone: string;
  email: string;
  region: string;
  joined: string;
  completed: number;
  cancelled: number;
  avg_resolution_hrs: number;
  ongoing: OngoingJob[];
  history: HistoryJob[];
  rating_trend: { month: string; rating: number }[];
  monthly_perf: { month: string; assigned: number; completed: number; on_time: number }[];
}

export const TECH_EXTRAS: Record<string, TechExtra> = {
  t1: {
    phone: '+966 50 111 2233',
    email: 'ahmed.rashid@cooldesk.sa',
    region: 'Riyadh',
    joined: '2023-03-15',
    completed: 47,
    cancelled: 2,
    avg_resolution_hrs: 2.1,
    ongoing: [
      { id: 'j-AB123456', customer: 'Rania Al-Omari', address: '14 King Fahd Rd, Riyadh', type: 'Installation', status: 'needs_revisit', scheduled: '2025-05-01T09:00:00' },
      { id: 'j-MN789012', customer: 'Hessa Al-Qahtani', address: '19 Al-Andalus, Jeddah', type: 'Complaint', status: 'cancellation_requested', scheduled: '2025-05-04T14:00:00' },
    ],
    history: [
      { id: 'j-ZX001', customer: 'Nora Khalid', type: 'Installation', status: 'completed', date: '2025-04-28', amount: 850, rating: 5 },
      { id: 'j-ZX002', customer: 'Faisal Al-Amir', type: 'Complaint', status: 'resolved', date: '2025-04-25', amount: 320, rating: 4 },
      { id: 'j-ZX003', customer: 'Layla Ibrahim', type: 'Installation', status: 'completed', date: '2025-04-20', amount: 1100, rating: 5 },
      { id: 'j-ZX004', customer: 'Waleed Al-Qahtani', type: 'Complaint', status: 'resolved', date: '2025-04-15', amount: 200, rating: 4 },
      { id: 'j-ZX005', customer: 'Amira Hassan', type: 'Installation', status: 'completed', date: '2025-04-10', amount: 950, rating: 5 },
      { id: 'j-ZX006', customer: 'Khalid Nasser', type: 'Complaint', status: 'resolved_on_revisit', date: '2025-04-05', amount: 450, rating: 3 },
      { id: 'j-ZX007', customer: 'Sarah Al-Rashid', type: 'Installation', status: 'completed', date: '2025-03-30', amount: 780, rating: 5 },
      { id: 'j-ZX008', customer: 'Omar Bandar', type: 'Complaint', status: 'cancelled', date: '2025-03-25' },
    ],
    rating_trend: [
      { month: 'Dec', rating: 4.3 }, { month: 'Jan', rating: 4.4 }, { month: 'Feb', rating: 4.5 },
      { month: 'Mar', rating: 4.4 }, { month: 'Apr', rating: 4.6 }, { month: 'May', rating: 4.6 },
    ],
    monthly_perf: [
      { month: 'Dec', assigned: 8, completed: 7, on_time: 7 },
      { month: 'Jan', assigned: 9, completed: 8, on_time: 7 },
      { month: 'Feb', assigned: 7, completed: 7, on_time: 6 },
      { month: 'Mar', assigned: 10, completed: 9, on_time: 9 },
      { month: 'Apr', assigned: 11, completed: 10, on_time: 9 },
      { month: 'May', assigned: 8, completed: 6, on_time: 6 },
    ],
  },
  t2: {
    phone: '+966 50 222 3344',
    email: 'mohamed.ibrahim@cooldesk.sa',
    region: 'Jeddah',
    joined: '2023-07-01',
    completed: 38,
    cancelled: 3,
    avg_resolution_hrs: 2.6,
    ongoing: [
      { id: 'j-CD789012', customer: 'Badr Al-Zahrani', address: '7 Prince Sultan St, Jeddah', type: 'Complaint', status: 'in_process', scheduled: '2025-05-05T11:00:00' },
    ],
    history: [
      { id: 'j-YY001', customer: 'Sana Al-Ghamdi', type: 'Complaint', status: 'resolved', date: '2025-04-27', amount: 280, rating: 4 },
      { id: 'j-YY002', customer: 'Tariq Al-Harbi', type: 'Installation', status: 'completed', date: '2025-04-22', amount: 920, rating: 4 },
      { id: 'j-YY003', customer: 'Rana Saleh', type: 'Complaint', status: 'resolved', date: '2025-04-18', amount: 350, rating: 5 },
      { id: 'j-YY004', customer: 'Bader Al-Mutairi', type: 'Installation', status: 'completed', date: '2025-04-12', amount: 800, rating: 4 },
      { id: 'j-YY005', customer: 'Ghada Nasser', type: 'Complaint', status: 'resolved_on_revisit', date: '2025-04-07', amount: 400, rating: 3 },
      { id: 'j-YY006', customer: 'Naif Al-Rasheed', type: 'Installation', status: 'completed', date: '2025-04-01', amount: 1050, rating: 4 },
    ],
    rating_trend: [
      { month: 'Dec', rating: 4.0 }, { month: 'Jan', rating: 4.1 }, { month: 'Feb', rating: 4.0 },
      { month: 'Mar', rating: 4.2 }, { month: 'Apr', rating: 4.2 }, { month: 'May', rating: 4.2 },
    ],
    monthly_perf: [
      { month: 'Dec', assigned: 7, completed: 6, on_time: 5 },
      { month: 'Jan', assigned: 8, completed: 7, on_time: 6 },
      { month: 'Feb', assigned: 6, completed: 5, on_time: 5 },
      { month: 'Mar', assigned: 9, completed: 8, on_time: 7 },
      { month: 'Apr', assigned: 8, completed: 7, on_time: 6 },
      { month: 'May', assigned: 6, completed: 5, on_time: 4 },
    ],
  },
  t3: {
    phone: '+966 50 333 4455',
    email: 'khalid.sayed@cooldesk.sa',
    region: 'Dammam',
    joined: '2024-01-10',
    completed: 29,
    cancelled: 4,
    avg_resolution_hrs: 3.0,
    ongoing: [
      { id: 'j-GH901234', customer: 'Fahad Al-Dosari', address: '88 Corniche Rd, Dammam', type: 'Installation', status: 'assigned', scheduled: '2025-05-06T08:00:00' },
    ],
    history: [
      { id: 'j-WW001', customer: 'Maha Al-Otaibi', type: 'Installation', status: 'completed', date: '2025-04-26', amount: 760, rating: 4 },
      { id: 'j-WW002', customer: 'Sami Khalid', type: 'Complaint', status: 'resolved', date: '2025-04-21', amount: 180, rating: 3 },
      { id: 'j-WW003', customer: 'Dalia Hassan', type: 'Installation', status: 'completed', date: '2025-04-16', amount: 890, rating: 4 },
      { id: 'j-WW004', customer: 'Ziad Al-Fahad', type: 'Complaint', status: 'cancelled', date: '2025-04-10' },
      { id: 'j-WW005', customer: 'Lina Omar', type: 'Installation', status: 'completed', date: '2025-04-05', amount: 700, rating: 4 },
    ],
    rating_trend: [
      { month: 'Dec', rating: 3.7 }, { month: 'Jan', rating: 3.8 }, { month: 'Feb', rating: 3.9 },
      { month: 'Mar', rating: 3.9 }, { month: 'Apr', rating: 3.9 }, { month: 'May', rating: 3.9 },
    ],
    monthly_perf: [
      { month: 'Dec', assigned: 6, completed: 5, on_time: 4 },
      { month: 'Jan', assigned: 7, completed: 6, on_time: 5 },
      { month: 'Feb', assigned: 5, completed: 4, on_time: 3 },
      { month: 'Mar', assigned: 7, completed: 6, on_time: 5 },
      { month: 'Apr', assigned: 6, completed: 5, on_time: 4 },
      { month: 'May', assigned: 5, completed: 3, on_time: 3 },
    ],
  },
  t4: {
    phone: '+966 50 444 5566',
    email: 'omar.hassan@cooldesk.sa',
    region: 'Riyadh',
    joined: '2022-11-20',
    completed: 62,
    cancelled: 1,
    avg_resolution_hrs: 1.8,
    ongoing: [
      { id: 'j-IJ567890', customer: 'Nora Al-Shehri', address: '3 Madinah Rd, Jeddah', type: 'Complaint', status: 'needs_revisit', scheduled: '2025-04-29T10:00:00' },
      { id: 'j-OP345678', customer: 'Turki Al-Rasheed', address: '44 Tahlia St, Riyadh', type: 'Installation', status: 'completed', scheduled: '2025-05-05T08:00:00' },
    ],
    history: [
      { id: 'j-VV001', customer: 'Hala Al-Zahrani', type: 'Installation', status: 'completed', date: '2025-04-29', amount: 980, rating: 5 },
      { id: 'j-VV002', customer: 'Saad Al-Dosari', type: 'Complaint', status: 'resolved', date: '2025-04-24', amount: 290, rating: 5 },
      { id: 'j-VV003', customer: 'Reema Khalid', type: 'Installation', status: 'completed', date: '2025-04-19', amount: 1150, rating: 5 },
      { id: 'j-VV004', customer: 'Abdulrahman Sami', type: 'Complaint', status: 'resolved', date: '2025-04-14', amount: 360, rating: 4 },
      { id: 'j-VV005', customer: 'Nadia Omar', type: 'Installation', status: 'completed', date: '2025-04-09', amount: 820, rating: 5 },
      { id: 'j-VV006', customer: 'Fawaz Al-Mutairi', type: 'Complaint', status: 'resolved_on_revisit', date: '2025-04-04', amount: 420, rating: 4 },
      { id: 'j-VV007', customer: 'Tahani Nasser', type: 'Installation', status: 'completed', date: '2025-03-29', amount: 900, rating: 5 },
      { id: 'j-VV008', customer: 'Yousuf Al-Fahad', type: 'Installation', status: 'completed', date: '2025-03-24', amount: 1020, rating: 5 },
    ],
    rating_trend: [
      { month: 'Dec', rating: 4.6 }, { month: 'Jan', rating: 4.7 }, { month: 'Feb', rating: 4.7 },
      { month: 'Mar', rating: 4.8 }, { month: 'Apr', rating: 4.8 }, { month: 'May', rating: 4.8 },
    ],
    monthly_perf: [
      { month: 'Dec', assigned: 10, completed: 10, on_time: 9 },
      { month: 'Jan', assigned: 12, completed: 11, on_time: 11 },
      { month: 'Feb', assigned: 9, completed: 9, on_time: 8 },
      { month: 'Mar', assigned: 13, completed: 12, on_time: 12 },
      { month: 'Apr', assigned: 11, completed: 11, on_time: 10 },
      { month: 'May', assigned: 7, completed: 5, on_time: 5 },
    ],
  },
  t5: {
    phone: '+966 50 555 6677',
    email: 'ali.mahmoud@cooldesk.sa',
    region: 'Makkah',
    joined: '2023-09-01',
    completed: 18,
    cancelled: 6,
    avg_resolution_hrs: 3.4,
    ongoing: [],
    history: [
      { id: 'j-UU001', customer: 'Maryam Al-Harbi', type: 'Installation', status: 'completed', date: '2025-03-15', amount: 700, rating: 4 },
      { id: 'j-UU002', customer: 'Yazeed Bandar', type: 'Complaint', status: 'cancelled', date: '2025-03-10' },
      { id: 'j-UU003', customer: 'Iman Khalid', type: 'Installation', status: 'completed', date: '2025-03-05', amount: 830, rating: 3 },
      { id: 'j-UU004', customer: 'Khaled Al-Rashid', type: 'Complaint', status: 'resolved', date: '2025-02-25', amount: 250, rating: 4 },
    ],
    rating_trend: [
      { month: 'Dec', rating: 3.8 }, { month: 'Jan', rating: 3.6 }, { month: 'Feb', rating: 3.5 },
      { month: 'Mar', rating: 3.5 }, { month: 'Apr', rating: 3.5 }, { month: 'May', rating: 3.5 },
    ],
    monthly_perf: [
      { month: 'Dec', assigned: 5, completed: 3, on_time: 3 },
      { month: 'Jan', assigned: 4, completed: 3, on_time: 2 },
      { month: 'Feb', assigned: 3, completed: 2, on_time: 2 },
      { month: 'Mar', assigned: 4, completed: 3, on_time: 2 },
      { month: 'Apr', assigned: 0, completed: 0, on_time: 0 },
      { month: 'May', assigned: 0, completed: 0, on_time: 0 },
    ],
  },
};
