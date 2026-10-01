import { Bell, CheckCheck, ChevronRight, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatTimestamp, getPriorityColor, getPriorityBg } from '@/lib/utils';
import { useNotificationStore } from '@/store/notificationStore';
import { useSelectionStore } from '@/store/selectionStore';
import type { Notification } from '@/types';

export function NotificationPanel({ style }: { style?: React.CSSProperties }) {
  const navigate = useNavigate();
  const {
    notifications,
    acknowledgeNotification,
    markAllRead,
    clearAll,
    filterPriority,
    setFilterPriority,
    unreadCount,
  } = useNotificationStore();

  const { selectedEntityType, selectedEntityId, selectDrone, selectSuspect } = useSelectionStore();

  const handleCardClick = (ntf: Notification) => {
    if (ntf.suspectId) {
      selectSuspect(ntf.suspectId);
    } else if (ntf.droneId) {
      selectDrone(ntf.droneId);
    }
  };

  const handleAction = (e: React.MouseEvent, action: string, suspectId?: string, droneId?: string) => {
    e.stopPropagation();
    if (suspectId) {
      selectSuspect(suspectId);
    } else if (droneId) {
      selectDrone(droneId);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filterPriority !== 'all' && n.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div
      style={style}
      className="tactical-glass rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden hud-border-top transition-shadow hover:shadow-[0_6px_30px_rgba(255,193,7,0.1)] shrink-0 min-h-[140px]"
    >
      {/* Header */}
      <header className="panel-header shrink-0 px-3 py-2 bg-surface-container-high/30 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell size={13} className="text-alert-amber" />
            {unreadCount() > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-error animate-ping" />
            )}
          </div>
          <h2 className="panel-title text-alert-amber font-bold tracking-wider">ALERTS</h2>
          <span className="font-mono text-[10px] text-outline bg-surface-container-highest/60 px-1.5 py-0.5 rounded font-bold">
            {unreadCount()} new
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={markAllRead}
            title="Mark all as read"
            className="btn-icon-sm"
          >
            <CheckCheck size={11} />
          </button>
          <button
            onClick={clearAll}
            title="Clear all alerts"
            className="btn-icon-sm hover:border-error/40 hover:text-error"
          >
            <Trash2 size={11} />
          </button>
          <button
            onClick={() => navigate('/notifications')}
            title="Open Notification Center"
            className="btn-icon-sm"
          >
            <ChevronRight size={11} />
          </button>
        </div>
      </header>

      {/* Priority Filter Bar */}
      <div className="px-3 py-1 border-b border-white/5 flex items-center justify-between gap-1 overflow-x-auto shrink-0">
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFilterPriority(p)}
            className={cn(
              'px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-colors shrink-0',
              filterPriority === p
                ? 'bg-primary-container/20 text-primary-fixed-dim font-bold'
                : 'text-outline hover:text-on-surface'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-3 gap-2">
            <Bell size={18} className="text-outline/30" />
            <p className="font-mono text-[11px] text-outline">No Active Alerts</p>
            <p className="font-mono text-[9px] text-outline/50">Live AI pipeline events will appear here</p>
          </div>
        ) : (
          filtered.map((ntf) => {
            const isCardActive =
              (ntf.droneId && selectedEntityType === 'drone' && selectedEntityId === ntf.droneId) ||
              (ntf.suspectId && selectedEntityType === 'suspect' && selectedEntityId === ntf.suspectId);

            return (
              <div
                key={ntf.id}
                onClick={() => handleCardClick(ntf)}
                className={cn(
                  'border rounded-lg p-2.5 transition-all text-left relative overflow-hidden cursor-pointer hover:border-white/30',
                  getPriorityBg(ntf.priority),
                  isCardActive ? 'ring-2 ring-primary-fixed-dim shadow-ambient-cyan' : !ntf.acknowledged ? 'ring-1 ring-white/10' : 'opacity-80'
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={cn('font-mono text-[10px] font-bold uppercase tracking-wider truncate', getPriorityColor(ntf.priority))}>
                    [{ntf.priority}] {ntf.title}
                  </span>
                  <span className="font-mono text-[9px] text-outline shrink-0">
                    {formatTimestamp(ntf.timestamp)}
                  </span>
                </div>

                <p className="text-[11px] text-on-surface leading-tight mb-1.5">
                  {ntf.message}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1">
                    {ntf.actions?.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleAction(e, act.action, ntf.suspectId, ntf.droneId)}
                        className={cn(
                          'px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase transition-all',
                          act.variant === 'primary'
                            ? 'bg-primary-container/20 text-primary-fixed-dim hover:bg-primary-container/40'
                            : act.variant === 'danger'
                            ? 'bg-secondary-container/20 text-secondary hover:bg-secondary-container/40'
                            : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
                        )}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>

                  {!ntf.acknowledged && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        acknowledgeNotification(ntf.id);
                      }}
                      className="text-[9px] font-mono text-outline hover:text-health-emerald transition-colors"
                    >
                      ACK
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
