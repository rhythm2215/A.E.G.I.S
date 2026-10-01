import { create } from 'zustand';
import type { VirtualFenceZone } from '@/types';
import { mockVirtualFenceZones } from '@/services/mock/mockData';

interface VirtualFenceState {
  zones: VirtualFenceZone[];
  activeZoneId: string | null;
  isDrawingMode: boolean;
  drawTool: 'polygon' | 'line' | 'restricted_area';
  tempPoints: { x: number; y: number }[];

  setZones: (zones: VirtualFenceZone[]) => void;
  setActiveZoneId: (id: string | null) => void;
  setIsDrawingMode: (active: boolean) => void;
  setDrawTool: (tool: 'polygon' | 'line' | 'restricted_area') => void;
  addTempPoint: (pt: { x: number; y: number }) => void;
  clearTempPoints: () => void;
  saveNewZone: (name: string, color?: string) => void;
  toggleZoneActive: (id: string) => void;
  deleteZone: (id: string) => void;
}

export const useVirtualFenceStore = create<VirtualFenceState>()((set, get) => ({
  zones: mockVirtualFenceZones,
  activeZoneId: mockVirtualFenceZones[0].id,
  isDrawingMode: false,
  drawTool: 'restricted_area',
  tempPoints: [],

  setZones: (zones) => set({ zones }),
  setActiveZoneId: (activeZoneId) => set({ activeZoneId }),
  setIsDrawingMode: (isDrawingMode) => set({ isDrawingMode }),
  setDrawTool: (drawTool) => set({ drawTool }),

  addTempPoint: (pt) =>
    set((state) => ({ tempPoints: [...state.tempPoints, pt] })),

  clearTempPoints: () => set({ tempPoints: [] }),

  saveNewZone: (name: string, color = '#ff562c') => {
    const { tempPoints, drawTool, zones } = get();
    if (tempPoints.length < 2) return;

    const newZone: VirtualFenceZone = {
      id: `VF-${Date.now().toString().slice(-4)}`,
      name: name || `Virtual Zone ${zones.length + 1}`,
      type: drawTool,
      points: tempPoints,
      color,
      active: true,
      alertOnIntrusion: true,
      activeBreaches: 0,
    };

    set({
      zones: [...zones, newZone],
      tempPoints: [],
      isDrawingMode: false,
      activeZoneId: newZone.id,
    });
  },

  toggleZoneActive: (id) =>
    set((state) => ({
      zones: state.zones.map((z) =>
        z.id === id ? { ...z, active: !z.active } : z
      ),
    })),

  deleteZone: (id) =>
    set((state) => ({
      zones: state.zones.filter((z) => z.id !== id),
      activeZoneId: state.activeZoneId === id ? null : state.activeZoneId,
    })),
}));
