import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Shield,
  User,
  Camera,
  Plus,
  Check,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useSuspectStore } from '@/store/suspectStore';
import { useDroneStore } from '@/store/droneStore';
import type { Suspect, ThreatLevel, SuspectStatus } from '@/types';
import { API_BASE_URL } from '@/lib/apiConfig';

const BACKEND = API_BASE_URL;

const initialFormState = {
  fullName: '',
  alias: '',
  age: 30,
  gender: 'Male',
  nationality: 'Indian',
  threatLevel: 'medium' as ThreatLevel,
  status: 'active_surveillance' as SuspectStatus,
  watchlisted: true,
  height: '175 cm',
  weight: '70 kg',
  clothing: 'Dark jacket, black jeans',
  distinguishingFeatures: '',
  criminalHistory: '',
  assignedDrone: 'DRN-03',
  notes: '',
};

export function AddSuspectPage() {
  const navigate = useNavigate();
  const { addSuspect } = useSuspectStore();
  const { drones } = useDroneStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(initialFormState);

  // ── Image upload state ──────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── Submission & Flash alert state ──────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flashAlert, setFlashAlert] = useState<{
    type: 'success' | 'warning';
    title: string;
    message: string;
    suspectId: string;
  } | null>(null);

  // ── File selection handlers ─────────────────────────────────

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      setSubmitError('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    setSelectedFile(file);
    setSubmitError(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  // ── Form submit ─────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.fullName.trim()) {
      setSubmitError('Full name is required.');
      return;
    }
    if (!selectedFile) {
      setSubmitError('A facial reference photo is required for biometric enrollment.');
      return;
    }

    setIsSubmitting(true);

    try {
      // ── 1. Upload to backend — POST /api/suspects ─────────
      const fd = new FormData();
      fd.append('full_name', formData.fullName.trim());
      fd.append('alias', formData.alias.trim());
      fd.append('threat_level', formData.threatLevel);
      fd.append('image', selectedFile);

      let backendId = `SUS-${Math.floor(100 + Math.random() * 900)}`;
      let faceEnrolled = false;
      let statusMsg = 'Biometrics enrolled into AEGIS vision memory.';

      try {
        const resp = await fetch(`${BACKEND}/api/suspects`, {
          method: 'POST',
          body: fd,
        });

        if (resp.ok) {
          const data = await resp.json();
          backendId = data.suspectId ?? backendId;
          faceEnrolled = data.faceEnrolled ?? false;
          statusMsg = data.message ?? statusMsg;
        } else {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.detail ?? `Server error ${resp.status}`);
        }
      } catch (netErr: any) {
        console.warn('[AEGIS] Backend offline or errored, proceeding in local session:', netErr.message);
        statusMsg = 'Registered in active session (backend offline).';
      }

      // ── 2. Add to Zustand store ──────────────────────────
      const photoUrl = previewUrl ?? '';
      const newSuspect: Suspect = {
        id: backendId,
        fullName: formData.fullName.trim() || 'Unknown Subject',
        alias: formData.alias ? formData.alias.split(',').map((s) => s.trim()) : [],
        age: Number(formData.age) || 28,
        gender: formData.gender,
        nationality: formData.nationality,
        status: formData.status,
        threatLevel: formData.threatLevel,
        watchlisted: formData.watchlisted,
        facialImages: [
          {
            id: `fi-${Date.now()}`,
            url: photoUrl,
            capturedAt: new Date().toISOString(),
            droneId: formData.assignedDrone || null,
            confidence: faceEnrolled ? 95 : 0,
            verified: faceEnrolled,
          },
        ],
        recognitionConfidence: faceEnrolled ? 95 : 0,
        physicalDescription: {
          height: formData.height,
          weight: formData.weight,
          clothing: formData.clothing,
          distinguishingFeatures: formData.distinguishingFeatures,
        },
        tracking: {
          assignedDrones: formData.assignedDrone ? [formData.assignedDrone] : [],
          firstDetection: new Date().toISOString(),
          lastDetection: new Date().toISOString(),
          currentCoordinates: { lat: 25.3176, lng: 82.9739 },
          currentSector: 'Sector B7',
        },
        intelligence: {
          criminalHistory: formData.criminalHistory
            ? formData.criminalHistory.split(',').map((s) => s.trim())
            : ['Under active surveillance'],
          openInvestigations: [`INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`],
          associatedIndividuals: [],
          notes: formData.notes || 'Registered through operator console.',
        },
        lastUpdated: new Date().toISOString(),
      };

      addSuspect(newSuspect);

      // ── 3. Clean up form inputs & set Flash Alert ────────
      setFormData(initialFormState);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSubmitted(true);

      setFlashAlert({
        type: faceEnrolled ? 'success' : 'warning',
        title: faceEnrolled ? 'SUSPECT ENROLLED SUCCESSFULLY' : 'REGISTERED (NO FACE DETECTED)',
        message: `${newSuspect.fullName} (${backendId}) is now active in surveillance database. Redirecting to records...`,
        suspectId: backendId,
      });

      // ── 4. Automatic redirect to Records page ────────────
      setTimeout(() => {
        navigate('/records');
      }, 1400);
    } catch (err: any) {
      setSubmitError(err.message ?? 'Registration failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-5 pb-12 animate-fade-in">
      {/* ── High Visibility Flash Alert ── */}
      {flashAlert && (
        <div
          className={`p-4 rounded-xl border font-mono text-[13px] flex items-center gap-3 animate-fade-in shadow-panel ${
            flashAlert.type === 'success'
              ? 'bg-health-emerald/15 border-health-emerald/40 text-health-emerald'
              : 'bg-alert-amber/15 border-alert-amber/40 text-alert-amber'
          }`}
        >
          {flashAlert.type === 'success' ? (
            <Check size={20} className="shrink-0" />
          ) : (
            <AlertTriangle size={20} className="shrink-0" />
          )}
          <div className="flex-1">
            <span className="font-bold uppercase">{flashAlert.title}</span>
            <p className="text-[12px] opacity-90 mt-0.5">{flashAlert.message}</p>
          </div>
          <Sparkles size={18} className="animate-pulse opacity-70" />
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between tactical-glass px-4 py-3 rounded-xl border border-glass">
        <button
          onClick={() => navigate('/records')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary-fixed-dim font-mono text-body-md transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Records</span>
        </button>

        <span className="font-mono text-[11px] text-outline uppercase tracking-wider">
          CLASSIFIED DATA INGESTION
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="tactical-glass p-6 rounded-xl border border-glass shadow-panel space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h1 className="font-grotesk font-bold text-headline-md text-on-surface flex items-center gap-2.5">
              <User size={22} className="text-secondary" />
              <span>Suspect Intelligence Registration</span>
            </h1>
            <p className="text-body-md text-on-surface-variant font-inter mt-1">
              Upload a facial reference photo to enroll biometrics into the live A.E.G.I.S. recognition engine.
              The 128-d face encoding is computed server-side and injected into the active watchlist immediately.
            </p>
          </div>

          {/* Section 1: Biometrics & Identity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Mugshot Upload */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={[
                  'w-48 h-48 rounded-xl overflow-hidden flex flex-col items-center justify-center relative',
                  'border-2 border-dashed transition-colors cursor-pointer select-none',
                  isDragging
                    ? 'border-primary-fixed-dim bg-primary-fixed-dim/10'
                    : previewUrl
                    ? 'border-outline-variant/30'
                    : 'border-outline-variant/50 bg-surface-container-low hover:border-primary-fixed-dim/60',
                ].join(' ')}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                role="button"
                aria-label="Upload suspect photo"
              >
                {previewUrl ? (
                  <>
                    <img
                      src={previewUrl}
                      alt="Biometric Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-surface-charcoal/80 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <Camera size={22} className="text-primary-fixed-dim" />
                      <span className="text-[11px] font-mono text-on-surface text-center px-3">
                        Click or drop to replace
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 px-4 text-center pointer-events-none">
                    <Upload
                      size={28}
                      className={isDragging ? 'text-primary-fixed-dim' : 'text-outline'}
                    />
                    <span className="font-mono text-[10px] text-outline uppercase leading-relaxed">
                      {isDragging ? 'Drop to enroll' : 'Click or drag\nface photo here'}
                    </span>
                    <span className="font-mono text-[9px] text-outline/60">
                      JPEG · PNG · WEBP
                    </span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileInputChange}
                id="suspect-photo-input"
              />

              {selectedFile && (
                <div className="text-center">
                  <p className="font-mono text-[10px] text-primary-fixed-dim truncate max-w-[192px]">
                    ✓ {selectedFile.name}
                  </p>
                  <p className="font-mono text-[9px] text-outline">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              )}

              {!selectedFile && (
                <p className="font-mono text-[10px] text-secondary text-center max-w-[192px]">
                  ⚠ Photo required for biometric enrollment
                </p>
              )}
            </div>

            {/* Core Info Fields */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="input-glass"
                  placeholder="e.g. Vikramaditya Rathore"
                />
              </div>

              <div>
                <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                  Known Aliases (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  className="input-glass"
                  placeholder="e.g. Viper, Shadow-9"
                />
              </div>

              <div>
                <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                  Age & Gender
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                    className="input-glass font-mono"
                    min={15}
                    max={99}
                  />
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="input-glass font-mono text-[12px]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                  Nationality
                </label>
                <input
                  type="text"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  className="input-glass font-mono"
                />
              </div>

              <div>
                <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                  Threat Classification
                </label>
                <select
                  value={formData.threatLevel}
                  onChange={(e) => setFormData({ ...formData, threatLevel: e.target.value as ThreatLevel })}
                  className="input-glass font-mono font-bold text-secondary text-[12px]"
                >
                  <option value="critical">CRITICAL (Tier 1)</option>
                  <option value="high">HIGH (Tier 2)</option>
                  <option value="medium">MEDIUM (Tier 3)</option>
                  <option value="low">LOW (Informational)</option>
                </select>
              </div>

              <div>
                <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                  Initial Surveillance State
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as SuspectStatus })}
                  className="input-glass font-mono text-[12px]"
                >
                  <option value="active_surveillance">Active Aerial Surveillance</option>
                  <option value="at_large">At Large / Wanted</option>
                  <option value="watchlist">Watchlist Monitored</option>
                  <option value="detained">Detained</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Physical Descriptors & Drone Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Height & Build
              </label>
              <input
                type="text"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className="input-glass font-mono"
                placeholder="178 cm"
              />
            </div>

            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Last Known Clothing
              </label>
              <input
                type="text"
                value={formData.clothing}
                onChange={(e) => setFormData({ ...formData, clothing: e.target.value })}
                className="input-glass"
                placeholder="Dark hoodie, cargo pants"
              />
            </div>

            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Assign Surveillance Drone
              </label>
              <select
                value={formData.assignedDrone}
                onChange={(e) => setFormData({ ...formData, assignedDrone: e.target.value })}
                className="input-glass font-mono text-primary-fixed-dim"
              >
                <option value="">-- No Drone Assigned --</option>
                {drones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} - {d.name} ({d.model})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Distinguishing Marks & Criminal Classification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Distinguishing Marks / Scars / Tattoos
              </label>
              <input
                type="text"
                value={formData.distinguishingFeatures}
                onChange={(e) => setFormData({ ...formData, distinguishingFeatures: e.target.value })}
                className="input-glass"
                placeholder="e.g. Eagle tattoo on left forearm, scar near right eye"
              />
            </div>

            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Criminal Offenses / Classifications (comma separated)
              </label>
              <input
                type="text"
                value={formData.criminalHistory}
                onChange={(e) => setFormData({ ...formData, criminalHistory: e.target.value })}
                className="input-glass"
                placeholder="Arms trafficking, Extortion, PMLA violation"
              />
            </div>
          </div>

          {/* Operational Notes */}
          <div>
            <label className="font-mono text-label-caps text-outline uppercase block mb-1">
              Investigator Field Notes
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-glass resize-none"
              placeholder="Enter special handling procedures, armed threat indicators, or contact instructions..."
            />
          </div>

          {/* Error banner */}
          {submitError && (
            <div className="rounded-lg px-4 py-3 border bg-red-500/10 border-red-500/30 text-red-400 font-mono text-[12px] flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              {submitError}
            </div>
          )}

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/records')}
              className="btn-ghost"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || submitted}
              className="btn-primary px-6 py-2.5 flex items-center gap-2"
            >
              {submitted ? (
                <>
                  <Check size={16} />
                  <span>Enrolled — Redirecting…</span>
                </>
              ) : isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enrolling Biometrics…</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Register Suspect into AEGIS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
