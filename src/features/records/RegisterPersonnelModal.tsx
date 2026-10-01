import { useState, useRef } from 'react';
import { X, Upload, ShieldCheck, CheckCircle2, AlertTriangle, User, Camera } from 'lucide-react';
import { useIdentityStore } from '@/store/identityStore';
import { API_BASE_URL } from '@/lib/apiConfig';

const BACKEND = API_BASE_URL;

interface RegisterPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RegisterPersonnelModal({ isOpen, onClose, onSuccess }: RegisterPersonnelModalProps) {
  const { fetchPersonnel } = useIdentityStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [rank, setRank] = useState('Captain / Tactical Lead');
  const [role, setRole] = useState('officer');
  const [unit, setUnit] = useState('Alpha Garrison');
  const [department, setDepartment] = useState('Border Quick Reaction Team');
  const [clearanceLevel, setClearanceLevel] = useState('LEVEL 3 - OPERATIONAL');
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
      setErrorMsg('A reference photo is required to compute biometric facial vectors.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append('full_name', fullName.trim());
      fd.append('rank', rank.trim());
      fd.append('role', role.trim());
      fd.append('unit', unit.trim());
      fd.append('department', department.trim());
      fd.append('clearance_level', clearanceLevel.trim());
      fd.append('image', selectedFile);

      const resp = await fetch(`${BACKEND}/api/personnel`, {
        method: 'POST',
        body: fd,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${resp.status}`);
      }

      const data = await resp.json();
      setSuccessInfo({ id: data.personnelId, name: fullName.trim() });
      await fetchPersonnel();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to enroll personnel biometrics.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setSuccessInfo(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in p-4 overflow-y-auto">
      <div className="tactical-glass border border-cyan-500/30 rounded-2xl shadow-2xl p-6 w-full max-w-xl mx-auto space-y-5 text-on-surface my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="font-grotesk font-bold text-headline-sm text-on-surface tracking-wide">
                PERSONNEL ENROLLMENT
              </h2>
              <p className="text-body-sm text-cyan-400 font-mono mt-0.5">
                Authorized Identity Registration - BLUE Bounding Box
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
          <div className="bg-cyan-950/40 border border-cyan-500/50 rounded-xl p-5 space-y-3 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400/60 mx-auto flex items-center justify-center text-cyan-400">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-grotesk font-bold text-headline-sm text-cyan-300">
              Authorized Personnel Registered
            </h3>
            <p className="text-body-md text-on-surface-variant font-inter">
              <span className="text-cyan-400 font-mono font-bold">{successInfo.id}</span> -{' '}
              <span className="text-on-surface font-semibold">{successInfo.name}</span> has been
              persisted into the Authorized Personnel database.
            </p>
            <div className="text-body-sm font-mono bg-cyan-900/30 text-cyan-300 px-3 py-2 rounded-lg border border-cyan-500/30">
              Live Feed Behavior: Instant <span className="text-cyan-400 font-bold">BLUE</span> tactical box with{' '}
              <span className="text-cyan-400 font-bold">AUTHORIZED PERSONNEL</span> badge. No alarms triggered.
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
              <label className="block text-body-sm font-mono text-cyan-400 uppercase tracking-wider">
                Biometric Reference Photo *
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/70 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-surface-container-lowest/60 transition-colors group"
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
                      className="w-20 h-20 rounded-xl object-cover border-2 border-cyan-400 shadow-md"
                    />
                    <div className="text-left space-y-1">
                      <p className="text-body-md font-mono text-cyan-300 font-bold">Photo Captured</p>
                      <p className="text-body-xs text-on-surface-variant font-inter">
                        Click or tap to replace with another photo
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-1.5">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/30 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform text-cyan-400">
                      <Camera size={18} />
                    </div>
                    <p className="text-body-sm font-mono text-cyan-300">Click to upload face photo</p>
                    <p className="text-body-xs text-on-surface-variant font-inter">
                      Front-facing portrait for SFace 128-d vector extraction
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-body-xs font-mono text-on-surface-variant">FULL NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Major Arjun Rathore"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">RANK / TITLE</label>
                <input
                  type="text"
                  placeholder="e.g. Captain / Tactical Lead"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">ROLE CLASSIFICATION</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                >
                  <option value="officer">Officer</option>
                  <option value="patrol">Patrol Lead</option>
                  <option value="guard">Security Guard</option>
                  <option value="analyst">Intel Analyst</option>
                  <option value="engineer">Technical Specialist</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">UNIT / GARRISON</label>
                <input
                  type="text"
                  placeholder="e.g. Alpha Garrison"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">CLEARANCE LEVEL</label>
                <select
                  value={clearanceLevel}
                  onChange={(e) => setClearanceLevel(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                >
                  <option value="LEVEL 4 - COMMAND">LEVEL 4 - COMMAND</option>
                  <option value="LEVEL 3 - OPERATIONAL">LEVEL 3 - OPERATIONAL</option>
                  <option value="LEVEL 2 - TACTICAL">LEVEL 2 - TACTICAL</option>
                  <option value="LEVEL 1 - GUARD">LEVEL 1 - GUARD</option>
                </select>
              </div>
            </div>

            {/* Tactical Info Footnote */}
            <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-body-xs text-cyan-300 font-mono">
              Identity will be stored in Personnel DB. When detected by optical CCTV, the live stream will show a BLUE box with "AUTHORIZED PERSONNEL" and grant silent clearance.
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
                className="btn-primary py-2 px-5 text-body-sm font-mono flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                    <span>Enrolling Biometrics...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Enroll Personnel</span>
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
