import { create } from 'zustand';
import type { Vehicle, VehicleCategory } from '@/types';
import { mockVehicles } from '@/services/mock/mockData';
import { API_BASE_URL } from '@/lib/apiConfig';

const BACKEND = API_BASE_URL;

export type VehicleFilter = 'all' | 'authorized' | 'watchlist' | 'unknown' | 'recent';

interface VehicleState {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  filter: VehicleFilter;
  searchQuery: string;

  setVehicles: (v: Vehicle[]) => void;
  selectVehicle: (v: Vehicle | string) => void;
  setFilter: (f: VehicleFilter) => void;
  setSearchQuery: (q: string) => void;
  addVehicle: (v: Vehicle) => void;
  deleteVehicle: (id: string) => Promise<void>;
  fetchVehicles: () => Promise<void>;
  filteredVehicles: () => Vehicle[];
}

export const useVehicleStore = create<VehicleState>()((set, get) => ({
  vehicles: mockVehicles,
  selectedVehicle: mockVehicles[0],
  filter: 'all',
  searchQuery: '',

  setVehicles: (vehicles) => set({ vehicles }),

  selectVehicle: (vOrId) => {
    const vehicle =
      typeof vOrId === 'string'
        ? get().vehicles.find((v) => v.id === vOrId) || null
        : vOrId;
    set({ selectedVehicle: vehicle });
  },

  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  addVehicle: (v) =>
    set((state) => ({ vehicles: [v, ...state.vehicles] })),

  deleteVehicle: async (id: string) => {
    try {
      await fetch(`${BACKEND}/api/vehicles/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend delete vehicle failed or offline:', e);
    }
    set((state) => ({
      vehicles: state.vehicles.filter((v) => v.id !== id),
      selectedVehicle: state.selectedVehicle?.id === id ? null : state.selectedVehicle,
    }));
  },

  fetchVehicles: async () => {
    try {
      const resp = await fetch(`${BACKEND}/api/vehicles`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.vehicles && Array.isArray(data.vehicles) && data.vehicles.length > 0) {
          const mapped: Vehicle[] = data.vehicles.map((v: any) => ({
            id: v.id,
            plateNumber: v.plateNumber || v.plate || 'UNKNOWN',
            vehicleName: v.vehicleName || v.makeModel || `${v.vehicleType || 'Vehicle'} (${v.plate})`,
            category: (v.category as VehicleCategory) || (v.status?.toLowerCase() === 'authorized' ? 'authorized' : 'watchlist'),
            speed: v.speedKmh || 30,
            lastSeen: v.lastSeen || 'Just now',
            confidence: v.confidence ? Math.round(v.confidence) : 95,
            trackingId: `TRK-${v.id}`,
            notes: v.notes || `Registered in A.E.G.I.S. fleet`,
            owner: v.owner || v.assignedUnit || 'Command Fleet',
          }));
          set({ vehicles: mapped });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch vehicles from backend, keeping local state:', err);
    }
  },

  filteredVehicles: () => {
    const { vehicles, filter, searchQuery } = get();
    return vehicles.filter((v) => {
      if (filter === 'authorized' && v.category !== 'authorized') return false;
      if (filter === 'watchlist' && v.category !== 'watchlist') return false;
      if (filter === 'unknown' && v.category !== 'unknown') return false;
      if (filter === 'recent') {
        return v.lastSeen.includes('now') || v.lastSeen.includes('m ago');
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${v.id} ${v.vehicleName} ${v.plateNumber} ${v.owner || ''} ${v.notes || ''} ${v.trackingId}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  },
}));
