import { useState } from 'react';
import {
  Shield, Camera, Users, AlertTriangle, Car,
  Filter, ChevronDown, CheckCircle2, AlertOctagon,
  ExternalLink, Crosshair, MapPin, Radio, Video
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, getThreatColor } from '@/lib/utils';
import { useSurveillanceNodeStore } from '@/store/surveillanceNodeStore';
import { useIdentityStore } from '@/store/identityStore';
import { useVehicleStore, type VehicleFilter } from '@/store/vehicleStore';
import { useSelectionStore, type DetailTabType } from '@/store/selectionStore';

const VEHICLE_FILTERS: { label: string; value: VehicleFilter }[] = [
  { label: 'All Vehicles', value: 'all' },
  { label: 'Authorized Vehicles', value: 'authorized' },
  { label: 'Watchlist Vehicles', value: 'watchlist' },
  { label: 'Unknown Vehicles', value: 'unknown' },
  { label: 'Recently Detected', value: 'recent' },
];

export function DetailPanel({ style }: { style?: React.CSSProperties }) {
  const navigate = useNavigate();

  const { nodes, selectedNode, selectNode } = useSurveillanceNodeStore();
  const {
    personnel,
    watchlist,
    selectedPersonnel,
    selectedWatchlist,
    selectPersonnel,
    selectWatchlist,
  } = useIdentityStore();
  const {
    filteredVehicles,
    selectedVehicle,
    filter: vehicleFilter,
    setFilter: setVehicleFilter,
    selectVehicle,
  } = useVehicleStore();

  const { selectedEntityType, setEntityTypeTab } = useSelectionStore();
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  // Normalize active tab
  const activeTab: 'cameras' | 'personnel' | 'watchlist' | 'vehicles' =
    selectedEntityType === 'cameras' || selectedEntityType === 'drone'
      ? 'cameras'
      : selectedEntityType === 'personnel'
      ? 'personnel'
      : selectedEntityType === 'watchlist' || selectedEntityType === 'suspect'
      ? 'watchlist'
      : 'vehicles';

  const currentVehicles = filteredVehicles();

  return (
    <div
      style={style}
      className="tactical-glass rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden hud-border-top transition-shadow hover:shadow-[0_6px_30px_rgba(0,218,243,0.1)] shrink-0 min-h-[160px]"
    >
      {/* ── Header with 4 Tabs ── */}
      <header className="panel-header shrink-0 px-3 py-2 bg-surface-container-high/30 border-b border-white/5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Shield
              size={13}
              className={
                activeTab === 'watchlist'
                  ? 'text-secondary'
                  : 'text-primary-fixed-dim'
              }
            />
            <h2
              className={cn(
                'panel-title font-bold tracking-wider truncate',
                activeTab === 'watchlist'
                  ? 'text-secondary'
                  : 'text-primary-fixed-dim'
              )}
            >
              INTELLIGENCE DETAIL
            </h2>
          </div>

          {/* Vehicles Dropdown Filter (Top-Right when on Vehicles tab) */}
          {activeTab === 'vehicles' && (
            <div className="relative shrink-0">
              <button
                onClick={() => setShowVehicleDropdown((v) => !v)}
                className="btn-icon-sm h-6 px-2 flex items-center gap-1 bg-surface-container-low border-outline-variant/30 text-[10px] font-mono hover:border-primary-fixed-dim/40"
              >
                <Filter size={10} />
                <span className="truncate max-w-[100px]">
                  {VEHICLE_FILTERS.find((f) => f.value === vehicleFilter)?.label}
                </span>
                <ChevronDown size={8} />
              </button>
              {showVehicleDropdown && (
                <div
                  className="absolute top-full mt-1 right-0 tactical-glass rounded-lg py-1 min-w-[160px] z-50 shadow-2xl border border-white/10 animate-scale-in"
                  onMouseLeave={() => setShowVehicleDropdown(false)}
                >
                  {VEHICLE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => {
                        setVehicleFilter(f.value);
                        setShowVehicleDropdown(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 font-mono text-[10px] transition-colors hover:bg-white/5 truncate',
                        vehicleFilter === f.value
                          ? 'text-primary-fixed-dim font-bold'
                          : 'text-on-surface-variant'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4 Mode Tabs Navigation */}
        <div className="grid grid-cols-4 gap-1 w-full bg-surface-container-lowest border border-outline-variant/30 rounded p-0.5">
          <button
            onClick={() => setEntityTypeTab('cameras')}
            className={cn(
              'py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors truncate',
              activeTab === 'cameras'
                ? 'bg-primary-container/20 text-primary-fixed-dim shadow-ambient-cyan'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            Cameras
          </button>
          <button
            onClick={() => setEntityTypeTab('personnel')}
            className={cn(
              'py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors truncate',
              activeTab === 'personnel'
                ? 'bg-primary-container/20 text-primary-fixed-dim shadow-ambient-cyan'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            Personnel
          </button>
          <button
            onClick={() => setEntityTypeTab('watchlist')}
            className={cn(
              'py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors truncate',
              activeTab === 'watchlist'
                ? 'bg-secondary-container/20 text-secondary shadow-ambient-red'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            Watchlist
          </button>
          <button
            onClick={() => setEntityTypeTab('vehicles')}
            className={cn(
              'py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors truncate',
              activeTab === 'vehicles'
                ? 'bg-alert-amber/20 text-alert-amber shadow-ambient-amber'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            Vehicles
          </button>
        </div>
      </header>

      {/* ── Content Area ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-0">
        {/* ========================================================
            TAB 1: CAMERAS
            ======================================================== */}
        {activeTab === 'cameras' && (
          <div className="space-y-3">
            {/* Quick Node Switch Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/5 custom-scrollbar">
              {nodes.map((node) => {
                const isActive = selectedNode?.id === node.id;
                return (
                  <button
                    key={node.id}
                    onClick={() => selectNode(node)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-mono font-bold shrink-0 transition-colors',
                      isActive
                        ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim border border-primary-fixed-dim/60 shadow-ambient-cyan'
                        : 'bg-surface-container-low text-outline hover:text-on-surface'
                    )}
                  >
                    {node.id}
                  </button>
                );
              })}
            </div>

            {selectedNode && (
              <div className="space-y-2.5 animate-fade-in">
                {/* Node Banner */}
                <div className="bg-surface-charcoal/60 border border-outline-variant/30 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-data-mono font-bold text-primary-fixed-dim text-[13px]">
                        {selectedNode.name}
                      </div>
                      <div className="font-inter text-[11px] text-outline mt-0.5">
                        {selectedNode.location}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-health-emerald/15 text-health-emerald border border-health-emerald/30">
                        {selectedNode.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Specs Table */}
                <div className="bg-surface-charcoal/40 border border-outline-variant/20 rounded-lg p-2.5 space-y-1.5 font-mono text-[11px]">
                  <div className="intel-row">
                    <span className="intel-label text-outline">FPS:</span>
                    <span className="intel-value font-bold text-primary-fixed-dim">
                      {selectedNode.fps} Frames / Sec
                    </span>
                  </div>
                  <div className="intel-row">
                    <span className="intel-label text-outline">Resolution:</span>
                    <span className="intel-value">{selectedNode.resolution}</span>
                  </div>
                  <div className="intel-row">
                    <span className="intel-label text-outline">Assigned Zone:</span>
                    <span className="intel-value font-bold text-on-surface truncate max-w-[160px]">
                      {selectedNode.assignedZone}
                    </span>
                  </div>
                  <div className="intel-row">
                    <span className="intel-label text-outline">Last Activity:</span>
                    <span className="intel-value">{selectedNode.lastActivity}</span>
                  </div>
                  <div className="intel-row">
                    <span className="intel-label text-outline">Type / Optics:</span>
                    <span className="intel-value uppercase text-primary-fixed-dim">
                      {selectedNode.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="intel-row">
                    <span className="intel-label text-outline">Coordinates:</span>
                    <span className="intel-value text-[10px]">
                      {selectedNode.coordinates.lat.toFixed(4)}°N, {selectedNode.coordinates.lng.toFixed(4)}°E
                    </span>
                  </div>
                </div>

                {/* Detection Snapshot Counters */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-charcoal/50 border border-outline-variant/30 rounded p-2 text-center">
                    <div className="text-[9px] font-mono text-outline uppercase">Active People</div>
                    <div className="text-[14px] font-mono font-bold text-primary-fixed-dim mt-0.5">
                      {selectedNode.activePeopleCount}
                    </div>
                  </div>
                  <div className="bg-surface-charcoal/50 border border-outline-variant/30 rounded p-2 text-center">
                    <div className="text-[9px] font-mono text-outline uppercase">Vehicles</div>
                    <div className="text-[14px] font-mono font-bold text-alert-amber mt-0.5">
                      {selectedNode.activeVehiclesCount}
                    </div>
                  </div>
                  <div className="bg-surface-charcoal/50 border border-outline-variant/30 rounded p-2 text-center">
                    <div className="text-[9px] font-mono text-outline uppercase">Alerts</div>
                    <div className="text-[14px] font-mono font-bold text-error mt-0.5">
                      {selectedNode.alertsCount}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: PERSONNEL
            ======================================================== */}
        {activeTab === 'personnel' && selectedPersonnel && (
          <div className="space-y-3 animate-fade-in">
            {/* Quick Personnel Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/5 custom-scrollbar">
              {personnel.map((p) => {
                const isActive = selectedPersonnel?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPersonnel(p)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-mono font-bold shrink-0 transition-colors',
                      isActive
                        ? 'bg-primary-fixed-dim/20 text-primary-fixed-dim border border-primary-fixed-dim/60 shadow-ambient-cyan'
                        : 'bg-surface-container-low text-outline hover:text-on-surface'
                    )}
                  >
                    {p.id}
                  </button>
                );
              })}
            </div>

            {/* Profile Card */}
            <div className="bg-surface-charcoal/60 border border-primary-fixed-dim/30 rounded-lg p-3 flex items-start gap-3">
              <img
                src={selectedPersonnel.faceImage}
                alt={selectedPersonnel.fullName}
                className="w-16 h-16 rounded-lg object-cover border-2 border-primary-fixed-dim/60 shadow-ambient-cyan shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-data-mono font-bold text-primary-fixed-dim text-[13px] truncate">
                    {selectedPersonnel.fullName}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-health-emerald/15 text-health-emerald font-mono text-[9px] font-bold shrink-0">
                    {selectedPersonnel.status.toUpperCase()}
                  </span>
                </div>
                <div className="font-inter text-[11px] text-on-surface mt-0.5 font-medium">
                  {selectedPersonnel.rank}
                </div>
                <div className="font-mono text-[10px] text-outline mt-0.5">
                  Unit: {selectedPersonnel.unit}
                </div>
              </div>
            </div>

            {/* Field Specifications */}
            <div className="bg-surface-charcoal/40 border border-outline-variant/20 rounded-lg p-2.5 space-y-1.5 font-mono text-[11px]">
              <div className="intel-row">
                <span className="intel-label text-outline">Clearance:</span>
                <span className="intel-value font-bold text-primary-fixed-dim">
                  {selectedPersonnel.clearanceLevel}
                </span>
              </div>
              <div className="intel-row">
                <span className="intel-label text-outline">Last Seen:</span>
                <span className="intel-value">{selectedPersonnel.lastSeen}</span>
              </div>
              <div className="intel-row">
                <span className="intel-label text-outline">Camera Source:</span>
                <span className="intel-value font-bold text-on-surface truncate max-w-[160px]">
                  {selectedPersonnel.cameraSource}
                </span>
              </div>
              <div className="intel-row">
                <span className="intel-label text-outline">Biometric Conf:</span>
                <span className="intel-value font-bold text-health-emerald">
                  {selectedPersonnel.recognitionConfidence}%
                </span>
              </div>
              <div className="intel-row">
                <span className="intel-label text-outline">Assigned Zone:</span>
                <span className="intel-value">{selectedPersonnel.assignedZone}</span>
              </div>
              <div className="intel-row">
                <span className="intel-label text-outline">Badge Serial:</span>
                <span className="intel-value text-outline">{selectedPersonnel.badgeNumber}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/records')}
              className="w-full btn-ghost py-1.5 text-[11px] flex items-center justify-center gap-1.5 hover:border-primary-fixed-dim/50"
            >
              <ExternalLink size={12} />
              <span>View Full Personnel Dossier</span>
            </button>
          </div>
        )}

        {/* ========================================================
            TAB 3: WATCHLIST
            ======================================================== */}
        {activeTab === 'watchlist' && selectedWatchlist && (
          <div className="space-y-3 animate-fade-in">
            {/* Quick Watchlist Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/5 custom-scrollbar">
              {watchlist.map((suspect) => {
                const isActive = selectedWatchlist?.id === suspect.id;
                return (
                  <button
                    key={suspect.id}
                    onClick={() => selectWatchlist(suspect)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-mono font-bold shrink-0 transition-colors',
                      isActive
                        ? 'bg-secondary-container/20 text-secondary border border-secondary/60 shadow-ambient-red'
                        : 'bg-surface-container-low text-outline hover:text-on-surface'
                    )}
                  >
                    {suspect.id}
                  </button>
                );
              })}
            </div>

            {/* Suspect Banner Card */}
            <div className="bg-surface-charcoal/60 border border-secondary/30 rounded-lg p-3 flex items-start gap-3">
              <img
                src={selectedWatchlist.facialImages?.[0]?.url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'}
                alt={selectedWatchlist.fullName}
                className="w-16 h-16 rounded-lg object-cover border-2 border-secondary/60 shadow-ambient-red shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-data-mono font-bold text-secondary text-[13px] truncate">
                    {selectedWatchlist.fullName}
                  </span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase shrink-0',
                      getThreatColor(selectedWatchlist.threatLevel)
                    )}
                  >
                    {selectedWatchlist.threatLevel}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-outline mt-0.5">
                  ID: {selectedWatchlist.id} · {selectedWatchlist.nationality || 'Indian'}
                </div>
                <div className="font-inter text-[11px] text-alert-amber mt-0.5 truncate font-medium">
                  {selectedWatchlist.alias?.join(', ') || 'No aliases'}
                </div>
              </div>
            </div>

            {/* Watchlist Intel Spec */}
            <div className="bg-surface-charcoal/40 border border-outline-variant/20 rounded-lg p-2.5 space-y-1.5 font-mono text-[11px]">
              <div className="intel-row">
                <span className="intel-label text-outline">Match Conf:</span>
                <span className="intel-value font-bold text-error">
                  {selectedWatchlist.recognitionConfidence}%
                </span>
              </div>
              <div className="intel-row">
                <span className="intel-label text-outline">Camera Source:</span>
                <span className="intel-value font-bold text-on-surface">
                  CAM-01 Border Gate
                </span>
              </div>
              <div className="intel-row">
                <span className="intel-label text-outline">Last Detected:</span>
                <span className="intel-value text-[10px]">
                  {selectedWatchlist.tracking?.lastDetection || 'Just now'}
                </span>
              </div>
              <div className="intel-row">
                <span className="intel-label text-outline">Sector:</span>
                <span className="intel-value text-alert-amber">
                  {selectedWatchlist.tracking?.currentSector || 'Sector B7'}
                </span>
              </div>
              <div className="py-1 border-t border-white/5 mt-1">
                <span className="text-[10px] text-outline uppercase block mb-1">
                  Criminal Record / Flags:
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedWatchlist.intelligence?.criminalHistory?.map((charge, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-secondary-container/15 text-secondary text-[9px] font-mono border border-secondary/30"
                    >
                      {charge}
                    </span>
                  )) || (
                    <span className="text-outline text-[10px]">No prior records logged</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/records/${selectedWatchlist.id}`)}
              className="w-full btn-danger py-1.5 text-[11px] flex items-center justify-center gap-1.5"
            >
              <AlertOctagon size={12} />
              <span>Full Subject Intercept File</span>
            </button>
          </div>
        )}

        {/* ========================================================
            TAB 4: VEHICLES
            ======================================================== */}
        {activeTab === 'vehicles' && (
          <div className="space-y-3 animate-fade-in">
            {/* Quick Vehicle Horizontal Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/5 custom-scrollbar">
              {currentVehicles.map((v) => {
                const isActive = selectedVehicle?.id === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => selectVehicle(v)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-mono font-bold shrink-0 transition-colors',
                      isActive
                        ? v.category === 'watchlist'
                          ? 'bg-secondary-container/20 text-secondary border border-secondary/60 shadow-ambient-red'
                          : 'bg-primary-fixed-dim/20 text-primary-fixed-dim border border-primary-fixed-dim/60 shadow-ambient-cyan'
                        : 'bg-surface-container-low text-outline hover:text-on-surface'
                    )}
                  >
                    {v.id}
                  </button>
                );
              })}
            </div>

            {selectedVehicle ? (
              <div className="space-y-2.5">
                {/* Vehicle Thumbnail & Title Card */}
                <div className="bg-surface-charcoal/60 border border-outline-variant/30 rounded-lg p-3 flex items-start gap-3">
                  <img
                    src={selectedVehicle.imageUrl}
                    alt={selectedVehicle.vehicleName}
                    className="w-20 h-14 rounded-lg object-cover border border-outline-variant/40 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-data-mono font-bold text-on-surface text-[12px] truncate">
                        {selectedVehicle.vehicleName}
                      </span>
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase shrink-0',
                          selectedVehicle.category === 'authorized'
                            ? 'bg-primary-container/20 text-primary-fixed-dim border border-primary-fixed-dim/40'
                            : selectedVehicle.category === 'watchlist'
                            ? 'bg-secondary-container/20 text-secondary border border-secondary/40'
                            : 'bg-alert-amber/20 text-alert-amber border border-alert-amber/40'
                        )}
                      >
                        {selectedVehicle.category}
                      </span>
                    </div>

                    <div className="font-mono text-[12px] font-bold text-glow-cyan text-primary-fixed-dim mt-1 bg-surface-charcoal px-1.5 py-0.5 rounded border border-outline-variant/30 inline-block">
                      {selectedVehicle.plateNumber}
                    </div>

                    <div className="font-mono text-[10px] text-outline mt-1">
                      Tracking ID: {selectedVehicle.trackingId}
                    </div>
                  </div>
                </div>

                {/* Vehicle Attributes Table */}
                <div className="bg-surface-charcoal/40 border border-outline-variant/20 rounded-lg p-2.5 space-y-1.5 font-mono text-[11px]">
                  <div className="intel-row">
                    <span className="intel-label text-outline">Type:</span>
                    <span className="intel-value uppercase font-bold text-on-surface">
                      {selectedVehicle.type}
                    </span>
                  </div>
                  <div className="intel-row">
                    <span className="intel-label text-outline">Confidence:</span>
                    <span className="intel-value font-bold text-health-emerald">
                      {selectedVehicle.confidence}%
                    </span>
                  </div>
                  <div className="intel-row">
                    <span className="intel-label text-outline">Camera Source:</span>
                    <span className="intel-value font-bold text-primary-fixed-dim truncate max-w-[160px]">
                      {selectedVehicle.cameraSource}
                    </span>
                  </div>
                  <div className="intel-row">
                    <span className="intel-label text-outline">Speed / Motion:</span>
                    <span className="intel-value">
                      {selectedVehicle.speedKmh ? `${selectedVehicle.speedKmh} km/h · ` : ''}{selectedVehicle.direction || 'Stationary'}
                    </span>
                  </div>
                  {selectedVehicle.owner && (
                    <div className="intel-row">
                      <span className="intel-label text-outline">Owner:</span>
                      <span className="intel-value text-[10px] text-outline truncate max-w-[160px]">
                        {selectedVehicle.owner}
                      </span>
                    </div>
                  )}
                  {selectedVehicle.threatTag && (
                    <div className="intel-row">
                      <span className="intel-label text-error">Threat Tag:</span>
                      <span className="intel-value font-bold text-error">
                        {selectedVehicle.threatTag}
                      </span>
                    </div>
                  )}
                  {selectedVehicle.notes && (
                    <div className="py-1 border-t border-white/5 mt-1 text-[10px] text-on-surface-variant font-inter">
                      {selectedVehicle.notes}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-outline font-mono text-[11px]">
                No vehicles matching filter
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
