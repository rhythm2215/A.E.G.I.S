import { create } from 'zustand';

interface LayoutState {
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  // Left sidebar height split in percentages for [DronePanel, SuspectPanel, TimelinePanel]
  leftRatios: [number, number, number];
  // Right sidebar height split in percentages for [NotificationPanel, DetailPanel]
  rightRatios: [number, number];

  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
  setLeftRatios: (ratios: [number, number, number]) => void;
  setRightRatios: (ratios: [number, number]) => void;
  resetLayout: () => void;
}

const STORAGE_KEY = 'aegis_panel_layout_v1';

function getInitialLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        leftSidebarWidth: typeof parsed.leftSidebarWidth === 'number' ? parsed.leftSidebarWidth : 340,
        rightSidebarWidth: typeof parsed.rightSidebarWidth === 'number' ? parsed.rightSidebarWidth : 360,
        leftRatios: Array.isArray(parsed.leftRatios) && parsed.leftRatios.length === 3 ? parsed.leftRatios : [28, 28, 44],
        rightRatios: Array.isArray(parsed.rightRatios) && parsed.rightRatios.length === 2 ? parsed.rightRatios : [38, 62],
      };
    }
  } catch (e) {
    // fallback
  }
  return {
    leftSidebarWidth: 340,
    rightSidebarWidth: 360,
    leftRatios: [28, 28, 44] as [number, number, number],
    rightRatios: [38, 62] as [number, number],
  };
}

const initial = getInitialLayout();

export const useLayoutStore = create<LayoutState>()((set, get) => ({
  leftSidebarWidth: initial.leftSidebarWidth,
  rightSidebarWidth: initial.rightSidebarWidth,
  leftRatios: initial.leftRatios,
  rightRatios: initial.rightRatios,

  setLeftSidebarWidth: (width) => {
    const clamped = Math.max(260, Math.min(width, 560));
    set({ leftSidebarWidth: clamped });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), leftSidebarWidth: clamped }));
  },

  setRightSidebarWidth: (width) => {
    const clamped = Math.max(260, Math.min(width, 560));
    set({ rightSidebarWidth: clamped });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), rightSidebarWidth: clamped }));
  },

  setLeftRatios: (ratios) => {
    set({ leftRatios: ratios });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), leftRatios: ratios }));
  },

  setRightRatios: (ratios) => {
    set({ rightRatios: ratios });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), rightRatios: ratios }));
  },

  resetLayout: () => {
    const defaultState = {
      leftSidebarWidth: 340,
      rightSidebarWidth: 360,
      leftRatios: [28, 28, 44] as [number, number, number],
      rightRatios: [38, 62] as [number, number],
    };
    set(defaultState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
  },
}));
