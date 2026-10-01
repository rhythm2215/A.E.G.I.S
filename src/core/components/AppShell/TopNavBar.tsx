import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Map, Film, Settings, FileText, Grid3X3, ChevronDown, Wifi, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/notificationStore';
import { useUIStore } from '@/store/uiStore';
import type { PanelVisibility } from '@/types';

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const dayName = time.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dateStr = time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div className="text-right font-mono leading-tight shrink-0">
      <div className="text-[10px] text-outline tracking-widest whitespace-nowrap">{dayName} · {dateStr}</div>
      <div className="text-data-mono text-primary-fixed-dim text-glow-cyan whitespace-nowrap">
        {timeStr} <span className="text-outline text-[10px]">UTC+5:30</span>
      </div>
    </div>
  );
}

interface PanelMenuPortalProps {
  anchorRect: DOMRect;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

function PanelMenuPortal({ anchorRect, buttonRef, onClose }: PanelMenuPortalProps) {
  const { panelVisibility, setPanelVisibility } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const panels: { key: keyof PanelVisibility; label: string }[] = [
    { key: 'entityPanel',       label: 'Entity Panel' },
    { key: 'timelinePanel',     label: 'Timeline Panel' },
    { key: 'notificationPanel', label: 'Notification Panel' },
    { key: 'detailPanel',       label: 'Detail Panel' },
    { key: 'cameraControls',    label: 'Camera Controls' },
  ];

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const clickedButton = buttonRef.current?.contains(e.target as Node);
      const clickedMenu   = menuRef.current?.contains(e.target as Node);
      if (!clickedButton && !clickedMenu) onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const top  = anchorRect.bottom + 8;
  const left = anchorRect.left + anchorRect.width / 2;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: `${top}px`, left: `${left}px`, transform: 'translateX(-50%)', zIndex: 9999 }}
      className="tactical-glass rounded-lg py-2 min-w-[200px] shadow-panel animate-scale-in"
    >
      <div className="px-3 py-1.5 border-b border-white/5 mb-1">
        <span className="font-mono text-label-caps text-outline uppercase tracking-widest">Panel Visibility</span>
      </div>
      {panels.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setPanelVisibility(key, !panelVisibility[key])}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
        >
          <div className={cn(
            'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
            panelVisibility[key]
              ? 'bg-primary-container/20 border-primary-fixed-dim/60'
              : 'bg-transparent border-outline/40'
          )}>
            {panelVisibility[key] && <div className="w-2 h-2 rounded-sm bg-primary-fixed-dim" />}
          </div>
          <span className="font-mono text-body-md text-on-surface-variant">{label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}

export function TopNavBar() {
  const location    = useLocation();
  const navigate    = useNavigate();
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const [showPanelMenu, setShowPanelMenu] = useState(false);
  const [anchorRect, setAnchorRect]       = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDashboard = location.pathname === '/';

  const handlePanelButtonClick = () => {
    if (showPanelMenu) {
      setShowPanelMenu(false);
      setAnchorRect(null);
    } else if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
      setShowPanelMenu(true);
    }
  };

  const navItems = [
    { path: '/records',       label: 'Records',   icon: FileText },
    { path: '/',              label: 'Dashboard', icon: Map,      isDashboard: true },
    { path: '/multicam',      label: 'Multi-Cam', icon: Grid3X3 },
    { path: '/playback',      label: 'Playback',  icon: Film },
    { path: '/notifications', label: 'Alerts',    icon: Bell,     badge: unreadCount },
    { path: '/settings',      label: 'Settings',  icon: Settings },
  ];

  return (
    <header className={cn(
      'fixed top-3 left-1/2 -translate-x-1/2 z-50',
      'w-[calc(100%-24px)] max-w-[1920px]',
      'tactical-glass rounded-xl hud-glow',
      'flex items-center px-4 h-14 max-h-14',
    )}>
      <Link to="/" className="flex items-center gap-2 mr-4 shrink-0 group min-w-0">
        <Shield size={18} className="text-primary-fixed-dim text-glow-cyan shrink-0" />
        <div className="min-w-0">
          <div className="font-grotesk font-bold text-[14px] tracking-tighter text-primary-fixed-dim text-glow-cyan leading-none whitespace-nowrap">
            A.E.G.I.S.
          </div>
          <div className="font-mono text-[7px] text-outline tracking-[0.12em] leading-none mt-0.5 uppercase whitespace-nowrap hidden xl:block">
            Advanced Edge Geo-Intelligence &amp; Surveillance
          </div>
        </div>
      </Link>

      <div className="hidden xl:flex items-center gap-1.5 mr-4 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-health-emerald animate-pulse" />
        <span className="font-mono text-[10px] text-health-emerald tracking-widest whitespace-nowrap">OPERATIONAL</span>
      </div>

      <div className="w-px h-6 bg-outline-variant/30 mr-4 hidden xl:block shrink-0" />

      <nav className="flex items-center gap-0.5 shrink-0 overflow-hidden">
        {navItems.map(({ path, label, icon: Icon, badge, isDashboard: isDash }) => {
          const isActive = isDash ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-150 group',
                'whitespace-nowrap shrink-0 select-none',
                isActive
                  ? 'bg-primary-fixed-dim/10 text-primary-fixed-dim'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
              )}
            >
              <Icon size={13} className={cn('shrink-0', isActive ? 'text-primary-fixed-dim' : '')} />
              <span className={cn('font-mono text-[11px] tracking-widest uppercase font-semibold', isActive ? 'text-primary-fixed-dim' : '')}>
                {label}
              </span>
              {badge != null && badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-error text-white font-mono text-[9px] flex items-center justify-center font-bold shrink-0">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-primary-fixed-dim" />}
            </Link>
          );
        })}
      </nav>

      {isDashboard && (
        <button
          ref={buttonRef}
          onClick={handlePanelButtonClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all duration-150 whitespace-nowrap shrink-0 ml-0.5"
        >
          <Grid3X3 size={13} />
          <span className="font-mono text-[11px] tracking-widest uppercase font-semibold">Panels</span>
          <ChevronDown size={10} className={cn('transition-transform shrink-0', showPanelMenu && 'rotate-180')} />
        </button>
      )}

      {showPanelMenu && anchorRect && (
        <PanelMenuPortal
          anchorRect={anchorRect}
          buttonRef={buttonRef}
          onClose={() => { setShowPanelMenu(false); setAnchorRect(null); }}
        />
      )}

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-3 shrink-0 ml-3">
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          <Wifi size={12} className="text-health-emerald shrink-0" />
          <span className="font-mono text-[10px] text-health-emerald tracking-widest whitespace-nowrap">LIVE</span>
        </div>
        <div className="w-px h-6 bg-outline-variant/30 hidden lg:block shrink-0" />
        <LiveClock />
        <div className="w-px h-6 bg-outline-variant/30 shrink-0" />
        <button
          onClick={() => navigate('/settings')}
          className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-full bg-surface-container-high border border-outline-variant/40 flex items-center justify-center hover:border-primary-fixed-dim/40 transition-colors shrink-0"
        >
          <span className="font-mono text-[10px] font-bold text-primary-fixed-dim">OP</span>
        </button>
      </div>
    </header>
  );
}
