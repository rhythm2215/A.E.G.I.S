import { useState } from 'react';
import { Plus, Filter, Link2, ChevronDown, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDroneStore } from '@/store/droneStore';
import { useSuspectStore } from '@/store/suspectStore';
import { useUIStore } from '@/store/uiStore';
import { getStatusDot, getStatusColor, getThreatColor } from '@/lib/utils';
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
    <div className="absolute top-full mt-1 right-0 tactical-glass rounded-lg py-1 min-w-[160px] z-50 shadow-panel animate-scale-in"
      onMouseLeave={onClose}>
      {DRONE_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => { setDroneFilter(f.value); onClose(); }}
          className={cn(
            'w-full text-left px-3 py-1.5 font-mono text-body-md transition-colors hover:bg-white/5',
            droneFilter === f.value ? 'text-primary-fixed-dim' : 'text-on-surface-variant'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function EntityPanel() {
  const navigate = useNavigate();
  const { drones, selectedDrone, setSelectedDrone, droneFilter, filteredDrones } = useDroneStore();
  const { suspects, selectedSuspect, setSelectedSuspect } = useSuspectStore();
  const { setSelectedMapEntity, setTimelineMode } = useUIStore();
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const handleDroneClick = (drone: typeof drones[0]) => {
    setSelectedDrone(drone);
    setSelectedSuspect(null);
    setSelectedMapEntity(drone.id, 'drone');
    setTimelineMode('drone');
  };

  const handleSuspectClick = (suspect: typeof suspects[0]) => {
    setSelectedSuspect(suspect);
    setSelectedDrone(null);
    setSelectedMapEntity(suspect.id, 'suspect');
    setTimelineMode('suspect');
  };

  const shownDrones = filteredDrones();

  return (
    <section className="panel flex-1 min-h-0 animate-slide-in-left">
      {/* Drones section */}
      <div className="flex-1 flex flex-col border-b border-white/5 min-h-0" style={{ flex: '1 1 50%' }}>
        <header className="panel-header shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim animate-pulse" />
            <h2 className="panel-title">Drones</h2>
            <span className="font-mono text-[10px] text-outline bg-surface-container-highest/50 px-1.5 py-0.5 rounded">
              {shownDrones.length}/{drones.length}
            </span>
          </div>
          <div className="flex gap-1.5 relative">
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu((v) => !v)}
                onMouseEnter={() => setShowFilterMenu(true)}
                className="btn-icon-sm flex items-center gap-1"
              >
                <Filter size={11} />
                <span className="font-mono text-[10px]">Filter</span>
                <ChevronDown size={8} />
              </button>
              {showFilterMenu && <DroneFilterMenu onClose={() => setShowFilterMenu(false)} />}
            </div>
            <button
              onClick={() => navigate('/drones/new')}
              className="btn-icon-sm flex items-center gap-1"
            >
              <Link2 size={11} />
              <span className="font-mono text-[10px]">Link</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {shownDrones.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-mono text-body-md text-outline text-center">No drones match filter</p>
            </div>
          ) : (
            shownDrones.map((drone) => (
              <button
                key={drone.id}
                onClick={() => handleDroneClick(drone)}
                className={cn(
                  'w-full border rounded-lg p-2.5 flex items-center justify-between transition-all duration-150 group text-left',
                  selectedDrone?.id === drone.id
                    ? 'border-primary-fixed-dim/50 bg-primary-fixed-dim/8 shadow-ambient-cyan'
                    : 'border-outline-variant/30 bg-surface-charcoal/40 hover:bg-white/5 hover:border-outline-variant/50'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', getStatusDot(drone.status))} />
                  <div className="min-w-0">
                    <div className="font-mono text-data-mono text-primary-fixed-dim truncate">{drone.id}</div>
                    <div className={cn('text-[10px] font-mono capitalize', getStatusColor(drone.status))}>
                      {drone.status.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={cn('font-mono text-[11px]', drone.battery.percentage <= 20 ? 'text-error' : drone.battery.percentage <= 40 ? 'text-alert-amber' : 'text-health-emerald')}>
                    {drone.battery.percentage}%
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Suspects section */}
      <div className="flex flex-col min-h-0" style={{ flex: '1 1 50%' }}>
        <header className="panel-header shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
            <h2 className="panel-title">Suspects</h2>
            <span className="font-mono text-[10px] text-outline bg-surface-container-highest/50 px-1.5 py-0.5 rounded">
              {suspects.length}
            </span>
          </div>
          <button
            onClick={() => navigate('/records/new')}
            className="btn-icon-sm flex items-center gap-1"
          >
            <Plus size={11} />
            <span className="font-mono text-[10px]">Add</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {suspects.map((suspect) => (
            <button
              key={suspect.id}
              onClick={() => handleSuspectClick(suspect)}
              className={cn(
                'w-full border rounded-lg p-2.5 flex items-center gap-2.5 transition-all duration-150 text-left',
                selectedSuspect?.id === suspect.id
                  ? 'border-secondary/50 bg-secondary/8 shadow-ambient-red'
                  : 'border-outline-variant/30 bg-surface-charcoal/40 hover:bg-white/5 hover:border-outline-variant/50'
              )}
            >
              {suspect.facialImages[0] ? (
                <img
                  src={suspect.facialImages[0].url}
                  alt={suspect.fullName}
                  className="w-8 h-8 rounded-full object-cover border border-outline-variant/30 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center shrink-0">
                  <UserRound size={14} className="text-outline" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-data-mono text-secondary truncate">{suspect.id}</div>
                  <span className={cn('font-mono text-[10px] uppercase', getThreatColor(suspect.threatLevel))}>
                    {suspect.threatLevel}
                  </span>
                </div>
                <div className="font-inter text-[11px] text-on-surface-variant truncate">{suspect.fullName}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
