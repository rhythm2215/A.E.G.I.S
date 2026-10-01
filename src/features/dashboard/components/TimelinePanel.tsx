import { useState, useMemo } from 'react';
import { Search, Clock, Shield, AlertTriangle, Video, MapPin } from 'lucide-react';
import { cn, formatTimestamp } from '@/lib/utils';
import { useSurveillanceNodeStore } from '@/store/surveillanceNodeStore';
import { useIdentityStore } from '@/store/identityStore';
import { useSelectionStore } from '@/store/selectionStore';
import { mockTimelineEvents } from '@/services/mock/mockData';
import type { TimelineEvent } from '@/types';

export function TimelinePanel({ style }: { style?: React.CSSProperties }) {
  const { selectedNode } = useSurveillanceNodeStore();
  const { selectedPersonnel, selectedWatchlist, activeTab } = useIdentityStore();
  const { selectNode, selectWatchlist, selectPersonnel } = useSelectionStore();

  const [filterMode, setFilterMode] = useState<'node' | 'identity' | 'all'>('node');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter events based on active mode, selected camera node, search
  const filteredEvents = useMemo(() => {
    return mockTimelineEvents.filter((event) => {
      if (filterMode === 'node' && selectedNode) {
        if (event.droneId && event.droneId !== selectedNode.id) {
          return false;
        }
      } else if (filterMode === 'identity') {
        const targetId = activeTab === 'watchlist' ? selectedWatchlist?.id : selectedPersonnel?.id;
        if (targetId && event.suspectId && event.suspectId !== targetId) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = `${event.type} ${event.description} ${event.droneId || ''} ${event.suspectId || ''} ${event.locationName || ''}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }

      return true;
    });
  }, [filterMode, selectedNode, selectedWatchlist, selectedPersonnel, activeTab, searchQuery]);

  const handleEventClick = (evt: TimelineEvent) => {
    if (evt.suspectId) {
      selectWatchlist(evt.suspectId);
    } else if (evt.droneId) {
      selectNode(evt.droneId);
    }
  };

  const getEventBadge = (status?: string) => {
    if (status === 'CRITICAL') return 'bg-error/20 text-error border-error/40';
    if (status === 'HIGH') return 'bg-secondary-container/20 text-secondary border-secondary/40';
    if (status === 'MEDIUM') return 'bg-alert-amber/20 text-alert-amber border-alert-amber/40';
    return 'bg-health-emerald/20 text-health-emerald border-health-emerald/40';
  };

  return (
    <div
      style={style}
      className="tactical-glass rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden hud-border-top transition-shadow hover:shadow-[0_6px_30px_rgba(0,218,243,0.1)] shrink-0 min-h-[140px]"
    >
      {/* Panel Header */}
      <header className="panel-header shrink-0 flex-col gap-1.5 px-3 py-2 bg-surface-container-high/30 border-b border-white/5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 min-w-0">
            <Clock size={13} className="text-primary-fixed-dim shrink-0" />
            <h2 className="panel-title text-primary-fixed-dim font-bold tracking-wider truncate">
              TIMELINE
            </h2>
            <span className="font-mono text-[10px] text-outline bg-surface-container-highest/60 px-1.5 py-0.5 rounded font-bold shrink-0">
              {filteredEvents.length}
            </span>
          </div>

          {/* Toggle Mode: [ Node ] [ Identity ] [ All ] */}
          <div className="flex bg-surface-container-lowest border border-outline-variant/30 rounded p-0.5 shrink-0">
            <button
              onClick={() => setFilterMode('node')}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors',
                filterMode === 'node'
                  ? 'bg-primary-container/20 text-primary-fixed-dim'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              Node
            </button>
            <button
              onClick={() => setFilterMode('identity')}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors',
                filterMode === 'identity'
                  ? 'bg-secondary-container/20 text-secondary'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              Identity
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors',
                filterMode === 'all'
                  ? 'bg-white/10 text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              All
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
          <input
            type="text"
            placeholder={
              filterMode === 'node'
                ? `Filter ${selectedNode?.id || 'node'} events...`
                : 'Search event stream...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-lowest/80 border border-outline-variant/30 rounded pl-7 pr-2 py-1 text-[11px] font-mono text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-fixed-dim/50"
          />
        </div>
      </header>

      {/* Target Focus Indicator */}
      {filterMode === 'node' && selectedNode && (
        <div className="px-3 py-1 bg-surface-container-low/60 border-b border-white/5 flex items-center justify-between shrink-0 font-mono text-[10px]">
          <span className="text-outline uppercase tracking-wider">Filtered Node:</span>
          <span className="font-bold text-primary-fixed-dim truncate max-w-[190px]">
            {selectedNode.name}
          </span>
        </div>
      )}

      {/* Event Feed */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 relative custom-scrollbar min-h-0">
        <div className="absolute left-[20px] top-3 bottom-3 w-px bg-outline-variant/20 pointer-events-none" />

        {filteredEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-outline font-mono text-[11px]">
            <Clock size={16} className="mb-1 opacity-50" />
            <p>No timeline records for this selection</p>
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              onClick={() => handleEventClick(evt)}
              className="relative pl-6 group cursor-pointer"
            >
              {/* Timeline Dot */}
              <div
                className={cn(
                  'absolute left-1.5 top-2 w-2 h-2 rounded-full border border-black transition-transform group-hover:scale-125',
                  evt.alertStatus === 'CRITICAL'
                    ? 'bg-error animate-ping'
                    : evt.alertStatus === 'HIGH'
                    ? 'bg-secondary-container'
                    : evt.alertStatus === 'MEDIUM'
                    ? 'bg-alert-amber'
                    : 'bg-primary-fixed-dim'
                )}
              />

              {/* Event Card */}
              <div className="border border-outline-variant/30 rounded-lg p-2 bg-surface-charcoal/50 hover:bg-white/5 hover:border-outline-variant/60 transition-all">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-mono text-[11px] font-bold text-on-surface truncate">
                    {evt.type}
                  </span>
                  <span className="font-mono text-[9px] text-outline shrink-0">
                    {formatTimestamp(evt.timestamp)}
                  </span>
                </div>

                <p className="text-[11px] text-on-surface-variant leading-snug break-words">
                  {evt.description}
                </p>

                <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-white/5 font-mono text-[9px]">
                  <div className="flex items-center gap-1 text-outline truncate">
                    <MapPin size={9} className="shrink-0" />
                    <span className="truncate">{evt.locationName || evt.droneId}</span>
                  </div>

                  {evt.confidence != null && (
                    <span className="text-primary-fixed-dim shrink-0 font-bold">
                      {evt.confidence}% match
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
