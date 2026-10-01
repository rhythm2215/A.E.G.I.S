import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, ArrowLeft, User, Crosshair, MapPin, AlertTriangle, FileText,
  Camera, Radio, Users, CheckCircle, Printer, ExternalLink, Trash2, X,
} from 'lucide-react';
import { cn, getThreatColor, formatTimestamp } from '@/lib/utils';
import { useSuspectStore } from '@/store/suspectStore';
import { useDroneStore } from '@/store/droneStore';
import { mockRecords, mockTimelineEvents } from '@/services/mock/mockData';
import { apiUrl } from '@/lib/apiConfig';

export function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { suspects, deleteSuspect } = useSuspectStore();
  const { setSelectedDrone, drones } = useDroneStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const suspect = suspects.find((s) => s.id === id);

  // Suspect not found (e.g., just deleted)
  if (!suspect) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 animate-fade-in">
        <Shield size={40} className="text-outline opacity-40" />
        <p className="font-mono text-outline text-body-md">Record not found or has been purged.</p>
        <button onClick={() => navigate('/records')} className="btn-ghost flex items-center gap-2">
          <ArrowLeft size={14} />
          Back to Records
        </button>
      </div>
    );
  }

  const record = mockRecords.find((r) => r.suspectId === suspect.id);
  const suspectTimeline = mockTimelineEvents.filter((e) => e.suspectId === suspect.id);

  function confirmDelete() {
    if (!suspect) return;
    deleteSuspect(suspect.id);
    fetch(apiUrl(`/api/suspects/${suspect.id}`), { method: 'DELETE' }).catch(() => {});
    navigate('/records');
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 pb-12 animate-fade-in">
      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="tactical-glass border border-glass rounded-2xl shadow-panel p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h2 className="font-grotesk font-bold text-headline-sm text-on-surface">Purge Suspect Record</h2>
                <p className="text-body-md text-on-surface-variant font-inter mt-1">
                  This will permanently remove{' '}
                  <span className="text-on-surface font-bold">{suspect.fullName}</span>{' '}
                  ({suspect.id}) from all panels, the records table, and the live watchlist.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex items-center gap-1.5">
                <X size={14} />
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 font-mono text-body-md font-bold transition-colors"
              >
                <Trash2 size={14} />
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between tactical-glass px-4 py-3 rounded-xl border border-glass">
        <button
          onClick={() => navigate('/records')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary-fixed-dim font-mono text-body-md transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Records</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="py-1.5 px-3 flex items-center gap-1.5 text-body-md font-mono rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
          >
            <Trash2 size={14} />
            <span>Purge Record</span>
          </button>
          <button
            onClick={() => window.print()}
            className="btn-ghost py-1.5 px-3 flex items-center gap-1.5 text-body-md font-mono"
          >
            <Printer size={14} />
            <span>Export Dossier</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-primary py-1.5 px-3.5 flex items-center gap-1.5 text-body-md font-mono"
          >
            <Crosshair size={14} />
            <span>Track on Live Map</span>
          </button>
        </div>
      </div>

      {/* Hero Dossier Banner */}
      <div className="tactical-glass p-6 rounded-xl border border-glass shadow-panel grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Facial Mugshot & Biometrics */}
        <div className="flex flex-col items-center lg:items-start gap-3">
          <div className="relative">
            {suspect.facialImages[0] ? (
              <img
                src={suspect.facialImages[0].url}
                alt={suspect.fullName}
                className="w-48 h-48 rounded-xl object-cover border-2 border-secondary/50 shadow-ambient-red"
              />
            ) : (
              <div className="w-48 h-48 rounded-xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-center">
                <User size={48} className="text-outline" />
              </div>
            )}
            <span className="absolute bottom-2 right-2 bg-surface-charcoal/90 border border-secondary text-secondary font-mono text-[10px] px-2 py-0.5 rounded font-bold">
              AI MATCH: {suspect.recognitionConfidence}%
            </span>
          </div>

          <div className="w-full text-center lg:text-left">
            <span className={cn('px-2.5 py-1 rounded font-mono text-[11px] font-bold uppercase tracking-wider', getThreatColor(suspect.threatLevel))}>
              THREAT LEVEL: {suspect.threatLevel}
            </span>
          </div>
        </div>

        {/* Identity Overview */}
        <div className="lg:col-span-2 space-y-3">
          <div className="border-b border-white/5 pb-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-headline-sm font-bold text-secondary">
                {suspect.id}
              </span>
              <span className="font-mono text-[11px] bg-surface-container-highest px-2 py-0.5 rounded text-outline uppercase">
                {suspect.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h1 className="font-grotesk font-bold text-headline-lg text-on-surface mt-1">
              {suspect.fullName}
            </h1>
            <p className="font-mono text-body-md text-primary-fixed-dim">
              Aliases: {suspect.alias.join(', ') || 'None on record'}
            </p>
          </div>

          {/* Demographic & Physical Spec */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-[12px]">
            <div className="bg-surface-charcoal/50 p-2.5 rounded-lg border border-outline-variant/20">
              <div className="text-outline text-[10px] uppercase">Age / Gender</div>
              <div className="text-on-surface font-bold mt-0.5">{suspect.age} Yrs · {suspect.gender}</div>
            </div>
            <div className="bg-surface-charcoal/50 p-2.5 rounded-lg border border-outline-variant/20">
              <div className="text-outline text-[10px] uppercase">Nationality</div>
              <div className="text-on-surface font-bold mt-0.5">{suspect.nationality}</div>
            </div>
            <div className="bg-surface-charcoal/50 p-2.5 rounded-lg border border-outline-variant/20">
              <div className="text-outline text-[10px] uppercase">Height / Weight</div>
              <div className="text-on-surface font-bold mt-0.5">{suspect.physicalDescription.height} · {suspect.physicalDescription.weight}</div>
            </div>
          </div>

          {/* Distinguishing Marks */}
          <div className="bg-surface-charcoal/30 p-3 rounded-lg border border-white/5 text-[12px] font-inter">
            <span className="font-mono text-[10px] text-outline uppercase tracking-wider block mb-1">
              Distinguishing Features & Clothing
            </span>
            <p className="text-on-surface">{suspect.physicalDescription.distinguishingFeatures}</p>
            <p className="text-on-surface-variant text-[11px] mt-1">Last seen wearing: {suspect.physicalDescription.clothing}</p>
          </div>
        </div>

        {/* Live Surveillance Status Card */}
        <div className="tactical-glass p-4 rounded-xl border border-outline-variant/40 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-primary-fixed-dim font-mono text-label-caps uppercase tracking-wider mb-2">
              <Radio size={14} className="animate-pulse" />
              <span>Surveillance Status</span>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              <div>
                <span className="text-outline">Assigned Drones: </span>
                <span className="text-primary-fixed-dim font-bold">
                  {suspect.tracking.assignedDrones.join(', ') || 'None assigned'}
                </span>
              </div>

              <div>
                <span className="text-outline">Current Sector: </span>
                <span className="text-on-surface font-bold">{suspect.tracking.currentSector || 'Uncertain'}</span>
              </div>

              <div>
                <span className="text-outline">Last Coordinates: </span>
                <span className="text-on-surface">
                  {suspect.tracking.currentCoordinates
                    ? `${suspect.tracking.currentCoordinates.lat}°N, ${suspect.tracking.currentCoordinates.lng}°E`
                    : 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-outline">Last Confirmed: </span>
                <span className="text-on-surface-variant">
                  {formatTimestamp(suspect.tracking.lastDetection)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <button
              onClick={() => {
                const d = drones.find((dr) => suspect.tracking.assignedDrones.includes(dr.id));
                if (d) setSelectedDrone(d);
                navigate('/');
              }}
              className="w-full btn-ghost py-1.5 text-[11px] font-mono justify-center"
            >
              Switch to Assigned Drone Feed
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Dossier Sections: Intelligence, Records, Timeline, Associates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Criminal Intelligence & Sightings Timeline */}
        <div className="lg:col-span-2 space-y-5">
          {/* Intelligence Case Dossier */}
          {record && (
            <div className="tactical-glass p-5 rounded-xl border border-glass space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-primary-fixed-dim" />
                  <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                    Investigation Dossier: {record.caseNumber}
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-outline">
                  Officer: {record.assignedOfficer}
                </span>
              </div>

              <p className="text-body-md text-on-surface font-inter leading-relaxed">
                {record.description}
              </p>

              <div>
                <h4 className="font-mono text-label-caps text-outline uppercase tracking-wider mb-2">
                  Charges & Criminal Classifications
                </h4>
                <div className="flex flex-wrap gap-2">
                  {record.charges.map((c, i) => (
                    <span key={i} className="bg-secondary-container/20 border border-secondary/30 text-secondary px-2.5 py-1 rounded text-body-md font-mono">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-mono text-label-caps text-outline uppercase tracking-wider mb-2">
                  Evidence Inventory
                </h4>
                <div className="flex flex-wrap gap-2">
                  {record.evidence.map((ev, i) => (
                    <span key={i} className="bg-surface-charcoal border border-outline-variant/30 text-on-surface px-2.5 py-1 rounded text-[12px] font-mono flex items-center gap-1.5">
                      <CheckCircle size={12} className="text-health-emerald" />
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sighting & Detection Timeline */}
          <div className="tactical-glass p-5 rounded-xl border border-glass space-y-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Camera size={16} className="text-primary-fixed-dim" />
              <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                Biometric Sightings & Aerial Tracking History
              </h3>
            </div>

            <div className="space-y-2.5">
              {suspectTimeline.length === 0 ? (
                <p className="font-mono text-body-md text-outline">No recent detection logs recorded.</p>
              ) : (
                suspectTimeline.map((tl) => (
                  <div key={tl.id} className="bg-surface-charcoal/50 border border-outline-variant/20 rounded-lg p-3 flex items-start justify-between">
                    <div>
                      <div className="font-mono text-[12px] font-bold text-primary-fixed-dim">
                        {tl.type}
                      </div>
                      <p className="text-[12px] text-on-surface-variant mt-0.5">{tl.description}</p>
                      {tl.locationName && (
                        <span className="font-mono text-[10px] text-outline flex items-center gap-1 mt-1">
                          <MapPin size={10} /> {tl.locationName} ({tl.coordinates?.lat.toFixed(4)}, {tl.coordinates?.lng.toFixed(4)})
                        </span>
                      )}
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-[11px] text-outline">{formatTimestamp(tl.timestamp)}</span>
                      {tl.confidence && (
                        <div className="text-[11px] text-health-emerald font-bold mt-0.5">
                          {tl.confidence}% Match
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Associated Individuals & Intelligence Notes */}
        <div className="space-y-5">
          {/* Known Associates Network */}
          <div className="tactical-glass p-5 rounded-xl border border-glass space-y-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Users size={16} className="text-primary-fixed-dim" />
              <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                Known Associates
              </h3>
            </div>

            <div className="space-y-2">
              {suspect.intelligence.associatedIndividuals.map((assocId) => {
                const assoc = suspects.find((s) => s.id === assocId);
                return (
                  <div
                    key={assocId}
                    onClick={() => assoc && navigate(`/records/${assoc.id}`)}
                    className="bg-surface-charcoal/50 border border-outline-variant/20 hover:border-outline-variant/50 p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {assoc?.facialImages[0] ? (
                        <img src={assoc.facialImages[0].url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-mono text-[10px]">
                          {assocId}
                        </div>
                      )}
                      <div>
                        <div className="font-mono text-[11px] font-bold text-on-surface">
                          {assoc?.fullName || assocId}
                        </div>
                        <div className="font-mono text-[10px] text-outline">{assocId}</div>
                      </div>
                    </div>

                    <ExternalLink size={12} className="text-outline" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Open Investigations */}
          <div className="tactical-glass p-5 rounded-xl border border-glass space-y-3">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Shield size={16} className="text-primary-fixed-dim" />
              <h3 className="font-grotesk font-bold text-headline-sm text-on-surface">
                Open Inquiries
              </h3>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              {suspect.intelligence.openInvestigations.map((inv, i) => (
                <div key={i} className="bg-surface-charcoal/40 p-2 rounded border border-white/5 flex justify-between">
                  <span className="text-primary-fixed-dim">{inv}</span>
                  <span className="text-outline">Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
