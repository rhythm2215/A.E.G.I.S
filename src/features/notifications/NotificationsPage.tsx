import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, AlertTriangle, ShieldAlert, Radio, Search, Filter,
  Download, Trash2, CheckCircle2, ArrowRight, Shield
} from 'lucide-react';
import { cn, formatTimestamp, formatDate, getPriorityColor, getPriorityBg } from '@/lib/utils';
import { useNotificationStore } from '@/store/notificationStore';
import { useSuspectStore } from '@/store/suspectStore';
import { useDroneStore } from '@/store/droneStore';
import type { NotificationPriority, NotificationType } from '@/types';

export function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    acknowledgeNotification,
    markAllRead,
    dismissNotification,
  } = useNotificationStore();

  const { setSelectedSuspect, suspects } = useSuspectStore();
  const { setSelectedDrone, drones } = useDroneStore();

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [showUnacknowledgedOnly, setShowUnacknowledgedOnly] = useState(false);

  // Metrics count
  const criticalCount = notifications.filter((n) => n.priority === 'critical').length;
  const highCount = notifications.filter((n) => n.priority === 'high').length;
  const mediumCount = notifications.filter((n) => n.priority === 'medium').length;
  const unackCount = notifications.filter((n) => !n.acknowledged).length;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (showUnacknowledgedOnly && n.acknowledged) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const text = `${n.title} ${n.message} ${n.droneId || ''} ${n.suspectId || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [notifications, priorityFilter, typeFilter, showUnacknowledgedOnly, search]);

  const handleAction = (action: string, suspectId?: string, droneId?: string) => {
    if (action === 'navigate_suspect' && suspectId) {
      navigate(`/records/${suspectId}`);
    } else if (action === 'dispatch_drone' || (action === 'override_return' && droneId)) {
      const d = drones.find((dr) => dr.id === droneId);
      if (d) setSelectedDrone(d);
      navigate('/');
    } else if (action === 'navigate_map') {
      navigate('/');
    }
  };

  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(filteredNotifications, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AEGIS_tactical_event_log_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 pb-12 animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 tactical-glass p-5 rounded-xl border border-glass">
        <div>
          <div className="flex items-center gap-2.5">
            <Bell size={22} className="text-alert-amber" />
            <h1 className="font-grotesk font-bold text-headline-md text-on-surface">
              A.E.G.I.S. Tactical Event & Alert Log
            </h1>
          </div>
          <p className="text-body-md text-on-surface-variant font-inter mt-0.5">
            Real-time event logging, priority incident triaging, geofence alarm feeds, and multi-drone tracking escalations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={markAllRead}
            className="btn-ghost py-2 px-3.5 flex items-center gap-1.5 font-mono text-body-md"
          >
            <CheckCheck size={14} />
            <span>Acknowledge All</span>
          </button>
          <button
            onClick={handleExportLogs}
            className="btn-primary py-2 px-3.5 flex items-center gap-1.5 font-mono text-body-md"
          >
            <Download size={14} />
            <span>Export Event Logs</span>
          </button>
        </div>
      </div>

      {/* ── Metric Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="tactical-glass p-4 rounded-xl border border-error/30 bg-error/5 flex items-center justify-between">
          <div>
            <div className="font-mono text-label-caps text-error uppercase">Critical Alarms</div>
            <div className="font-mono text-headline-md font-bold text-error mt-0.5">{criticalCount}</div>
          </div>
          <AlertTriangle size={24} className="text-error opacity-80" />
        </div>

        <div className="tactical-glass p-4 rounded-xl border border-secondary/30 bg-secondary/5 flex items-center justify-between">
          <div>
            <div className="font-mono text-label-caps text-secondary uppercase">High Priority</div>
            <div className="font-mono text-headline-md font-bold text-secondary mt-0.5">{highCount}</div>
          </div>
          <ShieldAlert size={24} className="text-secondary opacity-80" />
        </div>

        <div className="tactical-glass p-4 rounded-xl border border-alert-amber/30 bg-alert-amber/5 flex items-center justify-between">
          <div>
            <div className="font-mono text-label-caps text-alert-amber uppercase">Medium Warnings</div>
            <div className="font-mono text-headline-md font-bold text-alert-amber mt-0.5">{mediumCount}</div>
          </div>
          <Radio size={24} className="text-alert-amber opacity-80" />
        </div>

        <div className="tactical-glass p-4 rounded-xl border border-glass flex items-center justify-between">
          <div>
            <div className="font-mono text-label-caps text-outline uppercase">Unacknowledged</div>
            <div className="font-mono text-headline-md font-bold text-primary-fixed-dim mt-0.5">{unackCount}</div>
          </div>
          <CheckCircle2 size={24} className="text-primary-fixed-dim opacity-80" />
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="tactical-glass p-4 rounded-xl border border-glass space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              placeholder="Search alerts by title, keyword, Drone ID, or Suspect ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-glass pl-9"
            />
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="input-glass font-mono text-body-md"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="input-glass font-mono text-body-md"
            >
              <option value="all">All Event Types</option>
              <option value="suspect_detection">Suspect Detection</option>
              <option value="suspect_tracking">Suspect Tracking</option>
              <option value="drone_status">Drone Health & Status</option>
              <option value="multi_drone">Multi-Drone Coordination</option>
              <option value="geofence">Geofence Violations</option>
              <option value="system">System & AI Infrastructure</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5 font-mono text-body-md">
          <label className="flex items-center gap-2 cursor-pointer text-on-surface-variant hover:text-on-surface">
            <input
              type="checkbox"
              checked={showUnacknowledgedOnly}
              onChange={(e) => setShowUnacknowledgedOnly(e.target.checked)}
              className="rounded bg-surface-container-lowest border-outline/40 text-primary-fixed-dim focus:ring-0"
            />
            <span>Unacknowledged Alerts Only</span>
          </label>

          <span className="text-outline text-label-caps">
            Showing {filteredNotifications.length} of {notifications.length} events
          </span>
        </div>
      </div>

      {/* ── Alerts Feed List ── */}
      <div className="space-y-2.5">
        {filteredNotifications.length === 0 ? (
          <div className="tactical-glass p-8 rounded-xl border border-glass text-center text-outline">
            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50" />
            <p className="font-mono text-headline-sm">No events match your current filter</p>
          </div>
        ) : (
          filteredNotifications.map((ntf) => (
            <div
              key={ntf.id}
              className={cn(
                'tactical-glass p-4 rounded-xl border transition-all space-y-2.5',
                getPriorityBg(ntf.priority),
                !ntf.acknowledged ? 'ring-1 ring-white/10' : 'opacity-85'
              )}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className={cn('px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider', getPriorityColor(ntf.priority))}>
                    {ntf.priority}
                  </span>
                  <span className="font-grotesk font-bold text-[14px] text-on-surface">
                    {ntf.title}
                  </span>
                  <span className="font-mono text-[10px] text-outline bg-surface-container-highest px-1.5 py-0.5 rounded">
                    {ntf.type.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-outline">
                  {formatDate(ntf.timestamp)} · {formatTimestamp(ntf.timestamp)}
                </div>
              </div>

              <p className="text-body-md text-on-surface font-inter">
                {ntf.message}
              </p>

              {/* Action Buttons & Status Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  {ntf.droneId && (
                    <span className="text-primary-fixed-dim bg-primary-fixed-dim/10 px-2 py-0.5 rounded">
                      Drone: {ntf.droneId}
                    </span>
                  )}
                  {ntf.suspectId && (
                    <span className="text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                      Target: {ntf.suspectId}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {ntf.actions?.map((act, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAction(act.action, ntf.suspectId, ntf.droneId)}
                      className={cn(
                        'px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-colors',
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

                  {!ntf.acknowledged ? (
                    <button
                      onClick={() => acknowledgeNotification(ntf.id)}
                      className="btn-ghost py-1 px-2.5 text-[10px]"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="text-health-emerald flex items-center gap-1 text-[10px]">
                      <CheckCircle2 size={11} /> Acknowledged
                    </span>
                  )}

                  <button
                    onClick={() => dismissNotification(ntf.id)}
                    className="p-1 rounded text-outline hover:text-error transition-colors"
                    title="Dismiss alert"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
