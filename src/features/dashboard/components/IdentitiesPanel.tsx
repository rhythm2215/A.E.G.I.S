import { useState } from 'react';
import { UserRound, Plus, ShieldCheck, AlertOctagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, getThreatColor } from '@/lib/utils';
import { useIdentityStore } from '@/store/identityStore';
import { useSelectionStore } from '@/store/selectionStore';
import type { Personnel, Suspect } from '@/types';

export function IdentitiesPanel({ style }: { style?: React.CSSProperties }) {
  const navigate = useNavigate();
  const {
    activeTab,
    setActiveTab,
    personnel,
    watchlist,
    selectedPersonnel,
    selectedWatchlist,
  } = useIdentityStore();

  const { selectPersonnel, selectWatchlist } = useSelectionStore();

  const isPersonnelTab = activeTab === 'personnel';

  return (
    <div
      style={style}
      className={cn(
        'tactical-glass rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden hud-border-top transition-shadow shrink-0 min-h-[140px]',
        isPersonnelTab
          ? 'hover:shadow-[0_6px_30px_rgba(0,218,243,0.1)]'
          : 'hover:shadow-[0_6px_30px_rgba(255,86,44,0.1)]'
      )}
    >
      {/* Panel Header */}
      <header className="panel-header shrink-0 border-b border-white/5 px-3 py-2 bg-surface-container-high/30">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              isPersonnelTab ? 'bg-primary-fixed-dim' : 'bg-secondary-container'
            )}
          />
          <h2
            className={cn(
              'panel-title tracking-wider font-bold truncate',
              isPersonnelTab ? 'text-primary-fixed-dim' : 'text-secondary'
            )}
          >
            IDENTITIES
          </h2>
        </div>

        {/* Tab Toggle: [ Personnel ] [ Watchlist ] */}
        <div className="flex bg-surface-container-lowest border border-outline-variant/30 rounded p-0.5 shrink-0">
          <button
            onClick={() => setActiveTab('personnel')}
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors',
              isPersonnelTab
                ? 'bg-primary-container/20 text-primary-fixed-dim'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            Personnel
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-colors',
              !isPersonnelTab
                ? 'bg-secondary-container/20 text-secondary'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            Watchlist
          </button>
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/records/new')}
          className="btn-icon-sm h-7 w-7 flex items-center justify-center hover:border-primary-fixed-dim/40 shrink-0"
          title={isPersonnelTab ? 'Enroll Authorized Personnel' : 'Add to Watchlist'}
        >
          <Plus size={12} />
        </button>
      </header>

      {/* Content Feed */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar min-h-0">
        {isPersonnelTab ? (
          /* ── PERSONNEL LIST (Authorized) ── */
          personnel.map((p) => {
            const isSelected = selectedPersonnel?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => selectPersonnel(p)}
                className={cn(
                  'w-full border rounded-lg p-2 flex items-center gap-2.5 transition-all duration-150 text-left group min-w-0',
                  isSelected
                    ? 'border-primary-fixed-dim/70 bg-primary-container/15 shadow-ambient-cyan ring-1 ring-primary-fixed-dim/50'
                    : 'border-outline-variant/30 bg-surface-charcoal/50 hover:bg-white/5 hover:border-outline-variant/50'
                )}
              >
                {/* Photo / Avatar */}
                <div className="relative shrink-0">
                  {p.faceImage ? (
                    <img
                      src={p.faceImage}
                      alt={p.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-primary-fixed-dim/40"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center">
                      <UserRound size={14} className="text-outline" />
                    </div>
                  )}
                  <ShieldCheck
                    size={11}
                    className="absolute -bottom-1 -right-1 text-primary-fixed-dim bg-surface-charcoal rounded-full"
                  />
                </div>

                {/* Identity Info */}
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-data-mono font-bold text-primary-fixed-dim truncate text-[11px]">
                      {p.id} · {p.fullName}
                    </span>
                    <span className="font-mono text-[9px] font-bold text-health-emerald shrink-0">
                      {p.recognitionConfidence}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5 text-on-surface-variant text-[10px]">
                    <span className="truncate" title={p.rank}>{p.rank}</span>
                    <span className="font-mono text-[9px] text-outline shrink-0">{p.unit.slice(0, 10)}</span>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          /* ── WATCHLIST LIST (Suspects) ── */
          watchlist.map((suspect) => {
            const isSelected = selectedWatchlist?.id === suspect.id;
            return (
              <button
                key={suspect.id}
                onClick={() => selectWatchlist(suspect)}
                className={cn(
                  'w-full border rounded-lg p-2 flex items-center gap-2.5 transition-all duration-150 text-left group min-w-0',
                  isSelected
                    ? 'border-secondary/70 bg-secondary/15 shadow-ambient-red ring-1 ring-secondary/50'
                    : 'border-outline-variant/30 bg-surface-charcoal/50 hover:bg-white/5 hover:border-outline-variant/50'
                )}
              >
                {/* Photo / Avatar */}
                <div className="relative shrink-0">
                  {suspect.facialImages && suspect.facialImages[0] ? (
                    <img
                      src={suspect.facialImages[0].url}
                      alt={suspect.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-secondary/40"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center">
                      <UserRound size={14} className="text-outline" />
                    </div>
                  )}
                  <AlertOctagon
                    size={11}
                    className="absolute -bottom-1 -right-1 text-secondary bg-surface-charcoal rounded-full"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-data-mono font-bold text-secondary truncate text-[11px]">
                      {suspect.id} · {suspect.fullName}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[9px] font-bold uppercase tracking-wider shrink-0',
                        getThreatColor(suspect.threatLevel)
                      )}
                    >
                      {suspect.threatLevel}
                    </span>
                  </div>
                  <div className="font-inter text-[10px] text-on-surface-variant truncate mt-0.5">
                    {suspect.intelligence?.criminalHistory?.[0] || 'Wanted on active warrant'}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
