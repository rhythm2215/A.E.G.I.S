import { useState, useRef } from 'react';
import { X, Car, Shield, AlertTriangle, CheckCircle2, Camera } from 'lucide-react';
import { useVehicleStore } from '@/store/vehicleStore';
import { API_BASE_URL } from '@/lib/apiConfig';

const BACKEND = API_BASE_URL;

interface RegisterVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RegisterVehicleModal({ isOpen, onClose, onSuccess }: RegisterVehicleModalProps) {
  const { fetchVehicles } = useVehicleStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('SUV');
  const [makeModel, setMakeModel] = useState('');
  const [owner, setOwner] = useState('');
  const [unit, setUnit] = useState('Border Patrol Sector 4');
  const [status, setStatus] = useState<'Authorized' | 'Watchlist' | 'Blocked'>('Authorized');
  const [color, setColor] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ id: string; plate: string; status: string } | null>(null);

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
    if (!plate.trim()) {
      setErrorMsg('License plate number is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append('vehicle_type', vehicleType);
      fd.append('plate', plate.trim().toUpperCase());
      fd.append('owner', owner.trim());
      fd.append('unit', unit.trim());
      fd.append('status', status);
      fd.append('make_model', makeModel.trim() || `${vehicleType} (${plate.trim().toUpperCase()})`);
      fd.append('color', color.trim() || 'Standard');
      if (selectedFile) {
        fd.append('image', selectedFile);
      }

      const resp = await fetch(`${BACKEND}/api/vehicles`, {
        method: 'POST',
        body: fd,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${resp.status}`);
      }

      const data = await resp.json();
      setSuccessInfo({ id: data.vehicleId, plate: plate.trim().toUpperCase(), status });
      await fetchVehicles();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register vehicle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setPlate('');
    setMakeModel('');
    setOwner('');
    setColor('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setSuccessInfo(null);
    onClose();
  };

  const isWatchlist = status === 'Watchlist' || status === 'Blocked';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in p-4 overflow-y-auto">
      <div className="tactical-glass border border-white/15 rounded-2xl shadow-2xl p-6 w-full max-w-xl mx-auto space-y-5 text-on-surface my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                isWatchlist
                  ? 'bg-red-500/15 border-red-500/40 text-red-400'
                  : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-400'
              }`}
            >
              <Car size={20} />
            </div>
            <div>
              <h2 className="font-grotesk font-bold text-headline-sm text-on-surface tracking-wide">
                VEHICLE REGISTRATION
              </h2>
              <p
                className={`text-body-sm font-mono mt-0.5 ${
                  isWatchlist ? 'text-red-400' : 'text-cyan-400'
                }`}
              >
                {isWatchlist
                  ? 'Watchlist / Hotlist Vehicle - RED Tactical Box'
                  : 'Authorized Fleet Vehicle - BLUE Tactical Box'}
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
          <div
            className={`rounded-xl p-5 space-y-3 text-center animate-fade-in border ${
              isWatchlist
                ? 'bg-red-950/30 border-red-500/40 text-red-300'
                : 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center border ${
                isWatchlist
                  ? 'bg-red-500/20 border-red-400/60 text-red-400'
                  : 'bg-cyan-500/20 border-cyan-400/60 text-cyan-400'
              }`}
            >
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-grotesk font-bold text-headline-sm">
              Vehicle Registered: {successInfo.plate}
            </h3>
            <p className="text-body-md text-on-surface-variant font-inter">
              Assigned ID <span className="font-mono font-bold">{successInfo.id}</span> registered as{' '}
              <span className="font-bold">{successInfo.status.toUpperCase()}</span> in the vehicle intelligence registry.
            </p>
            <div
              className={`text-body-sm font-mono px-3 py-2 rounded-lg border ${
                isWatchlist
                  ? 'bg-red-900/30 border-red-500/30 text-red-200'
                  : 'bg-cyan-900/30 border-cyan-500/30 text-cyan-200'
              }`}
            >
              Live Feed Behavior:{' '}
              {isWatchlist ? (
                <>
                  <span className="text-red-400 font-bold">RED BOX</span> + WATCHLIST VEHICLE match alert with acoustic siren.
                </>
              ) : (
                <>
                  <span className="text-cyan-400 font-bold">BLUE BOX</span> + AUTHORIZED VEHICLE with silent perimeter clearance.
                </>
              )}
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

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">LICENSE PLATE *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DL-01-AB-1234"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface uppercase font-mono tracking-wider focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">VEHICLE TYPE *</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                >
                  <option value="Car">Car</option>
                  <option value="SUV">SUV</option>
                  <option value="Truck">Truck</option>
                  <option value="Bus">Bus</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Jeep">Jeep</option>
                  <option value="Military Vehicle">Military Vehicle</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">STATUS CLASSIFICATION *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className={`w-full bg-surface-container-lowest border rounded-lg px-3 py-2 text-body-md font-mono font-bold focus:outline-none ${
                    isWatchlist
                      ? 'border-red-500/60 text-red-400'
                      : 'border-cyan-400/60 text-cyan-400'
                  }`}
                >
                  <option value="Authorized">Authorized (Blue Box - Safe)</option>
                  <option value="Watchlist">Watchlist (Red Box - Alert)</option>
                  <option value="Blocked">Blocked (Red Box - Intercept)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">MAKE & MODEL</label>
                <input
                  type="text"
                  placeholder="e.g. Toyota Hilux / Mahindra Scorpio"
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">REGISTERED OWNER / ENTITY</label>
                <input
                  type="text"
                  placeholder="e.g. Border Patrol Unit Alpha / Civilian"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-xs font-mono text-on-surface-variant">ASSIGNED UNIT / SECTOR</label>
                <input
                  type="text"
                  placeholder="e.g. Sector 4 Patrol"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-body-xs font-mono text-on-surface-variant">COLOR / APPEARANCE</label>
                <input
                  type="text"
                  placeholder="e.g. Matte Olive Drab, White, Black"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-body-md text-on-surface focus:border-cyan-400 focus:outline-none font-inter"
                />
              </div>
            </div>

            {/* Optional Image */}
            <div className="space-y-1.5">
              <label className="block text-body-xs font-mono text-on-surface-variant">
                OPTIONAL VEHICLE PHOTO
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-white/20 hover:border-white/40 rounded-xl p-3 flex items-center justify-between cursor-pointer bg-surface-container-lowest/40"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                    <span className="text-body-sm font-mono text-cyan-300">Photo Attached</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-on-surface-variant text-body-sm font-mono">
                    <Camera size={16} />
                    <span>Upload reference vehicle photo (optional)</span>
                  </div>
                )}
                <span className="text-body-xs text-on-surface-variant underline">Browse</span>
              </div>
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
                className={`py-2 px-5 text-body-sm font-mono flex items-center gap-2 rounded-lg font-bold transition-colors ${
                  isWatchlist
                    ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300'
                    : 'btn-primary'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                    <span>Registering Vehicle...</span>
                  </>
                ) : (
                  <>
                    <Car size={16} />
                    <span>Register Vehicle</span>
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
