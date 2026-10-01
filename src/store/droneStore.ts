import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Drone, DroneStatus } from '@/types';
import { mockDrones } from '@/services/mock/mockData';
import { apiUrl } from '@/lib/apiConfig';

interface DroneState {
  drones: Drone[];
  selectedDrone: Drone | null;
  droneFilter: DroneStatus | 'all';
  linkedDrones: string[];
  activeCameraSource: string;
  cameraStatus: 'connected' | 'connecting' | 'unavailable' | 'idle';

  setDrones: (drones: Drone[]) => void;
  setSelectedDrone: (drone: Drone | null) => void;
  setDroneFilter: (filter: DroneStatus | 'all') => void;
  updateDroneTelemetry: (id: string, updates: Partial<Drone>) => void;
  addDrone: (drone: Drone) => void;
  linkDrone: (id: string) => void;
  unlinkDrone: (id: string) => void;
  switchCameraSource: (sourceId: string) => Promise<boolean>;
  fetchCameraStatus: () => Promise<void>;

  filteredDrones: () => Drone[];
}

export const useDroneStore = create<DroneState>()(
  subscribeWithSelector((set, get) => ({
    drones: mockDrones,
    selectedDrone: null,
    droneFilter: 'all',
    linkedDrones: [],
    activeCameraSource: 'Laptop Camera',
    cameraStatus: 'connected',

    setDrones: (drones) => set({ drones }),
    setSelectedDrone: (drone) => set({ selectedDrone: drone }),
    setDroneFilter: (filter) => set({ droneFilter: filter }),
    updateDroneTelemetry: (id, updates) =>
      set((state) => ({
        drones: state.drones.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        selectedDrone:
          state.selectedDrone?.id === id
            ? { ...state.selectedDrone, ...updates }
            : state.selectedDrone,
      })),
    addDrone: (drone) => set((state) => ({ drones: [...state.drones, drone] })),
    linkDrone: (id) =>
      set((state) => ({
        linkedDrones: state.linkedDrones.includes(id)
          ? state.linkedDrones
          : [...state.linkedDrones, id],
      })),
    unlinkDrone: (id) =>
      set((state) => ({
        linkedDrones: state.linkedDrones.filter((d) => d !== id),
      })),

    switchCameraSource: async (sourceId: string) => {
      set((state) => ({
        activeCameraSource: sourceId,
        cameraStatus: 'connecting',
        drones: state.drones.map((d) => {
          if (d.id === 'Laptop Camera' || d.id === 'Cam MB') {
            return {
              ...d,
              status: d.id === sourceId ? 'patrol_active' : 'idle',
            };
          }
          return d;
        }),
      }));

      try {
        const res = await fetch(apiUrl('/api/camera/source'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId }),
        });

        if (res.ok) {
          const data = await res.json();
          set({
            activeCameraSource: data.activeSource || sourceId,
            cameraStatus: data.status || 'connected',
          });
          return true;
        } else {
          set({ cameraStatus: 'unavailable' });
          return false;
        }
      } catch (err) {
        console.error('Failed to switch camera source:', err);
        set({ cameraStatus: 'unavailable' });
        return false;
      }
    },

    fetchCameraStatus: async () => {
      try {
        const res = await fetch(apiUrl('/api/camera/status'));
        if (res.ok) {
          const data = await res.json();
          if (data.activeSource) {
            set((state) => ({
              activeCameraSource: data.activeSource,
              cameraStatus: data.status || 'connected',
              drones: state.drones.map((d) => {
                if (d.id === 'Laptop Camera' || d.id === 'Cam MB') {
                  return {
                    ...d,
                    status: d.id === data.activeSource ? 'patrol_active' : 'idle',
                  };
                }
                return d;
              }),
            }));
          }
        }
      } catch (err) {
        // Backend not ready yet, keep defaults
      }
    },

    filteredDrones: () => {
      const { drones, droneFilter } = get();
      if (droneFilter === 'all') return drones;
      return drones.filter((d) => d.status === droneFilter);
    },
  }))
);
