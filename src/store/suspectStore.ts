import { create } from 'zustand';
import type { Suspect } from '@/types';
import { apiUrl } from '@/lib/apiConfig';

interface SuspectState {
  suspects: Suspect[];
  selectedSuspect: Suspect | null;
  watchlistOnly: boolean;
  isLoading: boolean;

  setSuspects: (suspects: Suspect[]) => void;
  setSelectedSuspect: (suspect: Suspect | null) => void;
  setWatchlistOnly: (val: boolean) => void;
  addSuspect: (suspect: Suspect) => void;
  updateSuspect: (id: string, updates: Partial<Suspect>) => void;
  deleteSuspect: (id: string) => Promise<boolean>;
  fetchSuspects: () => Promise<void>;
  resetDatabase: () => Promise<boolean>;
}

export const useSuspectStore = create<SuspectState>()((set, get) => ({
  // Start empty — always loaded from backend on boot
  suspects: [],
  selectedSuspect: null,
  watchlistOnly: false,
  isLoading: false,

  setSuspects: (suspects) => set({ suspects }),
  setSelectedSuspect: (suspect) => set({ selectedSuspect: suspect }),
  setWatchlistOnly: (val) => set({ watchlistOnly: val }),
  addSuspect: (suspect) => set((state) => ({ suspects: [...state.suspects, suspect] })),

  updateSuspect: (id, updates) =>
    set((state) => ({
      suspects: state.suspects.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      selectedSuspect:
        state.selectedSuspect?.id === id
          ? { ...state.selectedSuspect, ...updates }
          : state.selectedSuspect,
    })),

  deleteSuspect: async (id: string) => {
    try {
      await fetch(apiUrl(`/api/suspects/${id}`), { method: 'DELETE' });
    } catch (e) {
      console.warn('Could not call DELETE /api/suspects:', e);
    }
    set((state) => ({
      suspects: state.suspects.filter((s) => s.id !== id),
      selectedSuspect: state.selectedSuspect?.id === id ? null : state.selectedSuspect,
    }));
    return true;
  },

  fetchSuspects: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(apiUrl('/api/suspects'));
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.suspects) && data.suspects.length > 0) {
          set({ suspects: data.suspects });
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch suspects from backend, using local state:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  resetDatabase: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(apiUrl('/api/suspects/reset'), { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.suspects)) {
          set({ suspects: data.suspects, selectedSuspect: null });
          return true;
        }
      }
    } catch (err) {
      console.error('Error resetting suspects database:', err);
    } finally {
      set({ isLoading: false });
    }
    // Fallback: clear to empty rather than restoring stale mock data
    set({ suspects: [], selectedSuspect: null });
    return true;
  },
}));

// Hydrate store on boot
if (typeof window !== 'undefined') {
  useSuspectStore.getState().fetchSuspects();
}
