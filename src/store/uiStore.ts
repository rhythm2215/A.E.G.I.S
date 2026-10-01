import { create } from 'zustand';
import type { OperationalView, PanelVisibility, TimelineMode } from '@/types';

interface UIState {
  activeView: OperationalView;
  panelVisibility: PanelVisibility;
  timelineMode: TimelineMode;
  isSidebarOpen: boolean;
  selectedMapEntityId: string | null;
  selectedMapEntityType: 'drone' | 'suspect' | null;
  isFilterMenuOpen: boolean;

  setActiveView: (view: OperationalView) => void;
  toggleView: () => void;
  setPanelVisibility: (panel: keyof PanelVisibility, visible: boolean) => void;
  setTimelineMode: (mode: TimelineMode) => void;
  setSelectedMapEntity: (id: string | null, type: 'drone' | 'suspect' | null) => void;
  setFilterMenuOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set, get) => ({
  activeView: 'map',
  panelVisibility: {
    entityPanel: true,
    timelinePanel: true,
    notificationPanel: true,
    detailPanel: true,
    cameraControls: true,
  },
  timelineMode: 'drone',
  isSidebarOpen: true,
  selectedMapEntityId: null,
  selectedMapEntityType: null,
  isFilterMenuOpen: false,

  setActiveView: (view) => set({ activeView: view }),
  toggleView: () =>
    set((state) => ({
      activeView: state.activeView === 'map' ? 'camera' : 'map',
    })),
  setPanelVisibility: (panel, visible) =>
    set((state) => ({
      panelVisibility: { ...state.panelVisibility, [panel]: visible },
    })),
  setTimelineMode: (mode) => set({ timelineMode: mode }),
  setSelectedMapEntity: (id, type) =>
    set({ selectedMapEntityId: id, selectedMapEntityType: type }),
  setFilterMenuOpen: (open) => set({ isFilterMenuOpen: open }),
}));

// ── Playback Store ────────────────────────────────────────────

import type { PlaybackSession, PlaybackState, PlaybackMarker } from '@/types';
import { mockPlaybackSessions } from '@/services/mock/mockData';

interface PlaybackStoreState {
  sessions: PlaybackSession[];
  selectedSession: PlaybackSession | null;
  playbackState: PlaybackState;
  currentTime: number; // seconds
  duration: number;
  volume: number;
  activeMarker: PlaybackMarker | null;
  filterDroneId: string | null;

  setSessions: (s: PlaybackSession[]) => void;
  setSelectedSession: (s: PlaybackSession | null) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setCurrentTime: (t: number) => void;
  setVolume: (v: number) => void;
  setActiveMarker: (m: PlaybackMarker | null) => void;
  setFilterDroneId: (id: string | null) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

export const usePlaybackStore = create<PlaybackStoreState>()((set) => ({
  sessions: mockPlaybackSessions,
  selectedSession: mockPlaybackSessions[0],
  playbackState: 'idle',
  currentTime: 0,
  duration: mockPlaybackSessions[0]?.duration ?? 0,
  volume: 1,
  activeMarker: null,
  filterDroneId: null,

  setSessions: (s) => set({ sessions: s }),
  setSelectedSession: (s) =>
    set({ selectedSession: s, currentTime: 0, duration: s?.duration ?? 0, playbackState: 'idle' }),
  setPlaybackState: (state) => set({ playbackState: state }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setVolume: (v) => set({ volume: v }),
  setActiveMarker: (m) => set({ activeMarker: m }),
  setFilterDroneId: (id) => set({ filterDroneId: id }),
  play: () => set({ playbackState: 'playing' }),
  pause: () => set({ playbackState: 'paused' }),
  stop: () => set({ playbackState: 'stopped', currentTime: 0 }),
}));
