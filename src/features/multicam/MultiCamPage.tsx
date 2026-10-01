import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid2X2, Grid3X3, Maximize2, Minimize2, Video,
  AlertTriangle, Users, Car, Bell, Shield, ArrowUpRight,
  Loader2, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSurveillanceNodeStore } from '@/store/surveillanceNodeStore';
import { useSelectionStore } from '@/store/selectionStore';
import type { SurveillanceNode } from '@/types';

type TileFeedState = 'connecting' | 'live' | 'error';

export function MultiCamPage() {
  const navigate = useNavigate();
  const { nodes, selectNode } = useSurveillanceNodeStore();
  const { selectNode: selectNodeInApp } = useSelectionStore();

  const [gridLayout, setGridLayout] = useState<'2x2' | '3x3'>('2x2');
  const [focusedNode, setFocusedNode] = useState<SurveillanceNode | null>(null);
  // Per-tile feed states: key = node.id
  const [tileFeedStates, setTileFeedStates] = useState<Record<string, TileFeedState>>({});

  const setTileFeed = useCallback((nodeId: string, state: TileFeedState) => {
    setTileFeedStates((prev) => ({ ...prev, [nodeId]: state }));
  }, []);

  // If 2x2, take 4 nodes; if 3x3, take up to 9 nodes (or fill with available)
  const displayedNodes =
    gridLayout === '2x2' ? nodes.slice(0, 4) : nodes.slice(0, 9);

  const handleFocusNode = (node: SurveillanceNode) => {
    selectNode(node);
    selectNodeInApp(node);
    navigate('/');
  };

  return (
    <div className="w-full h-full px-4 pb-4 flex flex-col gap-3 select-none overflow-hidden">
      {/* ── Top Bar Controls ── */}
      <div className="tactical-glass px-4 py-2.5 rounded-xl border border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-health-emerald animate-pulse" />
          <div>
            <h1 className="font-grotesk font-bold text-headline-sm text-on-surface leading-none">
              SYNCHRONIZED MULTI-CAMERA COMMAND GRID
            </h1>
            <p className="font-mono text-[10px] text-outline tracking-wider mt-0.5">
              REAL-TIME EDGE STREAM MULTIPLEXING · ALL NODES 30 FPS SYNCHRONIZED
            </p>
          </div>
        </div>

        {/* Layout Switcher: 2x2 vs 3x3 */}
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-0.5 font-mono text-[11px]">
            <button
              onClick={() => setGridLayout('2x2')}
              className={cn(
                'px-3 py-1 rounded flex items-center gap-1.5 transition-colors font-bold',
                gridLayout === '2x2'
                  ? 'bg-primary-container/20 text-primary-fixed-dim shadow-ambient-cyan'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Grid2X2 size={13} />
              <span>2x2 Grid</span>
            </button>
            <button
              onClick={() => setGridLayout('3x3')}
              className={cn(
                'px-3 py-1 rounded flex items-center gap-1.5 transition-colors font-bold',
                gridLayout === '3x3'
                  ? 'bg-primary-container/20 text-primary-fixed-dim shadow-ambient-cyan'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Grid3X3 size={13} />
              <span>3x3 Grid</span>
            </button>
          </div>

          <div className="h-6 w-px bg-outline-variant/30 mx-1 hidden sm:block" />

          <button
            onClick={() => handleFocusNode(nodes[0])}
            className="btn-primary py-1.5 px-3 font-mono text-[10px] flex items-center gap-1"
          >
            <span>Live Command Feed</span>
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* ── Camera Grid ── */}
      <div
        className={cn(
          'flex-1 grid gap-3 min-h-0 overflow-hidden',
          gridLayout === '2x2' ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3 grid-rows-2 sm:grid-rows-3'
        )}
      >
        {displayedNodes.map((node) => {
          return (
            <div
              key={node.id}
              className="tactical-glass rounded-xl border border-white/10 overflow-hidden flex flex-col relative group hover:border-primary-fixed-dim/60 transition-all hover:shadow-[0_4px_24px_rgba(0,218,243,0.15)]"
            >
              {/* Tile Video View Area */}
              {(() => {
                const hasStream = Boolean(node.streamUrl);
                const tileState = tileFeedStates[node.id] ?? 'connecting';
                const isLive = hasStream && tileState === 'live';
                return (
                  <div className="relative flex-1 bg-black overflow-hidden scan-lines">
                    {/* NO SIGNAL overlay for cameras with no assigned stream */}
                    {!hasStream && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04080a] z-10">
                        <div
                          className="absolute inset-0 opacity-[0.07]"
                          style={{
                            backgroundImage: `repeating-linear-gradient(45deg, rgba(0,218,243,0.5) 0px, rgba(0,218,243,0.5) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, rgba(0,218,243,0.5) 0px, rgba(0,218,243,0.5) 1px, transparent 1px, transparent 12px)`,
                          }}
                        />
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <WifiOff size={20} className="text-outline/50" />
                          <span className="font-mono text-[10px] text-outline tracking-widest">NO SIGNAL</span>
                          <span className="font-mono text-[9px] text-outline/50 tracking-wider">CAMERA OFFLINE</span>
                        </div>
                      </div>
                    )}

                    {/* Feed placeholder while connecting (only for cameras with a stream) */}
                    {hasStream && !isLive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060b0c] z-10">
                        <div
                          className="absolute inset-0 opacity-10"
                          style={{
                            backgroundImage: `linear-gradient(to right, rgba(0,218,243,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,218,243,0.3) 1px, transparent 1px)`,
                            backgroundSize: '30px 30px',
                          }}
                        />
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          {tileState === 'error' ? (
                            <WifiOff size={18} className="text-error/60" />
                          ) : (
                            <Loader2 size={18} className="text-primary-fixed-dim/50 animate-spin" />
                          )}
                          <span className="font-mono text-[9px] text-outline tracking-wider">
                            {tileState === 'error' ? 'FEED UNAVAILABLE' : 'ACQUIRING…'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Live stream image — only when node has an assigned stream URL */}
                    {hasStream && (
                      <img
                        src={node.streamUrl}
                        alt={node.name}
                        onLoad={() => setTileFeed(node.id, 'live')}
                        onError={(e) => {
                          setTileFeed(node.id, 'connecting');
                          const t = e.currentTarget;
                          setTimeout(() => { if (t) t.src = `${node.streamUrl}?t=${Date.now()}`; }, 2000);
                        }}
                        className={cn('w-full h-full object-cover', !isLive && 'opacity-0')}
                      />
                    )}

                  {/* Tile Status Badge — always visible on hover */}
                  <div className="absolute top-2 left-2 flex items-center gap-2 tactical-glass px-2.5 py-1 rounded-md border border-white/10 z-10 font-mono text-[11px]">
                    {isLive
                      ? <div className="w-2 h-2 rounded-full bg-error animate-ping" />
                      : <div className="w-2 h-2 rounded-full bg-outline" />
                    }
                      <span className="text-primary-fixed-dim font-bold">{node.id}</span>
                      <span className="text-outline">·</span>
                      <span className="text-on-surface text-[10px] truncate max-w-[130px]">{node.name}</span>
                    </div>

                    {/* Top Right Action & Expand */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                      <button
                        onClick={() => setFocusedNode(node)}
                        className="p-1 rounded bg-black/60 text-white/70 hover:text-white border border-white/10"
                        title="Fullscreen preview"
                      >
                        <Maximize2 size={12} />
                      </button>
                      <button
                        onClick={() => handleFocusNode(node)}
                        className="p-1 rounded bg-primary-container/20 text-primary-fixed-dim hover:bg-primary-container/40 border border-primary-fixed-dim/30"
                        title="Open in Central Command"
                      >
                        <ArrowUpRight size={12} />
                      </button>
                    </div>

                    {/* Bottom Left Node Zone Meta */}
                    <div className="absolute bottom-2 left-2 pointer-events-none z-10 font-mono text-[9px] text-outline bg-black/70 px-2 py-0.5 rounded border border-white/5">
                      <span>{node.assignedZone} · {node.fps} FPS · {node.resolution}</span>
                    </div>

                    {/* Center Tactical Crosshair — only when live */}
                    {isLive && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 group-hover:opacity-70 transition-opacity">
                        <div className="w-12 h-12 border border-primary-fixed-dim/40 rounded-full flex items-center justify-center">
                          <div className="w-1 h-1 bg-primary-fixed-dim" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Tile Footer: Active Counts ── */}
              <div className="px-3 py-2 bg-surface-container-high/40 border-t border-white/5 flex items-center justify-between shrink-0 font-mono text-[11px]">
                {/* Active People */}
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-primary-fixed-dim" />
                  <span className="text-outline text-[10px]">People:</span>
                  <span className="font-bold text-primary-fixed-dim">{node.activePeopleCount}</span>
                </div>

                {/* Active Vehicles */}
                <div className="flex items-center gap-1.5">
                  <Car size={12} className="text-alert-amber" />
                  <span className="text-outline text-[10px]">Vehicles:</span>
                  <span className="font-bold text-alert-amber">{node.activeVehiclesCount}</span>
                </div>

                {/* Alerts Count */}
                <div className="flex items-center gap-1.5">
                  <Bell size={12} className={node.alertsCount > 0 ? 'text-error' : 'text-outline'} />
                  <span className="text-outline text-[10px]">Alerts:</span>
                  <span
                    className={cn(
                      'font-bold px-1.5 py-0.2 rounded text-[10px]',
                      node.alertsCount > 0 ? 'bg-error/20 text-error' : 'text-outline'
                    )}
                  >
                    {node.alertsCount}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Fullscreen Focus Modal ── */}
      {focusedNode && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-6xl h-[85vh] tactical-glass border border-primary-fixed-dim/40 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-surface-container-high/60">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-error animate-ping" />
                <span className="font-mono text-primary-fixed-dim font-bold text-[14px]">
                  {focusedNode.name} [{focusedNode.id}]
                </span>
                <span className="font-mono text-outline text-[11px]">
                  {focusedNode.location} · {focusedNode.assignedZone}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFocusNode(focusedNode)}
                  className="btn-primary py-1.5 px-3 text-[11px] font-mono flex items-center gap-1.5"
                >
                  <ArrowUpRight size={12} />
                  <span>Transfer to Main Command Desk</span>
                </button>
                <button
                  onClick={() => setFocusedNode(null)}
                  className="btn-icon-sm h-8 w-8 hover:border-white/40"
                  title="Close Fullscreen"
                >
                  <Minimize2 size={14} />
                </button>
              </div>
            </div>

            {/* Modal Video Area */}
            <div className="flex-1 bg-black relative scan-lines">
              {focusedNode.streamUrl ? (
                <img
                  src={focusedNode.streamUrl}
                  alt={focusedNode.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04080a]">
                  <div
                    className="absolute inset-0 opacity-[0.07]"
                    style={{
                      backgroundImage: `repeating-linear-gradient(45deg, rgba(0,218,243,0.5) 0px, rgba(0,218,243,0.5) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, rgba(0,218,243,0.5) 0px, rgba(0,218,243,0.5) 1px, transparent 1px, transparent 12px)`,
                    }}
                  />
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <WifiOff size={32} className="text-outline/40" />
                    <span className="font-mono text-[13px] text-outline tracking-widest">NO SIGNAL</span>
                    <span className="font-mono text-[10px] text-outline/50 tracking-wider">{focusedNode.id} — CAMERA OFFLINE</span>
                    <span className="font-mono text-[9px] text-outline/30 mt-1">SOURCE NOT CONFIGURED</span>
                  </div>
                </div>
              )}

              {/* OSD Metrics Banner */}
              <div className="absolute bottom-4 left-4 right-4 tactical-glass p-3 rounded-lg border border-white/10 flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center gap-6">
                  <span>RES: {focusedNode.resolution}</span>
                  <span>FPS: {focusedNode.fps}</span>
                  <span>PEOPLE: {focusedNode.activePeopleCount}</span>
                  <span>VEHICLES: {focusedNode.activeVehiclesCount}</span>
                </div>
                <div className="text-health-emerald font-bold">
                  OPTICAL SENSING ENGINE ACTIVE
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
