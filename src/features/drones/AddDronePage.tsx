import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crosshair, Radio, Shield, Check, Plus, Cpu, Battery, Compass } from 'lucide-react';
import { useDroneStore } from '@/store/droneStore';
import type { Drone, DroneStatus } from '@/types';

export function AddDronePage() {
  const navigate = useNavigate();
  const { addDrone, drones } = useDroneStore();

  const [formData, setFormData] = useState({
    name: 'Falcon-09',
    model: 'DJI Matrice 350 RTK',
    type: 'Surveillance',
    serialNumber: `MAT350-X${Math.floor(100 + Math.random() * 900)}-2026`,
    status: 'idle' as DroneStatus,
    sector: 'Sector B7',
    batteryPercentage: 100,
    remainingFlightTime: 45,
    cameraPayload: 'Zenmuse H20N (Thermal + 4K Optical + Laser Rangefinder)',
    frequency: '5.8 GHz AES-256 Encrypted',
    rtkEnabled: true,
    speedMax: 72,
    missionName: 'Operation Horizon',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `DRN-${String(drones.length + 1).padStart(2, '0')}`;

    const newDrone: Drone = {
      id: newId,
      name: formData.name,
      model: formData.model,
      type: formData.type,
      serialNumber: formData.serialNumber,
      status: formData.status,
      coordinates: { lat: 25.3176, lng: 82.9739, altitude: 0 },
      sector: formData.sector,
      battery: {
        percentage: Number(formData.batteryPercentage) || 100,
        remainingFlightTime: Number(formData.remainingFlightTime) || 40,
        health: 100,
        lastChargeTime: new Date().toISOString(),
      },
      telemetry: {
        speed: 0,
        heading: 0,
        signalStrength: 100,
        gpsStatus: formData.rtkEnabled ? 'fixed' : 'searching',
        altitude: 0,
      },
      mission: {
        assignedMissionId: `MSN-${Math.floor(1000 + Math.random() * 9000)}`,
        missionName: formData.missionName || null,
        deploymentTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      },
      linkedSuspects: [],
      lastUpdated: new Date().toISOString(),
    };

    addDrone(newDrone);
    setSubmitted(true);
    setTimeout(() => {
      navigate('/');
    }, 800);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-5 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between tactical-glass px-4 py-3 rounded-xl border border-glass">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary-fixed-dim font-mono text-body-md transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        <span className="font-mono text-[11px] text-outline uppercase tracking-wider">
          HARDWARE ASSET PROVISIONING
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="tactical-glass p-6 rounded-xl border border-glass shadow-panel space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h1 className="font-grotesk font-bold text-headline-md text-on-surface flex items-center gap-2.5">
              <Crosshair size={22} className="text-primary-fixed-dim" />
              <span>A.E.G.I.S. Drone Hardware Registration</span>
            </h1>
            <p className="text-body-md text-on-surface-variant font-inter mt-1">
              Bind telemetry streams, configure sensory payloads, register RTK differential GPS identifiers, and link the UAV to active patrol missions.
            </p>
          </div>

          {/* Core Hardware Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Callsign / Unit Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-glass font-mono font-bold text-primary-fixed-dim"
                placeholder="Falcon-09"
              />
            </div>

            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Drone Platform / Model *
              </label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="input-glass font-mono text-[12px]"
              >
                <option value="DJI Matrice 350 RTK">DJI Matrice 350 RTK (Heavy Patrol)</option>
                <option value="Autel Robotics EVO II Pro">Autel EVO II Pro (Rapid Tactical)</option>
                <option value="Skydio X10D">Skydio X10D (Autonomous AI Recon)</option>
                <option value="Freefly Alta X">Freefly Alta X (Multi-sensor Payload)</option>
                <option value="Custom ESP32 Micro UAV">Custom ESP32 Micro UAV (Tethered/Mesh)</option>
              </select>
            </div>

            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Mission Role Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input-glass font-mono text-[12px]"
              >
                <option value="Surveillance">Surveillance & Pursuit</option>
                <option value="Tactical">Tactical Overwatch</option>
                <option value="Reconnaissance">Area Recon & Perimeter Scan</option>
                <option value="Relay">Communication Mesh Relay</option>
              </select>
            </div>
          </div>

          {/* Telemetry & Avionics Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Hardware Serial Number / Transponder
              </label>
              <input
                type="text"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className="input-glass font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Patrol Sector
              </label>
              <select
                value={formData.sector}
                onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                className="input-glass font-mono text-[12px]"
              >
                <option value="Sector B7">Sector B7 (Urban North)</option>
                <option value="Sector C2">Sector C2 (Central Market)</option>
                <option value="Sector D4">Sector D4 (Industrial Highway)</option>
                <option value="Zone Alpha">Zone Alpha (Restricted Perimeter)</option>
                <option value="Base Alpha">Base Alpha (Hangar / Charging Pad)</option>
              </select>
            </div>

            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Telemetry Link Protocol
              </label>
              <input
                type="text"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="input-glass font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Sensor Payload & GPS Binding */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Optical & Thermal Camera Payload
              </label>
              <input
                type="text"
                value={formData.cameraPayload}
                onChange={(e) => setFormData({ ...formData, cameraPayload: e.target.value })}
                className="input-glass"
              />
            </div>

            <div>
              <label className="font-mono text-label-caps text-outline uppercase block mb-1">
                Initial Mission Binding
              </label>
              <input
                type="text"
                value={formData.missionName}
                onChange={(e) => setFormData({ ...formData, missionName: e.target.value })}
                className="input-glass font-mono"
              />
            </div>
          </div>

          {/* Battery & Differential GPS Checkbox */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-surface-charcoal/50 border border-outline-variant/30 rounded-lg">
            <div className="flex items-center gap-6 font-mono text-[12px]">
              <div>
                <span className="text-outline">Max Flight Speed: </span>
                <span className="text-on-surface font-bold">{formData.speedMax} km/h</span>
              </div>
              <div>
                <span className="text-outline">Est. Endurance: </span>
                <span className="text-health-emerald font-bold">{formData.remainingFlightTime} Mins</span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer font-mono text-body-md text-primary-fixed-dim">
              <input
                type="checkbox"
                checked={formData.rtkEnabled}
                onChange={(e) => setFormData({ ...formData, rtkEnabled: e.target.checked })}
                className="rounded bg-surface-container-lowest border-outline/40 text-primary-fixed-dim focus:ring-0"
              />
              <span>Enable Sub-Centimeter RTK GPS Fix</span>
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitted}
              className="btn-primary px-6 py-2.5 flex items-center gap-2"
            >
              {submitted ? (
                <>
                  <Check size={16} />
                  <span>Linking Hardware...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Register Drone into Fleet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
