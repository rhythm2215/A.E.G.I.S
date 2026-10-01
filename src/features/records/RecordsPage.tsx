import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Eye, Shield, Trash2, AlertTriangle, X, RefreshCw,
  Users, Car, AlertOctagon, ShieldCheck, CheckCircle2, Filter,
  ExternalLink, Calendar, MapPin, Camera
} from 'lucide-react';
import { cn, getThreatColor, formatTimestamp } from '@/lib/utils';
import { useSuspectStore } from '@/store/suspectStore';
import { useIdentityStore } from '@/store/identityStore';
import { useVehicleStore } from '@/store/vehicleStore';
import { mockIncidents } from '@/services/mock/mockData';
import type { Incident, IncidentType, NotificationPriority } from '@/types';
import { RegisterPersonnelModal } from './RegisterPersonnelModal';
import { RegisterSuspectModal } from './RegisterSuspectModal';
import { RegisterVehicleModal } from './RegisterVehicleModal';

type RecordsMainTab = 'people' | 'vehicles' | 'incidents';

// ── Confirm-reset modal ───────────────────────────────────────────
function ResetModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="tactical-glass border border-glass rounded-2xl shadow-panel p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-alert-amber/15 border border-alert-amber/30 flex items-center justify-center shrink-0">
            <RefreshCw size={18} className="text-alert-amber" />
          </div>
          <div>
            <h2 className="font-grotesk font-bold text-headline-sm text-on-surface">
              Reset Suspect Database
            </h2>
            <p className="text-body-md text-on-surface-variant font-inter mt-1">
              This will purge all dynamically uploaded suspects and facial vectors from
              disk storage and memory, resetting the A.E.G.I.S. database back to clean seed data.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button onClick={onCancel} className="btn-ghost flex items-center gap-1.5">
            <X size={14} />
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-alert-amber/15 hover:bg-alert-amber/25 border border-alert-amber/40 text-alert-amber font-mono text-body-md font-bold transition-colors"
          >
            <RefreshCw size={14} />
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm-delete modal ──────────────────────────────────────────
function DeleteModal({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="tactical-glass border border-glass rounded-2xl shadow-panel p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <h2 className="font-grotesk font-bold text-headline-sm text-on-surface">
              {title}
            </h2>
            <p className="text-body-md text-on-surface-variant font-inter mt-1">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button onClick={onCancel} className="btn-ghost flex items-center gap-1.5">
            <X size={14} />
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 font-mono text-body-md font-bold transition-colors"
          >
            <Trash2 size={14} />
            Confirm Purge
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecordsPage() {
  const navigate = useNavigate();

  const { suspects, deleteSuspect, fetchSuspects, resetDatabase } = useSuspectStore();
  const { personnel, fetchPersonnel, deletePersonnel } = useIdentityStore();
  const { vehicles, fetchVehicles, deleteVehicle } = useVehicleStore();

  const [mainTab, setMainTab] = useState<RecordsMainTab>('people');
  const [peopleSubTab, setPeopleSubTab] = useState<'personnel' | 'watchlist'>('personnel');
  const [vehicleSubTab, setVehicleSubTab] = useState<'authorized' | 'watchlist'>('authorized');

  // Modal open states
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [showSuspectModal, setShowSuspectModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [threatFilter, setThreatFilter] = useState('all');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState<string>('all');
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState<string>('all');

  const [pendingDeleteSuspect, setPendingDeleteSuspect] = useState<{ id: string; fullName: string } | null>(null);
  const [pendingDeletePersonnel, setPendingDeletePersonnel] = useState<{ id: string; fullName: string } | null>(null);
  const [pendingDeleteVehicle, setPendingDeleteVehicle] = useState<{ id: string; name: string } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    fetchSuspects();
    fetchPersonnel();
    fetchVehicles();
  }, [fetchSuspects, fetchPersonnel, fetchVehicles]);

  // Filtered Watchlist Suspects
  const filteredSuspects = useMemo(() => {
    const q = search.toLowerCase();
    return suspects.filter((s) => {
      if (threatFilter !== 'all' && s.threatLevel !== threatFilter) return false;
      if (q) {
        const text = `${s.id} ${s.fullName} ${s.alias?.join(' ') || ''} ${s.nationality || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [suspects, threatFilter, search]);

  // Filtered Personnel
  const filteredPersonnel = useMemo(() => {
    const q = search.toLowerCase();
    return personnel.filter((p) => {
      if (q) {
        const text = `${p.id} ${p.fullName} ${p.rank} ${p.unit} ${p.assignedZone}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [personnel, search]);

  // Filtered Vehicles
  const filteredVehicles = useMemo(() => {
    const q = search.toLowerCase();
    return vehicles.filter((v) => {
      if (vehicleSubTab === 'authorized' && v.category !== 'authorized') return false;
      if (vehicleSubTab === 'watchlist' && v.category !== 'watchlist') return false;
      if (q) {
        const text = `${v.id} ${v.vehicleName} ${v.plateNumber} ${v.owner || ''} ${v.notes || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [vehicles, vehicleSubTab, search]);

  // Filtered Incidents
  const filteredIncidents = useMemo(() => {
    const q = search.toLowerCase();
    return mockIncidents.filter((inc) => {
      if (incidentTypeFilter !== 'all' && inc.type !== incidentTypeFilter) return false;
      if (incidentSeverityFilter !== 'all' && inc.severity !== incidentSeverityFilter) return false;
      if (q) {
        const text = `${inc.id} ${inc.title} ${inc.description} ${inc.cameraName} ${inc.zone || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [incidentTypeFilter, incidentSeverityFilter, search]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 pb-12 animate-fade-in select-none">
      {/* ── Top Header Banner ── */}
      <div className="tactical-glass p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Shield size={22} className="text-primary-fixed-dim" />
            <h1 className="font-grotesk font-bold text-headline-md text-on-surface">
              A.E.G.I.S. INTELLIGENCE RECORDS REGISTRY
            </h1>
          </div>
          <p className="text-body-md text-on-surface-variant font-inter mt-1">
            Centrally cataloged biometric identities, authorized fleet records, hotlist vehicles, and perimeter security incident logs.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {mainTab === 'people' && peopleSubTab === 'watchlist' && (
            <button
              onClick={() => setShowResetModal(true)}
              className="btn-ghost py-2 px-3 flex items-center gap-1.5 font-mono text-[11px]"
              title="Reset Suspects to Seed State"
            >
              <RefreshCw size={13} />
              <span>Reset Database</span>
            </button>
          )}

          {mainTab === 'people' && peopleSubTab === 'personnel' && (
            <button
              onClick={() => setShowPersonnelModal(true)}
              className="btn-primary py-2 px-4 flex items-center gap-1.5 font-mono text-[11px]"
            >
              <ShieldCheck size={14} />
              <span>Register Personnel</span>
            </button>
          )}

          {mainTab === 'people' && peopleSubTab === 'watchlist' && (
            <button
              onClick={() => setShowSuspectModal(true)}
              className="py-2 px-4 flex items-center gap-1.5 font-mono text-[11px] rounded-lg font-bold bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 transition-colors"
            >
              <AlertOctagon size={14} />
              <span>Register Suspect</span>
            </button>
          )}

          {mainTab === 'vehicles' && (
            <button
              onClick={() => setShowVehicleModal(true)}
              className="btn-primary py-2 px-4 flex items-center gap-1.5 font-mono text-[11px]"
            >
              <Car size={14} />
              <span>Register Vehicle</span>
            </button>
          )}

          {mainTab === 'incidents' && (
            <button
              onClick={() => navigate('/records/new')}
              className="btn-primary py-2 px-4 flex items-center gap-1.5 font-mono text-[11px]"
            >
              <Plus size={14} />
              <span>Log Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Top Tabs Bar: [ PEOPLE ] [ VEHICLES ] [ INCIDENTS ] ── */}
      <div className="tactical-glass p-1.5 rounded-xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Main 3 Tabs */}
        <div className="flex bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-1 w-full sm:w-auto">
          <button
            onClick={() => setMainTab('people')}
            className={cn(
              'px-5 py-2 rounded-md font-mono text-label-caps font-bold uppercase tracking-wider transition-colors flex items-center gap-2',
              mainTab === 'people'
                ? 'bg-primary-container/25 text-primary-fixed-dim shadow-ambient-cyan'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Users size={14} />
            <span>PEOPLE ({personnel.length + suspects.length})</span>
          </button>

          <button
            onClick={() => setMainTab('vehicles')}
            className={cn(
              'px-5 py-2 rounded-md font-mono text-label-caps font-bold uppercase tracking-wider transition-colors flex items-center gap-2',
              mainTab === 'vehicles'
                ? 'bg-primary-container/25 text-primary-fixed-dim shadow-ambient-cyan'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Car size={14} />
            <span>VEHICLES ({vehicles.length})</span>
          </button>

          <button
            onClick={() => setMainTab('incidents')}
            className={cn(
              'px-5 py-2 rounded-md font-mono text-label-caps font-bold uppercase tracking-wider transition-colors flex items-center gap-2',
              mainTab === 'incidents'
                ? 'bg-secondary-container/25 text-secondary shadow-ambient-red'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <AlertOctagon size={14} />
            <span>INCIDENTS ({mockIncidents.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            placeholder={`Search ${mainTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg pl-8 pr-3 py-1.5 text-body-md font-mono text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-fixed-dim/60"
          />
        </div>
      </div>

      {/* ==========================================================
          SECTION 1: PEOPLE (Personnel DB & Watchlist DB)
          ========================================================== */}
      {mainTab === 'people' && (
        <div className="space-y-4 animate-fade-in">
          {/* People Sub-Tabs Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-1 font-mono text-label-caps font-bold">
              <button
                onClick={() => setPeopleSubTab('personnel')}
                className={cn(
                  'px-4 py-1.5 rounded transition-colors flex items-center gap-2',
                  peopleSubTab === 'personnel'
                    ? 'bg-primary-container/20 text-primary-fixed-dim shadow-ambient-cyan'
                    : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                <ShieldCheck size={13} />
                <span>Personnel Database ({personnel.length})</span>
              </button>

              <button
                onClick={() => setPeopleSubTab('watchlist')}
                className={cn(
                  'px-4 py-1.5 rounded transition-colors flex items-center gap-2',
                  peopleSubTab === 'watchlist'
                    ? 'bg-secondary-container/20 text-secondary shadow-ambient-red'
                    : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                <AlertOctagon size={13} />
                <span>Watchlist Database ({suspects.length})</span>
              </button>
            </div>

            {/* Threat filter for watchlist */}
            {peopleSubTab === 'watchlist' && (
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-outline">Threat:</span>
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setThreatFilter(t)}
                    className={cn(
                      'px-2 py-0.5 rounded uppercase font-bold transition-colors',
                      threatFilter === t
                        ? 'bg-secondary-container/20 text-secondary border border-secondary/40'
                        : 'text-outline hover:text-on-surface'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sub-view: Personnel Database Table */}
          {peopleSubTab === 'personnel' && (
            <div className="tactical-glass rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-left font-mono text-body-md border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-surface-container-high/40 text-[11px] text-outline uppercase tracking-wider">
                    <th className="px-4 py-3">Photo</th>
                    <th className="px-4 py-3">Name & ID</th>
                    <th className="px-4 py-3">Rank & Role</th>
                    <th className="px-4 py-3">Assigned Unit</th>
                    <th className="px-4 py-3">Clearance</th>
                    <th className="px-4 py-3">Biometrics</th>
                    <th className="px-4 py-3">Last Seen</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredPersonnel.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <img
                          src={p.faceImage || p.photoUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'}
                          alt={p.fullName}
                          className="w-10 h-10 rounded-lg object-cover border border-primary-fixed-dim/40 shadow-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-on-surface">{p.fullName}</div>
                        <div className="text-[10px] text-primary-fixed-dim font-bold">{p.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-on-surface">{p.rank}</div>
                        <div className="text-[10px] text-outline uppercase">{p.role}</div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-[12px]">
                        {p.unit}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-container/20 text-primary-fixed-dim border border-primary-fixed-dim/40">
                          {p.clearanceLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-health-emerald font-bold">
                          <CheckCircle2 size={13} />
                          <span>128-D SFace Enrolled ({p.recognitionConfidence}%)</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-outline">
                        {p.lastSeen} · {p.cameraSource}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate('/')}
                            className="btn-ghost py-1 px-2.5 text-[10px] font-bold hover:border-primary-fixed-dim/50"
                          >
                            Locate
                          </button>
                          <button
                            onClick={() => setPendingDeletePersonnel({ id: p.id, fullName: p.fullName })}
                            className="btn-icon-sm h-7 w-7 text-outline hover:text-red-400 hover:border-red-400/40"
                            title="Purge personnel record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub-view: Watchlist Database Table */}
          {peopleSubTab === 'watchlist' && (
            <div className="tactical-glass rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-left font-mono text-body-md border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-surface-container-high/40 text-[11px] text-outline uppercase tracking-wider">
                    <th className="px-4 py-3">Photo</th>
                    <th className="px-4 py-3">Suspect Name</th>
                    <th className="px-4 py-3">Threat Level</th>
                    <th className="px-4 py-3">Aliases</th>
                    <th className="px-4 py-3">Criminal Record</th>
                    <th className="px-4 py-3">Face Embedding</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSuspects.map((suspect) => (
                    <tr
                      key={suspect.id}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <img
                          src={suspect.facialImages?.[0]?.url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'}
                          alt={suspect.fullName}
                          className="w-10 h-10 rounded-lg object-cover border border-secondary/40 shadow-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-on-surface">{suspect.fullName}</div>
                        <div className="text-[10px] text-secondary font-bold">{suspect.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                            getThreatColor(suspect.threatLevel)
                          )}
                        >
                          {suspect.threatLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-alert-amber">
                        {suspect.alias?.join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-on-surface-variant max-w-[200px] truncate">
                        {suspect.intelligence?.criminalHistory?.join(', ') || 'Warrant active'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-primary-fixed-dim text-[11px] font-bold">
                          ✓ SFace 128-D Ready
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold bg-primary-container/15 text-primary-fixed-dim">
                          {suspect.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/records/${suspect.id}`)}
                            className="btn-icon-sm h-7 w-7 text-outline hover:text-primary-fixed-dim"
                            title="View dossier"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => setPendingDeleteSuspect({ id: suspect.id, fullName: suspect.fullName })}
                            className="btn-icon-sm h-7 w-7 text-outline hover:text-red-400 hover:border-red-400/40"
                            title="Purge record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==========================================================
          SECTION 2: VEHICLES (Authorized & Watchlist)
          ========================================================== */}
      {mainTab === 'vehicles' && (
        <div className="space-y-4 animate-fade-in">
          {/* Vehicles Sub-Tabs Toggle */}
          <div className="flex bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-1 font-mono text-label-caps font-bold w-fit">
            <button
              onClick={() => setVehicleSubTab('authorized')}
              className={cn(
                'px-4 py-1.5 rounded transition-colors flex items-center gap-2',
                vehicleSubTab === 'authorized'
                  ? 'bg-primary-container/20 text-primary-fixed-dim shadow-ambient-cyan'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <ShieldCheck size={13} />
              <span>Authorized Fleet ({vehicles.filter((v) => v.category === 'authorized').length})</span>
            </button>

            <button
              onClick={() => setVehicleSubTab('watchlist')}
              className={cn(
                'px-4 py-1.5 rounded transition-colors flex items-center gap-2',
                vehicleSubTab === 'watchlist'
                  ? 'bg-secondary-container/20 text-secondary shadow-ambient-red'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <AlertTriangle size={13} />
              <span>Watchlist Vehicles ({vehicles.filter((v) => v.category === 'watchlist').length})</span>
            </button>
          </div>

          {/* Vehicles Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map((veh) => (
              <div
                key={veh.id}
                className="tactical-glass rounded-xl border border-white/10 p-4 space-y-3 hover:border-primary-fixed-dim/40 transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
              >
                {/* Image & Plate Tag */}
                <div className="relative rounded-lg overflow-hidden h-36 bg-black">
                  <img
                    src={veh.imageUrl}
                    alt={veh.vehicleName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-surface-charcoal/90 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-primary-fixed-dim border border-white/10">
                    {veh.plateNumber}
                  </div>
                  <div
                    className={cn(
                      'absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase',
                      veh.category === 'authorized'
                        ? 'bg-primary-container/20 text-primary-fixed-dim border border-primary-fixed-dim/40'
                        : 'bg-secondary-container/20 text-secondary border border-secondary/40'
                    )}
                  >
                    {veh.category}
                  </div>
                </div>

                {/* Details */}
                <div>
                  <div className="font-grotesk font-bold text-[14px] text-on-surface">
                    {veh.vehicleName}
                  </div>
                  <div className="font-mono text-[10px] text-outline mt-0.5">
                    Type: <span className="uppercase text-on-surface-variant font-bold">{veh.type}</span> · ID: {veh.id}
                  </div>
                </div>

                {/* Attributes Table */}
                <div className="bg-surface-charcoal/40 border border-outline-variant/20 rounded-lg p-2 font-mono text-[10px] space-y-1">
                  {veh.owner && (
                    <div className="flex justify-between">
                      <span className="text-outline">Owner:</span>
                      <span className="text-on-surface font-medium truncate max-w-[170px]">{veh.owner}</span>
                    </div>
                  )}
                  {veh.threatTag && (
                    <div className="flex justify-between">
                      <span className="text-error font-bold">Threat:</span>
                      <span className="text-error font-bold">{veh.threatTag}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-outline">Last Sighted:</span>
                    <span className="text-on-surface">{veh.lastSeen} · {veh.cameraSource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Tracking ID:</span>
                    <span className="text-primary-fixed-dim font-bold">{veh.trackingId}</span>
                  </div>
                </div>

                {veh.notes && (
                  <p className="font-inter text-[11px] text-on-surface-variant leading-tight">
                    {veh.notes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[10px] font-mono text-outline">Action</span>
                  <button
                    onClick={() => setPendingDeleteVehicle({ id: veh.id, name: veh.plateNumber || veh.vehicleName })}
                    className="btn-icon-sm h-6 w-6 text-outline hover:text-red-400 hover:border-red-400/40"
                    title="Delete vehicle record"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================================
          SECTION 3: INCIDENTS (Face, Vehicle, Intrusion, Fence)
          ========================================================== */}
      {mainTab === 'incidents' && (
        <div className="space-y-4 animate-fade-in">
          {/* Incident Type & Severity Filters */}
          <div className="tactical-glass p-2.5 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
            {/* Type Filters */}
            <div className="flex flex-wrap items-center gap-1 font-mono text-[10px]">
              <span className="text-outline mr-1 uppercase">Category:</span>
              {[
                { label: 'All Incidents', value: 'all' },
                { label: 'Fence Breaches', value: 'fence_breach' },
                { label: 'Vehicle Matches', value: 'vehicle_match' },
                { label: 'Face Matches', value: 'face_match' },
                { label: 'Unknown Persons', value: 'unknown_person' },
                { label: 'Unknown Vehicles', value: 'unknown_vehicle' },
                { label: 'Intrusions', value: 'intrusion' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setIncidentTypeFilter(item.value)}
                  className={cn(
                    'px-2.5 py-1 rounded font-bold uppercase transition-colors',
                    incidentTypeFilter === item.value
                      ? 'bg-primary-container/20 text-primary-fixed-dim border border-primary-fixed-dim/40'
                      : 'text-outline hover:text-on-surface'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Severity Filters */}
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span className="text-outline mr-1 uppercase">Severity:</span>
              {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setIncidentSeverityFilter(sev)}
                  className={cn(
                    'px-2 py-0.5 rounded font-bold uppercase transition-colors',
                    incidentSeverityFilter === sev
                      ? 'bg-secondary-container/20 text-secondary border border-secondary/40'
                      : 'text-outline hover:text-on-surface'
                  )}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Incidents Table / Feed */}
          <div className="tactical-glass rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-left font-mono text-body-md border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-surface-container-high/40 text-[11px] text-outline uppercase tracking-wider">
                  <th className="px-4 py-3">Incident ID</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Camera Node</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => navigate('/')}
                  >
                    <td className="px-4 py-3 font-bold text-primary-fixed-dim text-[11px]">
                      {inc.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-container-high text-on-surface border border-outline-variant/30">
                        {inc.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                          inc.severity === 'critical'
                            ? 'bg-error/20 text-error border border-error/40'
                            : inc.severity === 'high'
                            ? 'bg-secondary-container/20 text-secondary border border-secondary/40'
                            : 'bg-alert-amber/20 text-alert-amber border border-alert-amber/40'
                        )}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-inter text-[12px] text-on-surface max-w-[320px]">
                      <div className="font-bold text-on-surface">{inc.title}</div>
                      <div className="text-[11px] text-on-surface-variant truncate mt-0.5">
                        {inc.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-primary-fixed-dim">
                      {inc.cameraName}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-outline">
                      {formatTimestamp(inc.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                          inc.status === 'active'
                            ? 'bg-error/15 text-error animate-pulse'
                            : inc.status === 'investigating'
                            ? 'bg-alert-amber/15 text-alert-amber'
                            : 'bg-health-emerald/15 text-health-emerald'
                        )}
                      >
                        {inc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      {showResetModal && (
        <ResetModal
          onConfirm={async () => {
            await resetDatabase();
            setShowResetModal(false);
          }}
          onCancel={() => setShowResetModal(false)}
        />
      )}

      {pendingDeleteSuspect && (
        <DeleteModal
          title="Purge Watchlist Suspect"
          message={`This will permanently remove ${pendingDeleteSuspect.fullName} (${pendingDeleteSuspect.id}) from the A.E.G.I.S. watchlist, dashboard panels, and face vector database. This action cannot be undone.`}
          onConfirm={async () => {
            await deleteSuspect(pendingDeleteSuspect.id);
            setPendingDeleteSuspect(null);
          }}
          onCancel={() => setPendingDeleteSuspect(null)}
        />
      )}

      {pendingDeletePersonnel && (
        <DeleteModal
          title="Purge Authorized Personnel"
          message={`This will permanently remove ${pendingDeletePersonnel.fullName} (${pendingDeletePersonnel.id}) from the Authorized Personnel registry and clear their facial clearance embeddings.`}
          onConfirm={async () => {
            await deletePersonnel(pendingDeletePersonnel.id);
            setPendingDeletePersonnel(null);
          }}
          onCancel={() => setPendingDeletePersonnel(null)}
        />
      )}

      {pendingDeleteVehicle && (
        <DeleteModal
          title="Delete Vehicle Record"
          message={`This will remove vehicle ${pendingDeleteVehicle.name} (${pendingDeleteVehicle.id}) from the fleet intelligence registry.`}
          onConfirm={async () => {
            await deleteVehicle(pendingDeleteVehicle.id);
            setPendingDeleteVehicle(null);
          }}
          onCancel={() => setPendingDeleteVehicle(null)}
        />
      )}

      {/* Registration Modals */}
      <RegisterPersonnelModal
        isOpen={showPersonnelModal}
        onClose={() => setShowPersonnelModal(false)}
        onSuccess={() => fetchPersonnel()}
      />

      <RegisterSuspectModal
        isOpen={showSuspectModal}
        onClose={() => setShowSuspectModal(false)}
        onSuccess={() => fetchSuspects()}
      />

      <RegisterVehicleModal
        isOpen={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
        onSuccess={() => fetchVehicles()}
      />
    </div>
  );
}
