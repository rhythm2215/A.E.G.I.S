import { create } from 'zustand';
import type { Personnel, Suspect } from '@/types';
import { mockPersonnel } from '@/services/mock/mockData';
import { API_BASE_URL } from '@/lib/apiConfig';

const BACKEND = API_BASE_URL;

export type IdentityTab = 'personnel' | 'watchlist';

interface IdentityState {
  activeTab: IdentityTab;
  personnel: Personnel[];
  watchlist: Suspect[];
  selectedPersonnel: Personnel | null;
  selectedWatchlist: Suspect | null;
  searchQuery: string;

  setActiveTab: (tab: IdentityTab) => void;
  setPersonnel: (p: Personnel[]) => void;
  setWatchlist: (w: Suspect[]) => void;
  selectPersonnel: (p: Personnel | string) => void;
  selectWatchlist: (w: Suspect | string) => void;
  setSearchQuery: (query: string) => void;
  addPersonnel: (p: Personnel) => void;
  addWatchlist: (s: Suspect) => void;
  deletePersonnel: (id: string) => void;
  deleteWatchlist: (id: string) => void;
  fetchPersonnel: () => Promise<void>;
  fetchWatchlist: () => Promise<void>;
}

export const useIdentityStore = create<IdentityState>()((set, get) => ({
  activeTab: 'personnel',
  personnel: mockPersonnel,
  watchlist: [],
  selectedPersonnel: mockPersonnel[0],
  selectedWatchlist: null,
  searchQuery: '',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setPersonnel: (personnel) => set({ personnel }),
  setWatchlist: (watchlist) => set({ watchlist }),

  selectPersonnel: (pOrId) => {
    const p =
      typeof pOrId === 'string'
        ? get().personnel.find((item) => item.id === pOrId) || null
        : pOrId;
    set({ selectedPersonnel: p, activeTab: 'personnel' });
  },

  selectWatchlist: (wOrId) => {
    const w =
      typeof wOrId === 'string'
        ? get().watchlist.find((item) => item.id === wOrId) || null
        : wOrId;
    set({ selectedWatchlist: w, activeTab: 'watchlist' });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  addPersonnel: (p) =>
    set((state) => ({ personnel: [p, ...state.personnel] })),

  addWatchlist: (s) =>
    set((state) => ({
      watchlist: [s, ...state.watchlist],
      selectedWatchlist: state.selectedWatchlist || s,
    })),

  deletePersonnel: async (id) => {
    try {
      await fetch(`${BACKEND}/api/personnel/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend delete personnel failed or offline:', e);
    }
    set((state) => ({
      personnel: state.personnel.filter((p) => p.id !== id),
      selectedPersonnel:
        state.selectedPersonnel?.id === id ? null : state.selectedPersonnel,
    }));
  },

  deleteWatchlist: async (id) => {
    try {
      await fetch(`${BACKEND}/api/suspects/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend delete suspect failed or offline:', e);
    }
    set((state) => {
      const remaining = state.watchlist.filter((w) => w.id !== id);
      return {
        watchlist: remaining,
        selectedWatchlist:
          state.selectedWatchlist?.id === id ? remaining[0] || null : state.selectedWatchlist,
      };
    });
  },

  fetchPersonnel: async () => {
    try {
      const resp = await fetch(`${BACKEND}/api/personnel`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.personnel && Array.isArray(data.personnel) && data.personnel.length > 0) {
          // Map backend personnel to frontend Personnel format
          const mapped: Personnel[] = data.personnel.map((p: any) => ({
            id: p.id,
            fullName: p.fullName || 'Authorized Officer',
            callsign: p.callsign || p.rank || 'Officer',
            role: p.role || 'officer',
            clearanceLevel: p.clearanceLevel || 'LEVEL 3 - OPERATIONAL',
            department: p.department || 'Border Operations',
            status: p.status === 'AUTHORIZED' ? 'on_duty' : (p.status || 'on_duty'),
            faceImage: p.photoUrl?.startsWith('/uploads') ? `${BACKEND}${p.photoUrl}` : (p.photoUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'),
            photoUrl: p.photoUrl?.startsWith('/uploads') ? `${BACKEND}${p.photoUrl}` : (p.photoUrl || ''),
            assignedSector: p.assignedSector || p.unit || 'Sector Alpha - Border Entry',
            assignedZone: p.assignedZone || p.unit || 'Sector Alpha',
            rank: p.rank || 'Officer',
            unit: p.unit || 'Sector Garrison',
            lastKnownLocation: p.lastKnownLocation || 'Gate Alpha Outpost',
            contactRadio: p.contactRadio || 'FREQ-442.15',
            shift: p.shift || 'Day Alpha (06:00 - 18:00)',
            recognitionConfidence: 98,
            cameraSource: 'CAM-01',
            lastSeen: 'On duty',
          }));
          set({ personnel: mapped });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch personnel from backend, keeping local state:', err);
    }
  },

  fetchWatchlist: async () => {
    try {
      const resp = await fetch(`${BACKEND}/api/suspects`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.suspects)) {
          const mapped: Suspect[] = data.suspects.map((s: any) => {
            const rawImages = s.facialImages && Array.isArray(s.facialImages) && s.facialImages.length > 0
              ? s.facialImages
              : [];
            
            const facialImages = rawImages.length > 0
              ? rawImages.map((img: any) => ({
                  ...img,
                  url: img.url?.startsWith('/uploads') ? `${BACKEND}${img.url}` : (img.url || '/placeholder.png'),
                }))
              : [
                  {
                    id: `fi-${s.id}`,
                    url: s.photoUrl?.startsWith('/uploads')
                      ? `${BACKEND}${s.photoUrl}`
                      : (s.photoUrl || `${BACKEND}/uploads/${s.id}.jpg`),
                    capturedAt: new Date().toISOString(),
                    droneId: 'CAM-01',
                    confidence: 92,
                    verified: true,
                  },
                ];

            return {
              id: s.id,
              fullName: s.fullName || 'Unknown Suspect',
              alias: Array.isArray(s.alias)
                ? s.alias
                : (typeof s.alias === 'string' && s.alias ? [s.alias] : []),
              age: s.age || 30,
              gender: s.gender || 'Unknown',
              nationality: s.nationality || 'Indian',
              status: s.status || 'active_surveillance',
              threatLevel: s.threatLevel || 'medium',
              watchlisted: s.watchlisted !== undefined ? s.watchlisted : true,
              facialImages,
              recognitionConfidence: s.recognitionConfidence || 92,
              physicalDescription: s.physicalDescription || {
                height: '175 cm',
                weight: '70 kg',
                clothing: 'Dark attire',
                distinguishingFeatures: 'None recorded',
              },
              tracking: s.tracking || {
                assignedDrones: ['CAM-01'],
                firstDetection: new Date().toISOString(),
                lastDetection: new Date().toISOString(),
                currentCoordinates: { lat: 25.3184, lng: 82.9752 },
                currentSector: 'Sector B7',
              },
              intelligence: s.intelligence || {
                criminalHistory: ['Watchlist Target'],
                openInvestigations: [],
                associatedIndividuals: [],
                notes: 'Flagged in surveillance registry.',
              },
              lastUpdated: s.lastUpdated || new Date().toISOString(),
            };
          });

          set((state) => {
            const currentSelected = state.selectedWatchlist;
            const stillExists = currentSelected ? mapped.find((x) => x.id === currentSelected.id) : null;
            return {
              watchlist: mapped,
              selectedWatchlist: stillExists || mapped[0] || null,
            };
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch watchlist from backend, keeping local state:', err);
    }
  },
}));

// Hydrate live data on boot
if (typeof window !== 'undefined') {
  useIdentityStore.getState().fetchPersonnel();
  useIdentityStore.getState().fetchWatchlist();
}

