import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JobList } from './pages/JobList';
import { JobDetail } from './pages/JobDetail';
import { Analytics } from './pages/Analytics';
import { SystemConfig } from './pages/SystemConfig';
import { DealerManagement } from './pages/DealerManagement';
import { PaymentMethods } from './pages/PaymentMethods';
import { Notifications } from './pages/Notifications';
import { PendingSchedule } from './pages/PendingSchedule';
import { LogNewJob } from './pages/LogNewJob';
import { Technicians } from './pages/Technicians';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', Component: Dashboard },
      { path: 'jobs', Component: JobList },
      { path: 'jobs/:id', Component: JobDetail },
      { path: 'analytics', Component: Analytics },
      { path: 'settings', Component: SystemConfig },
      { path: 'dealers', Component: DealerManagement },
      { path: 'payment-methods', Component: PaymentMethods },
      { path: 'notifications', Component: Notifications },
      { path: 'pending-schedule', Component: PendingSchedule },
      { path: 'log-new-job', Component: LogNewJob },
      { path: 'technicians', Component: Technicians },
    ],
  },
]);
