import { useState, useEffect } from 'react';
import { Filter, ChevronDown, Video, Radio, Shield, Thermometer, MonitorSmartphone, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSurveillanceNodeStore } from '@/store/surveillanceNodeStore';
import { useSelectionStore } from '@/store/selectionStore';
import type { NodeType, SurveillanceNode } from '@/types';

const NODE_FILTERS: { label: string; value: NodeType | 'all' }[] = [
  { label: 'All Nodes', value: 'all' },
  { label: 'Border Cameras', value: 'border_cam' },
  { label: 'CCTV Cameras', value: 'cctv' },
  { label: 'Checkpost Cams', value: 'checkpost' },
  { label: 'PTZ Cameras', value: 'ptz' },
  { label: 'Thermal Cameras', value: 'thermal' },
  { label: 'Local Webcams', value: 'local_cam' },
];

function NodeFilterMenu({ onClose }: { onClose: () => void }) {
  const { filterType, setFilterType } = useSurveillanceNodeStore();
  return (
    <div
      className="absolute top-full mt-1 right-0 tactical-glass rounded-lg py-1 min-w-[170px] z-50 shadow-2xl border border-white/10 animate-scale-in"
      onMouseLeave={onClose}
    >
      {NODE_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => {
            setFilterType(f.value);
            onClose();
          }}
          className={cn(
            'w-full text-left px-3 py-1.5 font-mono text-[11px] transition-colors hover:bg-white/5 truncate',
            filterType === f.value ? 'text-primary-fixed-dim font-bold' : 'text-on-surface-variant'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function SurveillanceNodesPanel({ style }: { style?: React.CSSProperties }) {
  const {
    nodes,
    filteredNodes,
    selectedNode,
    cameraStatus,
    fetchCameraStatus,
    scanLocalCameras,
  } = useSurveillanceNodeStore();

  const { selectNode } = useSelectionStore();
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetchCameraStatus();
    const interval = setInterval(fetchCameraStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchCameraStatus]);

  // Auto-scan for local webcams on first mount
  useEffect(() => {
    setScanning(true);
    scanLocalCameras().finally(() => setScanning(false));
  }, [scanLocalCameras]);

  const shownNodes = filteredNodes();

  const getNodeIcon = (node: SurveillanceNode) => {
    if (node.isLocalCamera) return <MonitorSmartphone size={13} className="text-health-emerald shrink-0" />;
    if (node.type === 'thermal') return <Thermometer size={13} className="text-alert-amber shrink-0" />;
    if (node.type === 'ptz') return <Radio size={13} className="text-primary-fixed-dim shrink-0" />;
    if (node.type === 'border_cam') return <Shield size={13} className="text-secondary shrink-0" />;
    return <Video size={13} className="text-on-surface-variant shrink-0" />;
  };

  const localCount = nodes.filter((n) => n.isLocalCamera).length;

  return (
    <div
      style={style}
      className="tactical-glass rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden hud-border-top transition-shadow hover:shadow-[0_6px_30px_rgba(0,218,243,0.1)] shrink-0 min-h-[140px]"
    >
      {/* Card Header */}
      <header className="panel-header shrink-0 border-b border-white/5 px-3 py-2 bg-surface-container-high/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-primary-fixed-dim animate-pulse shrink-0" />
          <h2 className="panel-title text-primary-fixed-dim tracking-wider font-bold truncate">
            SURVEILLANCE NODES
          </h2>
          <span className="font-mono text-[10px] text-outline bg-surface-container-highest/60 px-1.5 py-0.5 rounded font-bold shrink-0">
            {shownNodes.length}/{nodes.length}
          </span>
          {localCount > 0 && (
            <span className="font-mono text-[9px] text-health-emerald bg-health-emerald/10 px-1.5 py-0.5 rounded font-bold shrink-0 border border-health-emerald/30">
              {localCount} LOCAL
            </span>
          )}
          {scanning && (
            <span className="font-mono text-[9px] text-outline animate-pulse shrink-0">scanning…</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 relative shrink-0">
          {/* Rescan local cameras button */}
          <button
            onClick={async () => {
              setScanning(true);
              await scanLocalCameras();
              setScanning(false);
            }}
            className="btn-icon-sm h-7 w-7 flex items-center justify-center hover:border-health-emerald/40 hover:text-health-emerald"
            title="Rescan local cameras"
          >
            <Camera size={11} />
          </button>

          <button
            onClick={() => setShowFilterMenu((v) => !v)}
            className="btn-icon-sm h-7 px-2 flex items-center gap-1 hover:border-primary-fixed-dim/40"
            title="Filter Camera Nodes"
          >
            <Filter size={11} />
            <span className="font-mono text-[10px] hidden sm:inline">Filter</span>
            <ChevronDown size={8} />
          </button>
          {showFilterMenu && <NodeFilterMenu onClose={() => setShowFilterMenu(false)} />}
        </div>
      </header>

      {/* Nodes List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar min-h-0">
        {shownNodes.map((node) => {
          const isSelected = selectedNode?.id === node.id;
          const isOnline = node.status === 'online' || node.status === 'recording';

          return (
            <button
              key={node.id}
              onClick={() => selectNode(node)}
              className={cn(
                'w-full border rounded-lg p-2.5 flex items-center gap-2.5 transition-all duration-150 text-left group min-w-0',
                isSelected
                  ? 'border-primary-fixed-dim/70 bg-primary-container/15 shadow-ambient-cyan ring-1 ring-primary-fixed-dim/50'
                  : 'border-outline-variant/30 bg-surface-charcoal/50 hover:bg-white/5 hover:border-outline-variant/50',
                node.isLocalCamera && !isSelected && 'border-health-emerald/20'
              )}
            >
              {/* Left icon & badge */}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0',
                  isSelected
                    ? 'border-primary-fixed-dim bg-primary-fixed-dim/10 text-primary-fixed-dim'
                    : node.isLocalCamera
                    ? 'border-health-emerald/40 bg-health-emerald/10 text-health-emerald'
                    : 'border-outline-variant/30 bg-surface-container-high/40 text-on-surface-variant'
                )}
              >
                {getNodeIcon(node)}
              </div>

              {/* Node Title & Specs */}
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      'font-mono text-data-mono font-bold truncate text-[12px]',
                      isSelected ? 'text-primary-fixed-dim' : 'text-on-surface'
                    )}
                    title={node.name}
                  >
                    {node.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {node.isLocalCamera && (
                      <span className="font-mono text-[8px] text-health-emerald bg-health-emerald/10 px-1 rounded border border-health-emerald/30 font-bold">
                        LOCAL
                      </span>
                    )}
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isOnline ? 'bg-health-emerald' : 'bg-outline'
                      )}
                    />
                    <span className="font-mono text-[9px] text-outline font-bold uppercase">
                      {node.fps} FPS
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-1">
                  <span
                    className="font-inter text-[10px] text-on-surface-variant truncate max-w-[140px]"
                    title={node.assignedZone}
                  >
                    {node.assignedZone}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {node.activePeopleCount > 0 && (
                      <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-primary-fixed-dim/10 text-primary-fixed-dim font-bold">
                        {node.activePeopleCount}P
                      </span>
                    )}
                    {node.activeVehiclesCount > 0 && (
                      <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-alert-amber/15 text-alert-amber font-bold">
                        {node.activeVehiclesCount}V
                      </span>
                    )}
                    {node.alertsCount > 0 && (
                      <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-error/20 text-error font-bold">
                        {node.alertsCount}A
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {shownNodes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <Video size={24} className="text-outline/50" />
            <span className="font-mono text-[11px] text-outline">No nodes match filter</span>
          </div>
        )}
      </div>
    </div>
  );
}
