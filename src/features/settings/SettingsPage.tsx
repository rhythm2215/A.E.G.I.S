import { useState } from 'react';
import {
  Settings, Sliders, Map, Cpu, Bell, Users, Server, Shield, Check, Save, HardDrive, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'dashboard' | 'map' | 'ai' | 'notifications' | 'users' | 'system'>('general');
  const [saved, setSaved] = useState(false);

  // Settings form state
  const [settings, setSettings] = useState({
    systemName: 'A.E.G.I.S. Command Terminal #01',
    timezone: 'Asia/Kolkata (UTC+5:30)',
    units: 'metric',
    autoRefreshInterval: 1000,
    defaultView: 'map',
    showTelemetry: true,
    showTrails: true,
    trailLength: 30,
    aiModel: 'YOLOv10 + InsightFace Buffalo_L',
    minConfidence: 85,
    autoAlertOnWatchlist: true,
    soundAlerts: true,
    criticalSiren: true,
    retentionDays: 90,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const navItems = [
    { id: 'general',       label: 'General & Localization', icon: Settings },
    { id: 'dashboard',     label: 'Dashboard & HUD Panels', icon: Sliders },
    { id: 'map',           label: 'Geospatial & Vector Maps', icon: Map },
    { id: 'ai',            label: 'AI & Biometric Recognition', icon: Cpu },
    { id: 'notifications', label: 'Alerting Rules & Sirens', icon: Bell },
    { id: 'users',         label: 'RBAC & User Credentials', icon: Users },
    { id: 'system',        label: 'Air-Gapped Node Diagnostics', icon: Server },
  ] as const;

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 pb-16 animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 tactical-glass p-5 rounded-xl border border-glass">
        <div>
          <div className="flex items-center gap-2.5">
            <Settings size={22} className="text-primary-fixed-dim" />
            <h1 className="font-grotesk font-bold text-headline-md text-on-surface">
              A.E.G.I.S. Platform Configuration
            </h1>
          </div>
          <p className="text-body-md text-on-surface-variant font-inter mt-0.5">
            Manage global operational parameters, AI neural pipeline thresholds, geospatial overlays, and air-gapped node diagnostics.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary py-2 px-5 flex items-center gap-2 font-mono"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          <span>{saved ? 'Settings Saved!' : 'Apply Configuration'}</span>
        </button>
      </div>

      {/* ── Settings Layout: Vertical Tabs + Panel ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Vertical Tab Navigation (3 cols) */}
        <div className="md:col-span-4 lg:col-span-3 tactical-glass p-2.5 rounded-xl border border-glass space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-mono text-[12px] text-left transition-all',
                activeTab === id
                  ? 'bg-primary-fixed-dim/15 text-primary-fixed-dim font-bold border-l-2 border-primary-fixed-dim'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
              )}
            >
              <Icon size={16} className={cn(activeTab === id ? 'text-primary-fixed-dim' : 'text-outline')} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Right Settings Form Container (9 cols) */}
        <div className="md:col-span-8 lg:col-span-9 tactical-glass p-6 rounded-xl border border-glass shadow-panel space-y-6">
          {/* ── 1. General ── */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                  General System Settings
                </h3>
                <p className="text-body-md text-on-surface-variant font-inter">
                  Core identification and localization parameters for this terminal node.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                    Terminal Identifier
                  </label>
                  <input
                    type="text"
                    value={settings.systemName}
                    onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                    className="input-glass"
                  />
                </div>

                <div>
                  <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                    Timezone Standard
                  </label>
                  <input
                    type="text"
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="input-glass font-mono"
                  />
                </div>

                <div>
                  <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                    Measurement Units
                  </label>
                  <select
                    value={settings.units}
                    onChange={(e) => setSettings({ ...settings, units: e.target.value })}
                    className="input-glass font-mono text-[12px]"
                  >
                    <option value="metric">Metric (km/h, meters, Celsius)</option>
                    <option value="imperial">Imperial (mph, feet, Fahrenheit)</option>
                    <option value="nautical">Nautical (knots, feet, NM)</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                    Telemetry Refresh Frequency
                  </label>
                  <select
                    value={settings.autoRefreshInterval}
                    onChange={(e) => setSettings({ ...settings, autoRefreshInterval: Number(e.target.value) })}
                    className="input-glass font-mono text-[12px]"
                  >
                    <option value={500}>500ms (High Frequency)</option>
                    <option value={1000}>1000ms (Standard 1Hz)</option>
                    <option value={2000}>2000ms (Power Saver)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── 2. Dashboard & HUD ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                  Dashboard & HUD Display Layout
                </h3>
                <p className="text-body-md text-on-surface-variant font-inter">
                  Configure default operational views, glassmorphic overlays, and telemetry readouts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                    Default Primary View
                  </label>
                  <select
                    value={settings.defaultView}
                    onChange={(e) => setSettings({ ...settings, defaultView: e.target.value })}
                    className="input-glass font-mono text-[12px]"
                  >
                    <option value="map">Tactical Map View (Default)</option>
                    <option value="camera">Aerial Camera Live Stream</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer font-mono text-body-md text-on-surface">
                    <input
                      type="checkbox"
                      checked={settings.showTelemetry}
                      onChange={(e) => setSettings({ ...settings, showTelemetry: e.target.checked })}
                      className="rounded bg-surface-container-lowest border-outline/40 text-primary-fixed-dim focus:ring-0"
                    />
                    <span>Show HUD Telemetry Overlays</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── 3. Geospatial ── */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                  Geospatial & Vector Map Settings
                </h3>
                <p className="text-body-md text-on-surface-variant font-inter">
                  Mapbox style endpoints, offline OpenStreetMap fallback tiles, and flight trail buffers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                    Flight Path Vector Length (Points)
                  </label>
                  <input
                    type="number"
                    value={settings.trailLength}
                    onChange={(e) => setSettings({ ...settings, trailLength: Number(e.target.value) })}
                    className="input-glass font-mono"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer font-mono text-body-md text-on-surface">
                    <input
                      type="checkbox"
                      checked={settings.showTrails}
                      onChange={(e) => setSettings({ ...settings, showTrails: e.target.checked })}
                      className="rounded bg-surface-container-lowest border-outline/40 text-primary-fixed-dim focus:ring-0"
                    />
                    <span>Render Historical Drone Trails</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. AI & Biometrics ── */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                  AI Computer Vision & Biometric Pipeline
                </h3>
                <p className="text-body-md text-on-surface-variant font-inter">
                  Facial recognition confidence thresholds, YOLO object tracking, and automatic suspect tagging.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                    Inference Engine Pipeline
                  </label>
                  <input
                    type="text"
                    value={settings.aiModel}
                    onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                    className="input-glass font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                    Min Recognition Confidence ({settings.minConfidence}%)
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={99}
                    value={settings.minConfidence}
                    onChange={(e) => setSettings({ ...settings, minConfidence: Number(e.target.value) })}
                    className="w-full h-2 bg-surface-container-lowest rounded accent-primary-fixed-dim cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <label className="flex items-center gap-2 cursor-pointer font-mono text-body-md text-on-surface">
                  <input
                    type="checkbox"
                    checked={settings.autoAlertOnWatchlist}
                    onChange={(e) => setSettings({ ...settings, autoAlertOnWatchlist: e.target.checked })}
                    className="rounded bg-surface-container-lowest border-outline/40 text-primary-fixed-dim focus:ring-0"
                  />
                  <span>Automatically Trigger High-Priority Alert on Watchlist Face Match</span>
                </label>
              </div>

              {/* ── Future Architecture Extension Placeholders ── */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-grotesk font-bold text-headline-sm text-primary-fixed-dim">
                    Future AI & Video Analytics Architecture (Expansion Modules)
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-surface-container-highest text-outline">
                    Plug-and-Play Architecture
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Module 1: Human Tracking */}
                  <div className="bg-surface-charcoal/50 border border-outline-variant/30 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-on-surface">Human Tracking</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-health-emerald/15 text-health-emerald font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-inter">
                      BoT-SORT / DeepOCSORT multi-target pedestrian tracking across overlapping camera zones.
                    </p>
                  </div>

                  {/* Module 2: Suspicious Activity Detection */}
                  <div className="bg-surface-charcoal/50 border border-outline-variant/30 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-on-surface">Suspicious Activity</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-alert-amber/15 text-alert-amber font-bold">
                        STANDBY
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-inter">
                      Action recognition pipeline: climbing fences, perimeter wire cutting, and anomalous posture detection.
                    </p>
                  </div>

                  {/* Module 3: Loitering Detection */}
                  <div className="bg-surface-charcoal/50 border border-outline-variant/30 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-on-surface">Loitering Detection</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-alert-amber/15 text-alert-amber font-bold">
                        STANDBY
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-inter">
                      Temporal dwell-time thresholding in critical border buffer strips (&gt;45s trigger).
                    </p>
                  </div>

                  {/* Module 4: Thermal Camera Support */}
                  <div className="bg-surface-charcoal/50 border border-outline-variant/30 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-on-surface">Thermal Camera Support</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-primary-container/20 text-primary-fixed-dim font-bold">
                        READY
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-inter">
                      FLIR Boson / Lepton radiometric stream decoding and heat-signature differential tracking.
                    </p>
                  </div>

                  {/* Module 5: Night Vision Analytics */}
                  <div className="bg-surface-charcoal/50 border border-outline-variant/30 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-on-surface">Night Vision Analytics</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-health-emerald/15 text-health-emerald font-bold">
                        ENHANCED
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant font-inter">
                      Zero-DCE deep low-light frame enhancement with IR illuminator backscatter compensation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. Notifications ── */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                  Tactical Alerting & Audio Sirens
                </h3>
                <p className="text-body-md text-on-surface-variant font-inter">
                  Configure auditory alerts for critical airspace and geofence breaches.
                </p>
              </div>

              <div className="space-y-3 font-mono text-body-md">
                <label className="flex items-center gap-2 cursor-pointer text-on-surface">
                  <input
                    type="checkbox"
                    checked={settings.soundAlerts}
                    onChange={(e) => setSettings({ ...settings, soundAlerts: e.target.checked })}
                    className="rounded bg-surface-container-lowest border-outline/40 text-primary-fixed-dim focus:ring-0"
                  />
                  <span>Enable Auditory Event Beeps</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-on-surface">
                  <input
                    type="checkbox"
                    checked={settings.criticalSiren}
                    onChange={(e) => setSettings({ ...settings, criticalSiren: e.target.checked })}
                    className="rounded bg-surface-container-lowest border-outline/40 text-secondary focus:ring-0"
                  />
                  <span className="text-secondary font-bold">Audible Siren on Tier-1 Critical Breach</span>
                </label>
              </div>
            </div>
          )}

          {/* ── 6. Users & RBAC ── */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                  Role-Based Access Control (RBAC)
                </h3>
                <p className="text-body-md text-on-surface-variant font-inter">
                  Active operator privileges and session authentications.
                </p>
              </div>

              <div className="space-y-2">
                <div className="bg-surface-charcoal/50 border border-outline-variant/30 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-container/20 border border-primary-fixed-dim/40 flex items-center justify-center font-mono text-primary-fixed-dim text-[11px] font-bold">
                      OP1
                    </div>
                    <div>
                      <div className="font-mono text-[12px] font-bold text-on-surface">Operator_Alpha</div>
                      <div className="font-mono text-[10px] text-outline">Terminal Session: Active (JWT Authenticated)</div>
                    </div>
                  </div>
                  <span className="bg-primary-container/20 text-primary-fixed-dim font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                    Admin / Pilot-in-Command
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── 7. System Diagnostics ── */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2">
                <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                  Air-Gapped Node Health & Services
                </h3>
                <p className="text-body-md text-on-surface-variant font-inter">
                  Local PostgreSQL, FastAPI gateway, WebSocket telemetry broker, and MinIO storage cluster.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="bg-surface-charcoal/50 p-3 rounded-lg border border-health-emerald/30 space-y-1">
                  <div className="flex items-center justify-between text-health-emerald font-bold">
                    <span>PostgreSQL Database</span>
                    <span>ONLINE (Port 5432)</span>
                  </div>
                  <div className="text-outline">Latency: 1.2ms · 18 Tables Synced</div>
                </div>

                <div className="bg-surface-charcoal/50 p-3 rounded-lg border border-health-emerald/30 space-y-1">
                  <div className="flex items-center justify-between text-health-emerald font-bold">
                    <span>FastAPI WebSocket Layer</span>
                    <span>ACTIVE (ws://localhost:8000/ws)</span>
                  </div>
                  <div className="text-outline">Heartbeat: 1000ms · 0 Dropped Packets</div>
                </div>

                <div className="bg-surface-charcoal/50 p-3 rounded-lg border border-health-emerald/30 space-y-1">
                  <div className="flex items-center justify-between text-health-emerald font-bold">
                    <span>MinIO Storage Bucket</span>
                    <span>HEALTHY (28.4 GB Available)</span>
                  </div>
                  <div className="text-outline">Encryption: AES-256 Enabled</div>
                </div>

                <div className="bg-surface-charcoal/50 p-3 rounded-lg border border-health-emerald/30 space-y-1">
                  <div className="flex items-center justify-between text-health-emerald font-bold">
                    <span>Air-Gapped Network Isolation</span>
                    <span>SECURE (No WAN Leak)</span>
                  </div>
                  <div className="text-outline">Direct LAN Telemetry Broadcast</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
