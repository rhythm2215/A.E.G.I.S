import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Video, Layers, ZoomIn, ZoomOut, AlertTriangle, Car, Thermometer, Moon, PenTool, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { useSurveillanceNodeStore } from '@/store/surveillanceNodeStore';
import { useVirtualFenceStore } from '@/store/virtualFenceStore';
import { useTelemetryWebSocket } from '@/services/websocket/useTelemetryWebSocket';
import { BrowserCamera } from '@/components/BrowserCamera';

export function CentralOperationsView() {
  useTelemetryWebSocket();
  const { activeView, toggleView } = useUIStore();
  const { selectedNode, nodes, selectNode, thermalActive, toggleThermal } = useSurveillanceNodeStore();
  const { zones, isDrawingMode, tempPoints, setIsDrawingMode, addTempPoint, clearTempPoints, saveNewZone } = useVirtualFenceStore();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showVirtualFence, setShowVirtualFence] = useState(true);
  const [showVehicleAnalytics, setShowVehicleAnalytics] = useState(true);
  const [recSeconds, setRecSeconds] = useState(3840);
  const [nightVisionMode, setNightVisionMode] = useState(false);
  const [activeBreachAlert, setActiveBreachAlert] = useState<string | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(() => setRecSeconds((s) => s + 1), 1000); return () => clearInterval(t); }, []);

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingMode || !videoContainerRef.current) return;
    const rect = videoContainerRef.current.getBoundingClientRect();
    addTempPoint({ x: Math.round(((e.clientX - rect.left) / rect.width) * 100), y: Math.round(((e.clientY - rect.top) / rect.height) * 100) });
  };

  const renderMap = (isPip = false) => (
    <div className={cn('relative w-full h-full bg-[#080d0e] overflow-hidden select-none', isPip && 'cursor-pointer')}>
      <div className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: `url("https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1600&auto=format&fit=crop&q=80")`, filter: 'brightness(0.35) contrast(1.4) saturate(0.2) hue-rotate(170deg)' }} />
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, rgba(0,218,243,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,218,243,0.2) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="w-[150%] h-[150%] -left-[25%] -top-[25%] absolute rounded-full border border-primary-fixed-dim/20 animate-spin" style={{ animationDuration: '24s' }}>
          <div className="w-1/2 h-1/2 absolute top-0 left-0 bg-gradient-to-br from-primary-fixed-dim/20 to-transparent origin-bottom-right" />
        </div>
      </div>
      {showVirtualFence && !isPip && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {zones.map((zone) => { const pts = zone.points.map((p) => `${p.x*10},${p.y*7}`).join(' '); return (<g key={zone.id}>{zone.type==='line' ? <polyline points={pts} fill="none" stroke={zone.color} strokeWidth="2.5" strokeDasharray="6,4" /> : <polygon points={pts} fill={`${zone.color}22`} stroke={zone.color} strokeWidth="2" strokeDasharray="4,4" />}</g>); })}
        </svg>
      )}
      <div className="absolute inset-0 pointer-events-auto">
        {nodes.map((node, idx) => {
          const positions = [{ top:'42%',left:'38%' },{ top:'35%',left:'55%' },{ top:'65%',left:'30%' },{ top:'75%',left:'60%' },{ top:'25%',left:'20%' },{ top:'52%',left:'72%' }];
          const pos = positions[idx % positions.length]; const isSelected = selectedNode?.id === node.id;
          return (
            <div key={node.id} onClick={(e) => { e.stopPropagation(); selectNode(node); }} style={{ top: pos.top, left: pos.left }} className={cn('absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform group', isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-20')}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300 relative', isSelected ? 'bg-primary-container/40 border-primary-fixed-dim shadow-ambient-cyan text-primary-fixed-dim ring-2 ring-primary-fixed-dim' : 'bg-surface-charcoal/90 border-primary-fixed-dim/50 text-primary-fixed-dim/90 shadow-lg')}><Video size={14} className={cn(isSelected && 'animate-pulse')} /></div>
              {!isPip && (<div className={cn('absolute left-1/2 -translate-x-1/2 top-full mt-1.5 bg-surface-charcoal/95 border border-primary-fixed-dim/40 rounded px-2 py-1 whitespace-nowrap pointer-events-none transition-opacity font-mono text-[10px]', isSelected ? 'opacity-100 ring-1 ring-primary-fixed-dim/40' : 'opacity-0 group-hover:opacity-100')}><div className="font-bold text-primary-fixed-dim">{node.name}</div><div className="text-outline text-[9px]">{node.assignedZone} · {node.fps} FPS</div></div>)}
            </div>
          );
        })}
      </div>
      {!isPip && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-30 pointer-events-auto">
          <div className="tactical-glass rounded-lg p-1.5 flex flex-col gap-1 border border-outline-variant/30">
            <button onClick={() => setShowVirtualFence((v) => !v)} className={cn('p-1.5 rounded transition-colors flex items-center gap-1.5 text-[10px] font-mono', showVirtualFence ? 'text-primary-fixed-dim bg-primary-fixed-dim/10' : 'text-outline hover:text-on-surface')}><Layers size={13}/><span>Virtual Fence</span></button>
            <button onClick={() => setShowVehicleAnalytics((v) => !v)} className={cn('p-1.5 rounded transition-colors flex items-center gap-1.5 text-[10px] font-mono', showVehicleAnalytics ? 'text-alert-amber bg-alert-amber/10' : 'text-outline hover:text-on-surface')}><Car size={13}/><span>Vehicles</span></button>
          </div>
          <div className="tactical-glass rounded-lg p-1 flex flex-col gap-1 border border-outline-variant/30">
            <button onClick={() => setZoomLevel((z) => Math.min(z+0.2,2))} className="p-1.5 rounded text-outline hover:text-primary-fixed-dim hover:bg-white/5"><ZoomIn size={14}/></button>
            <button onClick={() => setZoomLevel((z) => Math.max(z-0.2,0.6))} className="p-1.5 rounded text-outline hover:text-primary-fixed-dim hover:bg-white/5"><ZoomOut size={14}/></button>
          </div>
        </div>
      )}
      {!isPip && (<div className="absolute bottom-3 left-4 tactical-glass rounded-lg px-3 py-1.5 flex items-center gap-4 text-[10px] font-mono text-outline border border-outline-variant/30 z-30"><span>CENTER: 25.3176° N, 82.9739° E</span><span>ELEV: 120m</span><span>SYSTEM: A.E.G.I.S. CCTV HUB</span></div>)}
    </div>
  );

  const renderCamera = (isPip = false) => (
    <div
      ref={videoContainerRef}
      onClick={handleCanvasClick}
      className={cn('relative w-full h-full bg-black overflow-hidden select-none', isPip && 'cursor-pointer')}
    >
      <BrowserCamera
        intervalMs={350}
        showVirtualFence={showVirtualFence}
        thermalActive={thermalActive}
        nightVisionMode={nightVisionMode}
        zoomLevel={zoomLevel}
        zones={zones}
        isDrawingMode={isDrawingMode}
        tempPoints={tempPoints}
        onFenceBreach={(breach) => {
          setActiveBreachAlert(`BREACH DETECTED: ${breach.zoneName} (${breach.entity})`);
        }}
      />
      {!isPip && (
        <div className="absolute top-14 right-4 tactical-glass rounded-lg p-1.5 border border-outline-variant/30 flex items-center gap-1.5 z-30 font-mono text-[10px]">
          <button onClick={toggleThermal} className={cn('px-2.5 py-1 rounded font-bold uppercase transition-colors flex items-center gap-1', thermalActive ? 'bg-alert-amber text-black' : 'bg-surface-charcoal text-on-surface-variant hover:text-on-surface')}><Thermometer size={12}/><span>{thermalActive ? 'THERMAL ON' : 'OPTICAL'}</span></button>
          <button onClick={() => setNightVisionMode((v) => !v)} className={cn('px-2.5 py-1 rounded font-bold uppercase transition-colors flex items-center gap-1', nightVisionMode ? 'bg-health-emerald text-black' : 'bg-surface-charcoal text-on-surface-variant hover:text-on-surface')}><Moon size={12}/><span>NV</span></button>
          <button onClick={() => { if (isDrawingMode) { if (tempPoints.length>=2) saveNewZone(`Fence Zone ${zones.length+1}`); else { clearTempPoints(); setIsDrawingMode(false); } } else { setIsDrawingMode(true); } }} className={cn('px-2.5 py-1 rounded font-bold uppercase transition-colors flex items-center gap-1', isDrawingMode ? 'bg-primary-fixed-dim text-black' : 'bg-surface-charcoal text-on-surface-variant hover:text-on-surface')}><PenTool size={12}/><span>{isDrawingMode ? 'SAVE FENCE' : 'DRAW FENCE'}</span></button>
          {isDrawingMode && (<button onClick={() => { clearTempPoints(); setIsDrawingMode(false); }} className="p-1 rounded bg-error/20 text-error hover:bg-error/30"><X size={12}/></button>)}
        </div>
      )}
      {!isPip && activeBreachAlert && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <div className="bg-error/90 text-white font-mono text-[11px] font-bold px-4 py-1.5 rounded-full border border-white/30 shadow-ambient-red flex items-center gap-2 animate-bounce">
            <AlertTriangle size={14}/><span>{activeBreachAlert}</span>
            <button onClick={() => setActiveBreachAlert(null)} className="ml-2 text-white/70 hover:text-white"><X size={11}/></button>
          </div>
        </div>
      )}
      {!isPip && (
        <div className="absolute bottom-3 left-4 right-4 tactical-glass rounded-lg px-4 py-2 border border-outline-variant/30 flex items-center justify-between z-30 font-mono text-[11px]">
          <div className="flex items-center gap-6">
            <div><span className="text-outline text-[9px] block">NODE</span><span className="text-primary-fixed-dim font-bold">{selectedNode?.id || 'CAM-01'}</span></div>
            <div><span className="text-outline text-[9px] block">RESOLUTION</span><span className="text-on-surface">{selectedNode?.resolution || '1080p Tactical'}</span></div>
            <div><span className="text-outline text-[9px] block">FRAME RATE</span><span className="text-health-emerald font-bold">30 FPS</span></div>
            <div><span className="text-outline text-[9px] block">EDGE PIPELINE</span><span className="text-on-surface text-[10px]">YuNet + SFace (ONNX)</span></div>
          </div>
          <button onClick={() => setZoomLevel((z) => (z===1 ? 1.5 : 1))} className="px-2 py-1 rounded bg-surface-charcoal text-outline hover:text-on-surface text-[10px]">{zoomLevel}x Zoom</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black">
      <div className="w-full h-full">{activeView === 'camera' ? renderCamera(false) : renderMap(false)}</div>
      <motion.div drag dragConstraints={{ left:0, right:300, top:0, bottom:200 }} onClick={toggleView} className="absolute top-4 right-4 w-48 h-32 rounded-lg overflow-hidden border-2 border-primary-fixed-dim/60 shadow-2xl z-40 tactical-glass cursor-pointer group" title="Click to swap views">
        <div className="w-full h-full pointer-events-none">{activeView === 'camera' ? renderMap(true) : renderCamera(true)}</div>
        <div className="absolute top-1 left-1 bg-surface-charcoal/90 px-1.5 py-0.5 rounded text-[9px] font-mono text-primary-fixed-dim flex items-center gap-1 border border-primary-fixed-dim/30"><Maximize2 size={9}/><span>SWAP VIEW</span></div>
      </motion.div>
    </div>
  );
}
