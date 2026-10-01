import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppShell } from '@/core/components/AppShell/AppShell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { MultiCamPage } from '@/features/multicam/MultiCamPage';
import { RecordsPage } from '@/features/records/RecordsPage';
import { RecordDetailPage } from '@/features/records/RecordDetailPage';
import { AddSuspectPage } from '@/features/records/AddSuspectPage';
import { AddDronePage } from '@/features/drones/AddDronePage';
import { PlaybackPage } from '@/features/playback/PlaybackPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppShell fullBleed>
        <DashboardPage />
      </AppShell>
    ),
  },
  {
    path: '/multicam',
    element: (
      <AppShell fullBleed>
        <MultiCamPage />
      </AppShell>
    ),
  },
  {
    path: '/records',
    element: (
      <AppShell>
        <RecordsPage />
      </AppShell>
    ),
  },
  {
    path: '/records/new',
    element: (
      <AppShell>
        <AddSuspectPage />
      </AppShell>
    ),
  },
  {
    path: '/records/:id',
    element: (
      <AppShell>
        <RecordDetailPage />
      </AppShell>
    ),
  },
  {
    path: '/drones/new',
    element: (
      <AppShell>
        <AddDronePage />
      </AppShell>
    ),
  },
  {
    path: '/playback',
    element: (
      <AppShell>
        <PlaybackPage />
      </AppShell>
    ),
  },
  {
    path: '/notifications',
    element: (
      <AppShell>
        <NotificationsPage />
      </AppShell>
    ),
  },
  {
    path: '/settings',
    element: (
      <AppShell>
        <SettingsPage />
      </AppShell>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
