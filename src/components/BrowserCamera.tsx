import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Sliders,
  CheckCircle2,
  Maximize2,
  Volume2,
  VolumeX,
  Layers,
  Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiUrl } from '@/lib/apiConfig';
import type { VirtualFenceZone } from '@/types';

export interface DetectionBox {
  box: [number, number, number, number]; // [x, y, w, h]
  normalized_box: [number, number, number, number]; // [norm_x, norm_y, norm_w, norm_h]
  type: string;
  classification: 'authorized' | 'watchlist' | 'unknown' | string;
  is_target: boolean;
  id?: string | null;
  name: string;
  rank?: string;
  threat?: string;
  confidence: number;
  badge: string;
  color: string;
  fence_breaches?: string[];
}

export interface FrameStats {
  total_faces: number;
  watchlist_matches: number;
  authorized_matches: number;
  unknown_faces: number;
}

export interface FenceBreachItem {
  zoneId: string;
  zoneName: string;
  entity: string;
  classification: string;
  timestamp: string;
}

export interface AnalyzeFrameResponse {
  success: boolean;
  timestamp: string;
  frame_size: { width: number; height: number };
  detections: DetectionBox[];
  alerts: Array<{
    type: string;
    entityId?: string;
    name: string;
    threat: string;
    confidence: number;
  }>;
  fence_breaches: FenceBreachItem[];
  stats: FrameStats;
}

export interface BrowserCameraProps {
  className?: string;
  intervalMs?: number;
  showVirtualFence?: boolean;
  thermalActive?: boolean;
  nightVisionMode?: boolean;
  zoomLevel?: number;
  zones?: VirtualFenceZone[];
  onDetectionsChange?: (detections: DetectionBox[], stats: FrameStats) => void;
  onTargetMatch?: (det: DetectionBox) => void;
  onFenceBreach?: (breach: FenceBreachItem) => void;
  onCanvasClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  isDrawingMode?: boolean;
  tempPoints?: Array<{ x: number; y: number }>;
}

