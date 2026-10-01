import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SurveillanceNode, NodeType } from '@/types';
import { mockSurveillanceNodes } from '@/services/mock/mockData';
import { apiUrl } from '@/lib/apiConfig';

interface SurveillanceNodeState {
  nodes: SurveillanceNode[];
  selectedNode: SurveillanceNode;
  filterType: NodeType | 'all';
  activeCameraSource: string;
  cameraStatus: 'connected' | 'connecting' | 'unavailable' | 'idle';
  thermalActive: boolean;

  setNodes: (nodes: SurveillanceNode[]) => void;
  setSelectedNode: (nodeOrId: SurveillanceNode | string) => void;
  selectNode: (nodeOrId: SurveillanceNode | string) => void;
  setFilterType: (type: NodeType | 'all') => void;
  toggleThermal: () => void;
  updateNodeStatus: (id: string, updates: Partial<SurveillanceNode>) => void;
  switchCameraSource: (nodeId: string) => Promise<boolean>;
  fetchCameraStatus: () => Promise<void>;
  filteredNodes: () => SurveillanceNode[];
  /** Enumerate browser media devices and inject local webcams into the node list */
  scanLocalCameras: () => Promise<void>;
}

export const useSurveillanceNodeStore = create<SurveillanceNodeState>()(
  subscribeWithSelector((set, get) => ({
    nodes: mockSurveillanceNodes,
    selectedNode: mockSurveillanceNodes[0],
    filterType: 'all',
    activeCameraSource: 'CAM-01',
    cameraStatus: 'connected',
    thermalActive: false,

    setNodes: (nodes) => set({ nodes }),
    setSelectedNode: (nodeOrId) => {
      const node =
        typeof nodeOrId === 'string'
          ? get().nodes.find((n) => n.id === nodeOrId) || get().nodes[0]
          : nodeOrId;
      set({ selectedNode: node, activeCameraSource: node.id });
    },
    selectNode: (nodeOrId) => {
      const node =
        typeof nodeOrId === 'string'
          ? get().nodes.find((n) => n.id === nodeOrId) || get().nodes[0]
          : nodeOrId;
      set({ selectedNode: node, activeCameraSource: node.id });
    },
    setFilterType: (filterType) => set({ filterType }),
    toggleThermal: () => set((state) => ({ thermalActive: !state.thermalActive })),
    updateNodeStatus: (id, updates) =>
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
        selectedNode:
          state.selectedNode.id === id
            ? { ...state.selectedNode, ...updates }
            : state.selectedNode,
      })),

    switchCameraSource: async (nodeId: string) => {
      const targetNode = get().nodes.find((n) => n.id === nodeId) || get().nodes[0];
      set({
        selectedNode: targetNode,
        activeCameraSource: nodeId,
        cameraStatus: 'connecting',
      });

      try {
        const res = await fetch(apiUrl('/api/camera/source'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: nodeId }),
        });

        if (res.ok) {
          const data = await res.json();
          set({
            activeCameraSource: data.activeSource || nodeId,
            cameraStatus: data.status || 'connected',
          });
          return true;
        } else {
          set({ cameraStatus: 'connected' }); // fallback to connected in demo mode
          return true;
        }
      } catch (err) {
        set({ cameraStatus: 'connected' });
        return true;
      }
    },

    fetchCameraStatus: async () => {
      try {
        const res = await fetch(apiUrl('/api/camera/status'));
        if (res.ok) {
          const data = await res.json();
          if (data.status) {
            set({ cameraStatus: data.status });
          }
        }
      } catch (err) {
        // Backend offline or local fallback
      }
    },

    scanLocalCameras: async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;

      try {
        // Enumerate devices without getUserMedia() to prevent locking hardware from Python OpenCV
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');

        if (videoDevices.length === 0) return;

        const localNodes: SurveillanceNode[] = videoDevices.map((device, idx) => ({
          id: `LOCAL-${idx}`,
          name: device.label || `Integrated Webcam ${idx > 0 ? idx + 1 : ''}`.trim(),
          location: 'Tactical Command Station',
          type: 'local_cam',
          status: 'online',
          fps: 30,
          resolution: 'HD (1280x720)',
          lastActivity: 'Just now',
          assignedZone: 'Sector Alpha Gate',
          activePeopleCount: 1,
          activeVehiclesCount: 0,
          alertsCount: 0,
          coordinates: { lat: 25.3176, lng: 82.9739 },
          streamUrl: apiUrl('/api/video/feed'),
          isLocalCamera: true,
          localDeviceId: device.deviceId,
        }));

        // Merge: keep all non-local nodes, then append detected local nodes
        set((state) => {
          const nonLocal = state.nodes.filter((n) => !n.isLocalCamera);
          return { nodes: [...nonLocal, ...localNodes] };
        });
      } catch (err) {
        // Media enumeration failed silently
      }
    },

    filteredNodes: () => {
      const { nodes, filterType } = get();
      if (filterType === 'all') return nodes;
      return nodes.filter((n) => n.type === filterType);
    },
  }))
);
