import { create } from 'zustand';
import type { Notification, NotificationPriority } from '@/types';

interface NotificationState {
  notifications: Notification[];
  activeNotification: Notification | null;
  filterPriority: NotificationPriority | 'all';
  showUnreadOnly: boolean;

  setNotifications: (n: Notification[]) => void;
  addNotification: (n: Notification) => void;
  setActiveNotification: (n: Notification | null) => void;
  acknowledgeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  setFilterPriority: (p: NotificationPriority | 'all') => void;
  setShowUnreadOnly: (v: boolean) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  // Start with empty alerts — only live AI pipeline events populate this
  notifications: [],
  activeNotification: null,
  filterPriority: 'all',
  showUnreadOnly: false,

  setNotifications: (n) => set({ notifications: n }),
  addNotification: (n) =>
    set((state) => ({ notifications: [n, ...state.notifications] })),
  setActiveNotification: (n) => set({ activeNotification: n }),
  acknowledgeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, acknowledged: true, read: true } : n
      ),
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  setFilterPriority: (p) => set({ filterPriority: p }),
  setShowUnreadOnly: (v) => set({ showUnreadOnly: v }),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearAll: () =>
    set({ notifications: [], activeNotification: null }),
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
