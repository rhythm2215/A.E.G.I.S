import { useState, useEffect, useRef } from 'react';
import {
  Film, Play, Pause, Square, SkipBack, SkipForward, Volume2, VolumeX,
  Clock, Calendar, Download, Eye, Tag, AlertTriangle, Crosshair, ChevronRight, Check
} from 'lucide-react';
import { cn, formatDuration, formatTimestamp, formatDate } from '@/lib/utils';
import { usePlaybackStore } from '@/store/uiStore';
import { useDroneStore } from '@/store/droneStore';
import { useSuspectStore } from '@/store/suspectStore';
import type { PlaybackSession, PlaybackMarker } from '@/types';

export function PlaybackPage() {
  const {
    sessions,
    selectedSession,
    setSelectedSession,
    playbackState,
    play,
    pause,
    stop,
    currentTime,
    setCurrentTime,
    duration,
    activeMarker,
    setActiveMarker,
  } = usePlaybackStore();

  const { drones } = useDroneStore();
  const { suspects } = useSuspectStore();

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(true);
  const [filterDrone, setFilterDrone] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Playback timer simulation
  useEffect(() => {
    let interval: any;
    if (playbackState === 'playing') {
      interval = setInterval(() => {
        setCurrentTime(Math.min(currentTime + playbackSpeed, duration || 2700));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [playbackState, currentTime, playbackSpeed, duration, setCurrentTime]);

  const activeDrone = drones.find((d) => d.id === selectedSession?.droneId);
  const activeSuspect = suspects.find((s) => selectedSession?.suspects.includes(s.id));

  const filteredSessions = sessions.filter((s) => {
    if (filterDrone !== 'all' && s.droneId !== filterDrone) return false;
    return true;
  });

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
  };

  const handleMarkerClick = (marker: PlaybackMarker) => {
    setCurrentTime(marker.timestamp);
    setActiveMarker(marker);
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-4 pb-10 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 tactical-glass p-5 rounded-xl border border-glass">
        <div>
          <div className="flex items-center gap-2.5">
            <Film size={22} className="text-primary-fixed-dim" />
            <h1 className="font-grotesk font-bold text-headline-md text-on-surface">
              A.E.G.I.S. Playback & Forensic Video Intelligence
            </h1>
          </div>
          <p className="text-body-md text-on-surface-variant font-inter mt-0.5">
            Synchronized drone mission playback, temporal timeline scrubbing, biometric event markers, and frame-by-frame evidence extraction.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsExporting(true);
              setTimeout(() => setIsExporting(false), 1200);
            }}
            disabled={isExporting}
            className="btn-primary py-2 px-4 flex items-center gap-2 font-mono"
          >
            {isExporting ? <Check size={14} /> : <Download size={14} />}
            <span>{isExporting ? 'Clip Exported!' : 'Export Evidence Clip'}</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout: Recording Library | Forensic Player | Evidence Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-230px)] min-h-[640px]">
        {/* ── Left Column: Recordings Library (3 cols) ── */}
        <div className="lg:col-span-3 tactical-glass rounded-xl border border-glass flex flex-col overflow-hidden">
          <header className="panel-header shrink-0">
            <h2 className="panel-title">Mission Archives</h2>
            <select
              value={filterDrone}
              onChange={(e) => setFilterDrone(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded px-2 py-0.5 text-[10px] font-mono text-primary-fixed-dim"
            >
              <option value="all">All Drones</option>
              {drones.map((d) => (
                <option key={d.id} value={d.id}>{d.id}</option>
              ))}
            </select>
          </header>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
            {filteredSessions.map((session) => {
              const isSelected = selectedSession?.id === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all text-left space-y-2',
                    isSelected
                      ? 'bg-primary-fixed-dim/10 border-primary-fixed-dim/60 shadow-ambient-cyan'
                      : 'bg-surface-charcoal/40 border-outline-variant/30 hover:bg-white/5 hover:border-outline-variant/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-data-mono font-bold text-primary-fixed-dim">
                      {session.droneId}
                    </span>
                    <span className="font-mono text-[10px] text-outline">
                      {session.recordingDate}
                    </span>
                  </div>

                  <div className="font-grotesk font-bold text-[13px] text-on-surface">
                    {session.missionName || session.id}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant pt-1 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-outline" />
                      {formatDuration(session.duration)}
                    </span>
                    <span className="text-secondary font-bold">
                      {session.eventMarkers.length} Markers
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Center Column: Forensic Video Player & Timeline Controls (6 cols) ── */}
        <div className="lg:col-span-6 flex flex-col gap-3 min-h-0">
          {/* Video Screen */}
          <div className="flex-1 tactical-glass rounded-xl border border-glass overflow-hidden relative bg-black flex flex-col justify-center items-center scan-lines">
            <img
              src={selectedSession?.thumbnailUrl || 'https://images.unsplash.com/photo-1508614999368-9260051292e5?w=1600'}
              alt="Forensic Frame"
              className="w-full h-full object-cover opacity-90"
            />

            {/* Overlaid Forensic Reticle & Target Box */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Reticle */}
              <div className="w-28 h-28 border border-primary-fixed-dim/30 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim/60" />
              </div>

              {/* Bounding Box on Suspect */}
              {selectedSession?.suspects.length ? (
                <div className="absolute top-[38%] left-[52%] w-28 h-40 border border-secondary shadow-ambient-red rounded flex flex-col justify-between p-1">
                  <span className="bg-secondary-container text-white px-1 py-0.5 rounded text-[8px] font-mono font-bold w-max">
                    {selectedSession.suspects[0]} MATCH (96%)
                  </span>
                  <span className="font-mono text-[8px] text-secondary bg-surface-charcoal/80 px-1 py-0.5 rounded">
                    FRAME #{(currentTime * 30).toLocaleString()}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Top OSD Metadata Bar */}
            <div className="absolute top-3 left-3 right-3 tactical-glass rounded-lg px-3 py-1.5 flex items-center justify-between font-mono text-[11px] border border-outline-variant/30">
              <div className="flex items-center gap-3">
                <span className="text-primary-fixed-dim font-bold">{selectedSession?.droneId}</span>
                <span className="text-outline">·</span>
                <span className="text-on-surface">{selectedSession?.missionName}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-outline">CODEC: H.265 / 4K</span>
                <span className="text-health-emerald font-bold">FORENSIC RTK SYNC</span>
              </div>
            </div>

            {/* Bottom Current Frame Timestamp Overlay */}
            <div className="absolute bottom-3 left-3 font-mono text-[12px] bg-surface-charcoal/90 px-2 py-1 rounded border border-white/10 text-primary-fixed-dim">
              TIME: {formatDuration(currentTime)} / {formatDuration(duration)}
            </div>
          </div>

          {/* Scrubber & Scrubbing Timeline Bar */}
          <div className="tactical-glass p-3.5 rounded-xl border border-glass space-y-2.5">
            {/* Event Markers Strip */}
            <div className="relative h-6 bg-surface-container-lowest rounded px-2 flex items-center">
              <div className="w-full h-1 bg-outline-variant/30 rounded relative">
                {/* Progress Fill */}
                <div
                  className="h-full bg-primary-fixed-dim rounded"
                  style={{ width: `${(currentTime / (duration || 2700)) * 100}%` }}
                />

                {/* Markers Icons */}
                {selectedSession?.eventMarkers.map((marker) => {
                  const pct = (marker.timestamp / (duration || 2700)) * 100;
                  return (
                    <button
                      key={marker.id}
                      onClick={() => handleMarkerClick(marker)}
                      style={{ left: `${pct}%` }}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-secondary border border-white shadow-ambient-red flex items-center justify-center hover:scale-125 transition-transform"
                      title={`${marker.label} (${formatDuration(marker.timestamp)})`}
                    >
                      <span className="w-1 h-1 bg-white rounded-full" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Seek Slider */}
            <input
              type="range"
              min={0}
              max={duration || 2700}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-surface-container-lowest rounded-lg appearance-none cursor-pointer accent-primary-fixed-dim"
            />

            {/* Transport Button Controls */}
            <div className="flex items-center justify-between pt-1 font-mono">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}
                  className="btn-icon-sm"
                  title="Rewind 10s"
                >
                  <SkipBack size={13} />
                </button>

                {playbackState === 'playing' ? (
                  <button onClick={pause} className="btn-primary p-2 w-9 h-9 rounded-lg">
                    <Pause size={15} />
                  </button>
                ) : (
                  <button onClick={play} className="btn-primary p-2 w-9 h-9 rounded-lg">
                    <Play size={15} className="ml-0.5" />
                  </button>
                )}

                <button onClick={stop} className="btn-icon-sm" title="Stop">
                  <Square size={13} />
                </button>

                <button
                  onClick={() => setCurrentTime(Math.min(duration, currentTime + 10))}
                  className="btn-icon-sm"
                  title="Forward 10s"
                >
                  <SkipForward size={13} />
                </button>
              </div>

              {/* Playback Speeds */}
              <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant/30 rounded p-0.5">
                {[0.5, 1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold transition-colors',
                      playbackSpeed === spd
                        ? 'bg-primary-container/20 text-primary-fixed-dim'
                        : 'text-outline hover:text-on-surface'
                    )}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Audio & Time readout */}
              <div className="flex items-center gap-3 text-[12px] text-outline">
                <button onClick={() => setIsMuted((m) => !m)} className="hover:text-on-surface">
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <span className="text-on-surface font-bold">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Forensic Evidence & Detection Markers (3 cols) ── */}
        <div className="lg:col-span-3 tactical-glass rounded-xl border border-glass flex flex-col overflow-hidden">
          <header className="panel-header shrink-0">
            <h2 className="panel-title">Forensic Event Markers</h2>
            <span className="font-mono text-[10px] text-outline">
              {selectedSession?.eventMarkers.length || 0} Events
            </span>
          </header>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {selectedSession?.eventMarkers.map((marker) => {
              const isSelected = activeMarker?.id === marker.id;
              return (
                <div
                  key={marker.id}
                  onClick={() => handleMarkerClick(marker)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all space-y-2',
                    isSelected
                      ? 'bg-secondary-container/15 border-secondary/60 shadow-ambient-red'
                      : 'bg-surface-charcoal/50 border-outline-variant/30 hover:bg-white/5'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-secondary flex items-center gap-1.5">
                      <AlertTriangle size={12} />
                      {marker.label}
                    </span>
                    <span className="font-mono text-[10px] text-outline">
                      {formatDuration(marker.timestamp)}
                    </span>
                  </div>

                  {marker.suspectId && (
                    <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-white/5">
                      <span className="text-on-surface">Target: {marker.suspectId}</span>
                      {marker.confidence && (
                        <span className="text-health-emerald font-bold">
                          Conf: {marker.confidence}%
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkerClick(marker);
                    }}
                    className="w-full btn-ghost py-1 text-[10px] font-mono justify-center"
                  >
                    Jump to Marker
                  </button>
                </div>
              );
            })}

            {/* Target Facial Dossier Preview in Playback */}
            {activeSuspect && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <span className="font-mono text-label-caps text-outline uppercase tracking-wider block">
                  Target Bio Profile
                </span>
                <div className="bg-surface-charcoal/60 border border-outline-variant/30 rounded-lg p-2.5 flex items-center gap-2.5">
                  {activeSuspect.facialImages[0] && (
                    <img
                      src={activeSuspect.facialImages[0].url}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-secondary/40"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] font-bold text-secondary truncate">
                      {activeSuspect.id} · {activeSuspect.fullName}
                    </div>
                    <div className="font-mono text-[10px] text-outline">
                      Threat: {activeSuspect.threatLevel.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
