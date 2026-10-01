import { create } from 'zustand';
import { useSurveillanceNodeStore } from './surveillanceNodeStore';
import { useIdentityStore } from './identityStore';
import { useVehicleStore } from './vehicleStore';
import { useDroneStore } from './droneStore';
import { useSuspectStore } from './suspectStore';
import { useUIStore } from './uiStore';
import type { SurveillanceNode, Personnel, Suspect, Vehicle, Drone } from '@/types';

export type DetailTabType = 'cameras' | 'personnel' | 'watchlist' | 'vehicles' | 'drone' | 'suspect';

interface SelectionState {
  selectedEntityType: DetailTabType;
  selectedEntityId: string;

  selectNode: (nodeOrId: string | SurveillanceNode) => void;
  selectPersonnel: (personnelOrId: string | Personnel) => void;
  selectWatchlist: (watchlistOrId: string | Suspect) => void;
  selectVehicle: (vehicleOrId: string | Vehicle) => void;
  selectDrone: (droneIdOrDrone: string | Drone) => void;
  selectSuspect: (suspectIdOrSuspect: string | Suspect) => void;
  selectEntity: (id: string, type: DetailTabType) => void;
  setEntityTypeTab: (type: DetailTabType) => void;
}

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  selectedEntityType: 'cameras',
  selectedEntityId: 'CAM-01',

  selectNode: (nodeOrId) => {
    const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
    useSurveillanceNodeStore.getState().setSelectedNode(id);
    useSurveillanceNodeStore.getState().switchCameraSource(id);
    set({
      selectedEntityType: 'cameras',
      selectedEntityId: id,
    });
    useUIStore.getState().setSelectedMapEntity(id, 'drone');
    useUIStore.getState().setTimelineMode('node');
  },

  selectPersonnel: (pOrId) => {
    const id = typeof pOrId === 'string' ? pOrId : pOrId.id;
    useIdentityStore.getState().selectPersonnel(id);
    set({
      selectedEntityType: 'personnel',
      selectedEntityId: id,
    });
    useUIStore.getState().setTimelineMode('identity');
  },

  selectWatchlist: (wOrId) => {
    const id = typeof wOrId === 'string' ? wOrId : wOrId.id;
    useIdentityStore.getState().selectWatchlist(id);
    useSuspectStore.getState().setSelectedSuspect(
      typeof wOrId === 'object' ? wOrId : useSuspectStore.getState().suspects.find((s) => s.id === id) || null
    );
    set({
      selectedEntityType: 'watchlist',
      selectedEntityId: id,
    });
    useUIStore.getState().setSelectedMapEntity(id, 'suspect');
    useUIStore.getState().setTimelineMode('identity');
  },

  selectVehicle: (vOrId) => {
    const id = typeof vOrId === 'string' ? vOrId : vOrId.id;
    useVehicleStore.getState().selectVehicle(id);
    set({
      selectedEntityType: 'vehicles',
      selectedEntityId: id,
    });
  },

  // Backwards compatibility methods
  selectDrone: (droneIdOrDrone) => {
    const droneId = typeof droneIdOrDrone === 'string' ? droneIdOrDrone : droneIdOrDrone.id;
    const droneObj =
      typeof droneIdOrDrone === 'object'
        ? droneIdOrDrone
        : useDroneStore.getState().drones.find((d) => d.id === droneId) || null;

    set({
      selectedEntityType: 'cameras',
      selectedEntityId: droneId,
    });

    if (droneObj) {
      useDroneStore.getState().setSelectedDrone(droneObj);
    }
    useUIStore.getState().setSelectedMapEntity(droneId, 'drone');
    useUIStore.getState().setTimelineMode('node');
  },

  selectSuspect: (suspectIdOrSuspect) => {
    get().selectWatchlist(suspectIdOrSuspect);
  },

  selectEntity: (id, type) => {
    if (type === 'cameras' || type === 'drone') {
      get().selectNode(id);
    } else if (type === 'personnel') {
      get().selectPersonnel(id);
    } else if (type === 'watchlist' || type === 'suspect') {
      get().selectWatchlist(id);
    } else if (type === 'vehicles') {
      get().selectVehicle(id);
    }
  },

  setEntityTypeTab: (type) => {
    const current = get().selectedEntityType;
    if (current === type) return;

    if (type === 'cameras' || type === 'drone') {
      const activeNode = useSurveillanceNodeStore.getState().selectedNode;
      if (activeNode) get().selectNode(activeNode);
      else set({ selectedEntityType: 'cameras' });
    } else if (type === 'personnel') {
      const p = useIdentityStore.getState().selectedPersonnel || useIdentityStore.getState().personnel[0];
      if (p) get().selectPersonnel(p);
      else set({ selectedEntityType: 'personnel' });
    } else if (type === 'watchlist' || type === 'suspect') {
      const w = useIdentityStore.getState().selectedWatchlist || useIdentityStore.getState().watchlist[0];
      if (w) get().selectWatchlist(w);
      else set({ selectedEntityType: 'watchlist' });
    } else if (type === 'vehicles') {
      const v = useVehicleStore.getState().selectedVehicle || useVehicleStore.getState().vehicles[0];
      if (v) get().selectVehicle(v);
      else set({ selectedEntityType: 'vehicles' });
    }
  },
}));
