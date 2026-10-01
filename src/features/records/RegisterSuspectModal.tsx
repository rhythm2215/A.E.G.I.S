import { useState, useRef } from 'react';
import { X, AlertOctagon, AlertTriangle, CheckCircle2, Camera } from 'lucide-react';
import { useSuspectStore } from '@/store/suspectStore';
import { useIdentityStore } from '@/store/identityStore';
import type { ThreatLevel } from '@/types';
import { API_BASE_URL } from '@/lib/apiConfig';

const BACKEND = API_BASE_URL;

interface RegisterSuspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RegisterSuspectModal({ isOpen, onClose, onSuccess }: RegisterSuspectModalProps) {
  const { fetchSuspects } = useSuspectStore();
  const { fetchWatchlist } = useIdentityStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [alias, setAlias] = useState('');
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>('critical');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ id: string; name: string } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select a valid image file (JPEG, PNG).');
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }
    if (!selectedFile) {
      setErrorMsg('A reference face photo is required for facial recognition matching.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append('full_name', fullName.trim());
      fd.append('alias', alias.trim());
      fd.append('threat_level', threatLevel);
      fd.append('image', selectedFile);

      const resp = await fetch(`${BACKEND}/api/suspects`, {
        method: 'POST',
        body: fd,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${resp.status}`);
      }

      const data = await resp.json();
      setSuccessInfo({ id: data.suspectId, name: fullName.trim() });
      await Promise.all([fetchSuspects(), fetchWatchlist()]);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to enroll suspect biometrics.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName('');
    setAlias('');
    setNotes('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setSuccessInfo(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in p-4 overflow-y-auto">
      <div className="tactical-glass border border-red-500/40 rounded-2xl shadow-2xl p-6 w-full max-w-xl mx-auto space-y-5 text-on-surface my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0 text-red-400">
              <AlertOctagon size={20} />
            </div>
            <div>
              <h2 className="font-grotesk font-bold text-headline-sm text-on-surface tracking-wide">
                WATCHLIST SUSPECT REGISTRATION
              </h2>
              <p className="text-body-sm text-red-400 font-mono mt-0.5">
                Target Match Enrollment - RED Bounding Box & Active Alarm
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Banner */}
        {successInfo ? (
          <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-5 space-y-3 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-400/60 mx-auto flex items-center justify-center text-red-400">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-grotesk font-bold text-headline-sm text-red-300">
              Target Enrolled into Watchlist
            </h3>
            <p className="text-body-md text-on-surface-variant font-inter">
              <span className="text-red-400 font-mono font-bold">{successInfo.id}</span> -{' '}
              <span className="text-on-surface font-semibold">{successInfo.name}</span> has been
              added to the high-priority surveillance watchlist.
            </p>
            <div className="text-body-sm font-mono bg-red-900/30 text-red-300 px-3 py-2 rounded-lg border border-red-500/30">
              Live Feed Behavior: Instant <span className="text-red-400 font-bold">RED</span> tactical box with{' '}
              <span className="text-red-400 font-bold">TARGET MATCH</span> badge, acoustic siren, and timeline incident logging.
            </div>
            <button
              onClick={handleReset}
              className="btn-primary w-full py-2.5 font-mono text-body-md mt-2"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 flex items-start gap-2.5 text-red-300 text-body-sm">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Photo Upload Section */}
            <div className="space-y-2">
              <label className="block text-body-sm font-mono text-red-400 uppercase tracking-wider">
                Target Facial Reference Photo *
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-red-500/30 hover:border-red-400/70 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-surface-container-lowest/60 transition-colors group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-20 h-20 rounded-xl object-cover border-2 border-red-400 shadow-md"
                    />
                    <div className="text-left space-y-1">
                      <p className="text-body-md font-mono text-red-300 font-bold">Target Photo Attached</p>
                      <p className="text-body-xs text-on-surface-variant font-inter">
                        Click or tap to replace with another photo
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-1.5">
                    <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-400/30 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform text-red-400">
                      <Camera size={18} />
                    </div>
                    <p className="text-body-sm font-mono text-red-300">Click to upload suspect photo</p>
                    <p className="text-body-xs text-on-surface-variant font-inter">
                      Clear frontal portrait for deep facial vector extraction
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-body-xs font-mono text-on-surface-variant">FULL NAME / SUBJECT IDENTIFIER *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arjun Mehta"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-red-400 focus:outline-none font-inter"
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">ALIAS / CALLSIGN</label>
                <input
                  type="text"
                  placeholder="e.g. The Ghost, K-Rajan"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-red-400 focus:outline-none font-inter"
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">THREAT LEVEL</label>
                <select
                  value={threatLevel}
                  onChange={(e) => setThreatLevel(e.target.value as ThreatLevel)}
                  className="w-full bg-surface-container-lowest border border-red-500/50 rounded-lg px-3 py-2 text-body-md text-red-400 font-mono font-bold focus:border-red-400 focus:outline-none"
                >
                  <option value="critical">CRITICAL (High Threat)</option>
                  <option value="high">HIGH (Armed / Flagged)</option>
                  <option value="medium">MEDIUM (Surveillance)</option>
                  <option value="low">LOW (Person of Interest)</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-body-xs font-mono text-on-surface-variant">REASON / CHARGES / NOTES</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Flagged for illegal perimeter crossing or illicit weapons transit"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-red-400 focus:outline-none font-inter resize-none"
                />
              </div>
            </div>

            {/* Tactical Info Footnote */}
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/20 text-body-xs text-red-300 font-mono">
              Identity will be stored in Watchlist Database. Detection by optical CCTV triggers an immediate RED bounding box, TARGET MATCH alert, and siren.
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleReset}
                className="btn-ghost py-2 px-4 text-body-sm font-mono"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2 px-5 text-body-sm font-mono flex items-center gap-2 rounded-lg font-bold bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                    <span>Enrolling Target...</span>
                  </>
                ) : (
                  <>
                    <AlertOctagon size={16} />
                    <span>Enroll Suspect</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