export function BrowserCamera({
  className,
  intervalMs = 350,
  showVirtualFence = true,
  thermalActive = false,
  nightVisionMode = false,
  zoomLevel = 1,
  zones = [],
  onDetectionsChange,
  onTargetMatch,
  onFenceBreach,
  onCanvasClick,
  isDrawingMode = false,
  tempPoints = [],
}: BrowserCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inFlightRef = useRef(false);

  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'active' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [frameStats, setFrameStats] = useState<FrameStats>({
    total_faces: 0,
    watchlist_matches: 0,
    authorized_matches: 0,
    unknown_faces: 0,
  });
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [activeBreaches, setActiveBreaches] = useState<FenceBreachItem[]>([]);
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState(true);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [showHudOverlays, setShowHudOverlays] = useState(true);

  // Play tactical alert sound synthesizer via Web Audio API
  const playAlertSound = useCallback((frequency = 880, duration = 0.15) => {
    if (!audioAlertsEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  }, [audioAlertsEnabled]);

  // Enumerate connected cameras
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (e) {
      console.warn('Failed to enumerate media devices:', e);
    }
  }, [selectedDeviceId]);

  // Start browser camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setErrorMessage('Browser does not support camera capture (getUserMedia API unavailable).');
      return;
    }

    setCameraState('requesting');
    setErrorMessage(null);

    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraState('active');
      await refreshDevices();
    } catch (err: unknown) {
      const domErr = err as DOMException;
      if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
        setCameraState('denied');
        setErrorMessage('Camera access was blocked. Please click the camera icon in your browser address bar and select Allow.');
      } else {
        setCameraState('error');
        setErrorMessage(`Camera error: ${domErr.message || 'Unknown device error'}`);
      }
    }
  }, [refreshDevices]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState('idle');
    setDetections([]);
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startCamera(selectedDeviceId || undefined);
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera, selectedDeviceId]);

  // Continuous frame capture & AI inference loop (every 250-500ms)
  useEffect(() => {
    if (cameraState !== 'active' || isAiPaused) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = 640;
    offscreen.height = 360;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: false });

    const interval = setInterval(async () => {
      if (inFlightRef.current || !videoRef.current || videoRef.current.readyState < 2 || !offCtx) {
        return;
      }

      inFlightRef.current = true;
      const startTime = performance.now();

      try {
        offCtx.drawImage(videoRef.current, 0, 0, 640, 360);

        offscreen.toBlob(
          async (blob) => {
            if (!blob) {
              inFlightRef.current = false;
              return;
            }

            try {
              const formData = new FormData();
              formData.append('file', blob, 'frame.jpg');
              if (zones && zones.length > 0) {
                formData.append('zones', JSON.stringify(zones));
              }

              const res = await fetch(apiUrl('/api/analyze-frame'), {
                method: 'POST',
                body: formData,
              });

              if (!res.ok) {
                inFlightRef.current = false;
                return;
              }

              const data: AnalyzeFrameResponse = await res.json();
              const elapsed = Math.round(performance.now() - startTime);
              setLatencyMs(elapsed);

              if (data.success) {
                setDetections(data.detections || []);
                setFrameStats(data.stats);
                setActiveBreaches(data.fence_breaches || []);

                if (onDetectionsChange) {
                  onDetectionsChange(data.detections, data.stats);
                }

                // Check for watchlist target matches
                const watchlistHit = data.detections.find((d) => d.classification === 'watchlist');
                if (watchlistHit) {
                  playAlertSound(740, 0.25);
                  if (onTargetMatch) onTargetMatch(watchlistHit);
                }

                // Check for fence breaches
                if (data.fence_breaches && data.fence_breaches.length > 0) {
                  playAlertSound(1100, 0.3);
                  if (onFenceBreach) onFenceBreach(data.fence_breaches[0]);
                }
              }
            } catch (err) {
              console.debug('Frame analysis network glitch:', err);
            } finally {
              inFlightRef.current = false;
            }
          },
          'image/jpeg',
          0.75
        );
      } catch {
        inFlightRef.current = false;
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [cameraState, isAiPaused, intervalMs, zones, onDetectionsChange, onTargetMatch, onFenceBreach, playAlertSound]);

  return (
    <div
      ref={containerRef}
      onClick={onCanvasClick}
      className={cn(
        'relative w-full h-full bg-[#050809] overflow-hidden select-none flex items-center justify-center',
        thermalActive && 'hue-rotate-180 contrast-200 saturate-150',
        nightVisionMode && 'brightness-125 contrast-150 invert-[0.1] sepia hue-rotate-90',
        className
      )}
    >
      {/* ── Live Video Element ── */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{
          transform: `scale(${zoomLevel})`,
          transition: 'transform 0.2s ease-out',
        }}
        className={cn(
          'w-full h-full object-cover',
          cameraState !== 'active' && 'hidden'
        )}
      />

      {/* ── Scanlines / CRT Overlay ── */}
      <div className="absolute inset-0 pointer-events-none scan-lines opacity-20" />

      {/* ── Permission / Error States ── */}
      {cameraState !== 'active' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070b0c] p-6 text-center z-40">
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-2xl bg-surface-charcoal border border-primary-fixed-dim/40 flex items-center justify-center text-primary-fixed-dim shadow-ambient-cyan">
              {cameraState === 'requesting' ? (
                <Radio size={28} className="animate-spin text-primary-fixed-dim" />
              ) : cameraState === 'denied' ? (
                <ShieldAlert size={28} className="text-alert-rose" />
              ) : (
                <Camera size={28} className="text-primary-fixed-dim" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-container border border-primary-fixed-dim flex items-center justify-center">
              <Crosshair size={10} className="text-primary-fixed-dim animate-pulse" />
            </div>
          </div>

          <h3 className="font-mono text-sm font-bold tracking-widest text-primary-fixed-dim uppercase mb-2">
            {cameraState === 'requesting'
              ? 'INITIALIZING OPTICAL SENSOR...'
              : cameraState === 'denied'
              ? 'SENSOR PERMISSION DENIED'
              : 'BROWSER CAMERA READY'}
          </h3>

          <p className="font-mono text-xs text-outline max-w-md mb-6 leading-relaxed">
            {errorMessage ||
              'A.E.G.I.S. neural facial recognition and virtual perimeter surveillance require client camera input. Click below to grant sensor access.'}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => startCamera(selectedDeviceId || undefined)}
              className="px-5 py-2.5 rounded-lg bg-primary-fixed-dim text-black font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-primary-fixed hover:shadow-ambient-cyan transition-all"
            >
              <Camera size={14} />
              <span>Allow Camera Sensor</span>
            </button>
            {cameraState !== 'idle' && (
              <button
                onClick={() => startCamera(selectedDeviceId || undefined)}
                className="px-4 py-2.5 rounded-lg tactical-glass border border-outline-variant/40 text-on-surface font-mono text-xs hover:text-primary-fixed-dim transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Virtual Fence SVG Overlay ── */}
      {showVirtualFence && zones.length > 0 && cameraState === 'active' && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          {zones.map((zone) => {
            const hasBreach = activeBreaches.some((b) => b.zoneId === zone.id);
            const pts = zone.points.map((p) => `${p.x}%,${p.y}%`).join(' ');
            return (
              <g key={zone.id}>
                {zone.type === 'line' ? (
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={hasBreach ? '#ff2a5f' : zone.color}
                    strokeWidth={hasBreach ? '3.5' : '2'}
                    strokeDasharray="6,4"
                    className={cn(hasBreach && 'animate-pulse')}
                  />
                ) : (
                  <polygon
                    points={pts}
                    fill={hasBreach ? '#ff2a5f33' : `${zone.color}22`}
                    stroke={hasBreach ? '#ff2a5f' : zone.color}
                    strokeWidth={hasBreach ? '3' : '1.8'}
                    strokeDasharray="4,4"
                    className={cn(hasBreach && 'animate-pulse')}
                  />
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* ── Interactive Fence Drawing Preview ── */}
      {isDrawingMode && tempPoints.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-25">
          <polyline
            points={tempPoints.map((p) => `${p.x}%,${p.y}%`).join(' ')}
            fill="none"
            stroke="#00daf3"
            strokeWidth="2"
            strokeDasharray="3,3"
          />
          {tempPoints.map((p, idx) => (
            <circle
              key={idx}
              cx={`${p.x}%`}
              cy={`${p.y}%`}
              r="4"
              fill="#00daf3"
              stroke="#080d0e"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      )}

      {/* ── Real-Time AI Tactical Bounding Box Overlay ── */}
      {cameraState === 'active' && showHudOverlays && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {detections.map((det, idx) => {
            const [nx, ny, nw, nh] = det.normalized_box;
            const isWatchlist = det.classification === 'watchlist';
            const isAuthorized = det.classification === 'authorized';
            const isUnknown = det.classification === 'unknown';

            const boxBorderColor = isWatchlist
              ? 'border-alert-rose ring-alert-rose/40'
              : isAuthorized
              ? 'border-primary-fixed-dim ring-primary-fixed-dim/40'
              : 'border-alert-amber ring-alert-amber/40';

            const badgeBg = isWatchlist
              ? 'bg-alert-rose text-black'
              : isAuthorized
              ? 'bg-primary-fixed-dim text-black'
              : 'bg-alert-amber text-black';

            return (
              <div
                key={`${det.name}-${idx}`}
                style={{
                  left: `${nx * 100}%`,
                  top: `${ny * 100}%`,
                  width: `${nw * 100}%`,
                  height: `${nh * 100}%`,
                }}
                className={cn(
                  'absolute border-2 transition-all duration-100 ring-2',
                  boxBorderColor,
                  isWatchlist && 'animate-pulse'
                )}
              >
                {/* Tactical Corner Reticles */}
                <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-inherit" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-inherit" />
                <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-inherit" />
                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-inherit" />

                {/* Tactical Floating Banner */}
                <div className="absolute left-0 bottom-full mb-1 flex flex-col items-start gap-0.5 whitespace-nowrap pointer-events-auto">
                  <div className="flex items-center gap-1">
                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase', badgeBg)}>
                      {det.badge}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tactical-glass border border-white/10 text-on-surface">
                      {Math.round(det.confidence * 100)}%
                    </span>
                  </div>

                  <div className="tactical-glass px-2 py-0.5 rounded border border-white/15 text-[10px] font-mono flex items-center gap-1.5 text-on-surface">
                    <span className="font-bold text-white">{det.name}</span>
                    {det.id && <span className="text-outline text-[9px]">[{det.id}]</span>}
                    {det.rank && <span className="text-primary-fixed-dim text-[9px]">({det.rank})</span>}
                    {isWatchlist && (
                      <span className="text-alert-rose font-bold text-[9px]">THREAT: {det.threat}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Top Tactical Status HUD ── */}
      {cameraState === 'active' && (
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-35 pointer-events-none font-mono text-[10px]">
          {/* Left: Sensor Status & Latency */}
          <div className="flex items-center gap-2 tactical-glass rounded-lg px-2.5 py-1.5 border border-outline-variant/30 pointer-events-auto">
            <div className="flex items-center gap-1.5 font-bold text-health-emerald">
              <span className="w-2 h-2 rounded-full bg-health-emerald animate-ping" />
              <span>SENSOR LIVE</span>
            </div>
            <span className="text-outline">|</span>
            <span className="text-primary-fixed-dim font-bold">YuNet + SFace</span>
            <span className="text-outline">|</span>
            <span className="text-on-surface-variant">{latencyMs}ms</span>
          </div>

          {/* Center: Real-Time Detection Counts */}
          <div className="hidden sm:flex items-center gap-2.5 tactical-glass rounded-lg px-3 py-1.5 border border-outline-variant/30">
            <span className="text-outline">FACES: <strong className="text-white">{frameStats.total_faces}</strong></span>
            {frameStats.watchlist_matches > 0 && (
              <span className="text-alert-rose font-bold animate-pulse">
                TARGETS: {frameStats.watchlist_matches}
              </span>
            )}
            {frameStats.authorized_matches > 0 && (
              <span className="text-primary-fixed-dim">
                AUTH: {frameStats.authorized_matches}
              </span>
            )}
          </div>

          {/* Right: Camera Switcher & Controls */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {availableDevices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  startCamera(e.target.value);
                }}
                className="tactical-glass border border-outline-variant/40 rounded px-2 py-1 text-[10px] font-mono text-on-surface bg-surface-charcoal/90 focus:outline-none focus:border-primary-fixed-dim"
              >
                {availableDevices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setAudioAlertsEnabled((v) => !v)}
              title={audioAlertsEnabled ? 'Mute Alerts' : 'Unmute Alerts'}
              className="p-1.5 rounded tactical-glass border border-outline-variant/30 text-outline hover:text-on-surface transition-colors"
            >
              {audioAlertsEnabled ? <Volume2 size={13} className="text-primary-fixed-dim" /> : <VolumeX size={13} />}
            </button>

            <button
              onClick={() => setIsAiPaused((v) => !v)}
              title={isAiPaused ? 'Resume AI Scanner' : 'Pause AI Scanner'}
              className={cn(
                'px-2 py-1 rounded font-mono text-[9px] font-bold border transition-colors',
                isAiPaused
                  ? 'bg-alert-amber text-black border-alert-amber'
                  : 'tactical-glass border-outline-variant/30 text-outline hover:text-on-surface'
              )}
            >
              {isAiPaused ? 'AI PAUSED' : 'AI ACTIVE'}
            </button>

            <button
              onClick={() => setShowHudOverlays((v) => !v)}
              title="Toggle HUD Bounding Boxes"
              className={cn(
                'p-1.5 rounded tactical-glass border border-outline-variant/30 transition-colors',
                showHudOverlays ? 'text-primary-fixed-dim' : 'text-outline hover:text-on-surface'
              )}
            >
              <Crosshair size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
