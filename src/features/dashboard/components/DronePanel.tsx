import { useState, useEffect } from 'react';
import { Filter, Link2, ChevronDown, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, getStatusDot, getStatusColor } from '@/lib/utils';
import { useDroneStore } from '@/store/droneStore';
import { useSelectionStore } from '@/store/selectionStore';
import type { DroneStatus } from '@/types';

const DRONE_FILTERS: { label: string; value: DroneStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Patrol Active', value: 'patrol_active' },
  { label: 'Manual Control', value: 'manual_control' },
  { label: 'Returning Home', value: 'returning_home' },
  { label: 'Landing', value: 'landing' },
  { label: 'Idle', value: 'idle' },
  { label: 'Offline', value: 'offline' },
];

function DroneFilterMenu({ onClose }: { onClose: () => void }) {
  const { droneFilter, setDroneFilter } = useDroneStore();
  return (
    <div
      className="absolute top-full mt-1 right-0 tactical-glass rounded-lg py-1 min-w-[160px] z-50 shadow-2xl border border-white/10 animate-scale-in"
      onMouseLeave={onClose}
    >
      {DRONE_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => {
            setDroneFilter(f.value);
            onClose();
          }}
          className={cn(
            'w-full text-left px-3 py-1.5 font-mono text-body-md transition-colors hover:bg-white/5',
            droneFilter === f.value ? 'text-primary-fixed-dim font-bold' : 'text-on-surface-variant'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function DronePanel({ style }: { style?: React.CSSProperties }) {
  const navigate = useNavigate();
  const {
    drones,
    filteredDrones,
    activeCameraSource,
    cameraStatus,
    switchCameraSource,
    fetchCameraStatus,
  } = useDroneStore();
  const { selectedEntityType, selectedEntityId, selectDrone } = useSelectionStore();
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    fetchCameraStatus();
    const interval = setInterval(() => {
      fetchCameraStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchCameraStatus]);

  const shownDrones = filteredDrones();

  return (
    <div
      style={style}
      className="tactical-glass rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden hud-border-top transition-shadow hover:shadow-[0_6px_30px_rgba(0,218,243,0.1)] shrink-0 min-h-[110px]"
    >
      {/* Card Header */}
      <header className="panel-header shrink-0 border-b border-white/5 px-3 py-2 bg-surface-container-high/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary-fixed-dim animate-pulse" />
          <h2 className="panel-title text-primary-fixed-dim tracking-wider font-bold">DRONES & SENSORS</h2>
          <span className="font-mono text-[10px] text-outline bg-surface-container-highest/60 px-1.5 py-0.5 rounded font-bold">
            {shownDrones.length}/{drones.length}
          </span>
        </div>
        <div className="flex gap-1.5 relative">
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu((v) => !v)}
              className="btn-icon-sm flex items-center gap-1 hover:border-primary-fixed-dim/40"
            >
              <Filter size={11} />
              <span className="font-mono text-[10px]">Filter</span>
              <ChevronDown size={8} />
            </button>
            {showFilterMenu && <DroneFilterMenu onClose={() => setShowFilterMenu(false)} />}
          </div>
          <button
            onClick={() => navigate('/drones/new')}
            className="btn-icon-sm flex items-center gap-1 hover:border-primary-fixed-dim/40"
            title="Link / Provision Drone"
          >
            <Link2 size={11} />
            <span className="font-mono text-[10px]">Link</span>
          </button>
        </div>
      </header>

      {/* Drone List Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {shownDrones.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="font-mono text-[11px] text-outline">No drones match filter</p>
          </div>
        ) : (
          shownDrones.map((drone) => {
            const isSelected = selectedEntityType === 'drone' && selectedEntityId === drone.id;
            const isCameraSource = drone.id === 'Laptop Camera' || drone.id === 'Cam MB';
            const isFeedActive = isCameraSource && activeCameraSource === drone.id;

            return (
              <button
                key={drone.id}
                onClick={() => {
                  selectDrone(drone);
                  if (isCameraSource) {
                    switchCameraSource(drone.id);
                  }
                }}
                className={cn(
                  'w-full border rounded-lg p-2 flex items-center justify-between transition-all duration-150 text-left group relative',
                  isSelected
                    ? 'border-primary-fixed-dim/70 bg-primary-fixed-dim/15 shadow-ambient-cyan ring-1 ring-primary-fixed-dim/50'
                    : isFeedActive
                    ? 'border-health-emerald/50 bg-health-emerald/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'border-outline-variant/30 bg-surface-charcoal/50 hover:bg-white/5 hover:border-outline-variant/50'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      isCameraSource && isFeedActive
                        ? cameraStatus === 'unavailable'
                          ? 'bg-error animate-ping'
                          : cameraStatus === 'connecting'
                          ? 'bg-alert-amber animate-pulse'
                          : 'bg-health-emerald animate-pulse'
                        : getStatusDot(drone.status)
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-data-mono font-bold text-primary-fixed-dim truncate">
                        {drone.id}
                      </span>
                      {isFeedActive && (
                        <span
                          className={cn(
                            'font-mono text-[8.5px] px-1 py-0.2 rounded font-bold uppercase tracking-wider border shrink-0',
                            cameraStatus === 'unavailable'
                              ? 'bg-error/20 text-error border-error/40'
                              : cameraStatus === 'connecting'
                              ? 'bg-alert-amber/20 text-alert-amber border-alert-amber/40'
                              : 'bg-primary-container/20 text-primary-fixed-dim border-primary-fixed-dim/40'
                          )}
                        >
                          {cameraStatus === 'unavailable'
                            ? 'OFFLINE'
                            : cameraStatus === 'connecting'
                            ? 'SYNCING'
                            : 'LIVE FEED'}
                        </span>
                      )}
                    </div>
                    <div className={cn('text-[10px] font-mono capitalize truncate', getStatusColor(drone.status))}>
                      {isCameraSource
                        ? isFeedActive
                          ? `Optical Feed • ${cameraStatus}`
                          : 'Standby Sensor'
                        : drone.status.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                  {isCameraSource ? (
                    <Video
                      size={13}
                      className={cn(
                        isFeedActive ? 'text-primary-fixed-dim' : 'text-outline',
                        'transition-colors'
                      )}
                    />
                  ) : (
                    <span
                      className={cn(
                        'font-mono text-[11px] font-bold',
                        drone.battery.percentage <= 20
                          ? 'text-error'
                          : drone.battery.percentage <= 40
                          ? 'text-alert-amber'
                          : 'text-health-emerald'
                      )}
                    >
                      {drone.battery.percentage}%
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
