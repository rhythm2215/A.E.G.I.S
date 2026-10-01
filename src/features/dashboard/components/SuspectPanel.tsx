import { Plus, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, getThreatColor } from '@/lib/utils';
import { useSuspectStore } from '@/store/suspectStore';
import { useSelectionStore } from '@/store/selectionStore';

export function SuspectPanel({ style }: { style?: React.CSSProperties }) {
  const navigate = useNavigate();
  const { suspects } = useSuspectStore();
  const { selectedEntityType, selectedEntityId, selectSuspect } = useSelectionStore();

  return (
    <div
      style={style}
      className="tactical-glass rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden hud-border-top transition-shadow hover:shadow-[0_6px_30px_rgba(255,86,44,0.1)] shrink-0 min-h-[110px]"
    >
      {/* Header */}
      <header className="panel-header shrink-0 border-b border-white/5 px-3 py-2 bg-surface-container-high/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary-container" />
          <h2 className="panel-title text-secondary tracking-wider font-bold">SUSPECTS</h2>
          <span className="font-mono text-[10px] text-outline bg-surface-container-highest/60 px-1.5 py-0.5 rounded font-bold">
            {suspects.length}
          </span>
        </div>
        <button
          onClick={() => navigate('/records/new')}
          className="btn-icon-sm flex items-center gap-1 hover:border-secondary/40"
          title="Register New Suspect"
        >
          <Plus size={11} />
          <span className="font-mono text-[10px]">Add</span>
        </button>
      </header>

      {/* Suspects List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {suspects.map((suspect) => {
          const isSelected = selectedEntityType === 'suspect' && selectedEntityId === suspect.id;
          return (
            <button
              key={suspect.id}
              onClick={() => selectSuspect(suspect)}
              className={cn(
                'w-full border rounded-lg p-2 flex items-center gap-2.5 transition-all duration-150 text-left group',
                isSelected
                  ? 'border-secondary/70 bg-secondary/15 shadow-ambient-red ring-1 ring-secondary/50'
                  : 'border-outline-variant/30 bg-surface-charcoal/50 hover:bg-white/5 hover:border-outline-variant/50'
              )}
            >
              {suspect.facialImages[0] ? (
                <img
                  src={suspect.facialImages[0].url}
                  alt={suspect.fullName}
                  className="w-8 h-8 rounded-full object-cover border border-outline-variant/40 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center shrink-0">
                  <UserRound size={14} className="text-outline" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="font-mono text-data-mono font-bold text-secondary truncate">
                    {suspect.id}
                  </div>
                  <span className={cn('font-mono text-[10px] font-bold uppercase tracking-wider', getThreatColor(suspect.threatLevel))}>
                    {suspect.threatLevel}
                  </span>
                </div>
                <div className="font-inter text-[11px] text-on-surface-variant truncate">
                  {suspect.fullName}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
