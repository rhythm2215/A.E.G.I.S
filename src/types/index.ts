// ============================================================
//  AEGIS — Shared TypeScript Types
// ============================================================

// ── Enums ────────────────────────────────────────────────────

export type NodeType = 'cctv' | 'border_cam' | 'checkpost' | 'ptz' | 'thermal' | 'local_cam';

export type NodeStatus = 'online' | 'recording' | 'standby' | 'alert' | 'offline';

export type PersonnelRole = 'officer' | 'soldier' | 'guard' | 'staff' | 'contractor';

export type PersonnelStatus = 'on_duty' | 'patrolling' | 'standby' | 'off_duty';

export type VehicleCategory = 'authorized' | 'watchlist' | 'unknown';

export type VehicleClass = 'car' | 'truck' | 'bus' | 'motorcycle' | 'jeep' | 'van';

export type IncidentType =
  | 'face_match'
  | 'vehicle_match'
  | 'unknown_person'
  | 'unknown_vehicle'
  | 'intrusion'
  | 'fence_breach';

export type DroneStatus =
  | 'patrol_active'
  | 'manual_control'
  | 'returning_home'
  | 'landing'
  | 'idle'
  | 'offline'
  | 'charging'
  | 'emergency';

export type SuspectStatus =
  | 'active_surveillance'
  | 'detained'
  | 'at_large'
  | 'watchlist'
  | 'cleared'
  | 'unknown';

export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low' | 'system';

export type NotificationType =
  | 'watchlist_match'
  | 'authorized_personnel'
  | 'unknown_person'
  | 'watchlist_vehicle'
  | 'unknown_vehicle'
  | 'fence_breach'
  | 'restricted_intrusion'
  | 'drone_status'
  | 'suspect_detection'
  | 'suspect_tracking'
  | 'multi_drone'
  | 'mission'
  | 'system'
  | 'geofence'
  | 'face_recognition';

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'stopped' | 'loading';

export type MapEntityType = 'drone' | 'suspect' | 'camera_node' | 'personnel' | 'vehicle' | 'incident' | 'waypoint';

export type OperationalView = 'map' | 'camera';

export type TimelineMode = 'node' | 'identity' | 'incident' | 'drone' | 'suspect';

// ── Core Entities ─────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
  altitude?: number;
}

// ── Surveillance Nodes (CCTV, Border, Checkpost, PTZ, Thermal) ─

export interface SurveillanceNode {
  id: string; // e.g. CAM-01
  name: string; // e.g. CAM-01 Border Gate
  location: string;
  type: NodeType;
  status: NodeStatus;
  fps: number;
  resolution: string;
  lastActivity: string;
  assignedZone: string;
  activePeopleCount: number;
  activeVehiclesCount: number;
  alertsCount: number;
  coordinates: Coordinates;
  streamUrl?: string;
  fovAngle?: number;
  hasThermal?: boolean;
  /** True for webcams/USB cameras enumerated from the browser */
  isLocalCamera?: boolean;
  /** Browser MediaDevices device ID for getUserMedia */
  localDeviceId?: string;
}

// ── Identities: Personnel (Authorized) & Watchlist (Suspects) ──

export interface Personnel {
  id: string; // e.g. PER-101
  fullName: string;
  rank: string;
  unit: string;
  role: PersonnelRole;
  status: PersonnelStatus;
  faceImage: string;
  photoUrl?: string;
  faceEmbedding?: number[];
  lastSeen: string;
  cameraSource: string;
  recognitionConfidence: number;
  clearanceLevel: string;
  badgeNumber?: string;
  assignedZone?: string;
  department?: string;
  callsign?: string;
  assignedSector?: string;
  lastKnownLocation?: string;
  contactRadio?: string;
  shift?: string;
}

// ── Vehicles (Authorized, Watchlist, Unknown) ───────────────────

export interface Vehicle {
  id: string; // e.g. VEH-014
  vehicleName: string;
  type: VehicleClass;
  plateNumber: string;
  category: VehicleCategory;
  owner?: string;
  threatTag?: string;
  notes?: string;
  lastSeen: string;
  cameraSource: string;
  confidence: number;
  imageUrl: string;
  trackingId: string; // e.g. "Vehicle ID 014"
  speedKmh?: number;
  direction?: string;
}

// ── Incidents ───────────────────────────────────────────────────

export interface Incident {
  id: string;
  type: IncidentType;
  severity: NotificationPriority;
  title: string;
  description: string;
  cameraNodeId: string;
  cameraName: string;
  timestamp: string;
  snapshotUrl?: string;
  coordinates?: Coordinates;
  zone?: string;
  status: 'active' | 'investigating' | 'resolved' | 'escalated';
  relatedEntityId?: string;
  relatedEntityName?: string;
}

// ── Virtual Fence & Restricted Zones ───────────────────────────

export interface VirtualFenceZone {
  id: string;
  name: string;
  type: 'polygon' | 'line' | 'restricted_area';
  points: { x: number; y: number }[]; // Normalized 0-100 coordinates on video/canvas
  geoCoordinates?: Coordinates[];
  color: string;
  active: boolean;
  alertOnIntrusion: boolean;
  activeBreaches: number;
  lastBreachTimestamp?: string;
}

export interface Drone {
  id: string;
  name: string;
  model: string;
  type: string;
  serialNumber: string;
  status: DroneStatus;
  coordinates: Coordinates;
  sector: string;
  battery: {
    percentage: number;
    remainingFlightTime: number; // minutes
    health: number; // percentage
    lastChargeTime: string;
  };
  telemetry: {
    speed: number; // km/h
    heading: number; // degrees
    signalStrength: number; // percentage
    gpsStatus: 'fixed' | 'searching' | 'lost';
    altitude: number; // meters
  };
  mission: {
    assignedMissionId: string | null;
    missionName: string | null;
    deploymentTime: string | null;
    lastActivity: string;
  };
  linkedSuspects: string[]; // suspect IDs
  lastUpdated: string;
}

export interface Suspect {
  id: string;
  fullName: string;
  alias: string[];
  age: number;
  gender: string;
  nationality: string;
  status: SuspectStatus;
  threatLevel: ThreatLevel;
  watchlisted: boolean;
  facialImages: FacialImage[];
  recognitionConfidence: number;
  physicalDescription: {
    height: string;
    weight: string;
    clothing: string;
    distinguishingFeatures: string;
  };
  tracking: {
    assignedDrones: string[];
    firstDetection: string;
    lastDetection: string;
    currentCoordinates: Coordinates | null;
    currentSector: string | null;
  };
  intelligence: {
    criminalHistory: string[];
    openInvestigations: string[];
    associatedIndividuals: string[];
    notes: string;
  };
  lastUpdated: string;
}

export interface FacialImage {
  id: string;
  url: string;
  capturedAt: string;
  droneId: string | null;
  confidence: number;
  verified: boolean;
}

export interface CriminalRecord {
  id: string;
  suspectId: string;
  suspect: Pick<Suspect, 'id' | 'fullName' | 'alias' | 'threatLevel' | 'status' | 'facialImages'>;
  recordType: string;
  caseNumber: string;
  description: string;
  charges: string[];
  incidentDate: string;
  location: string;
  status: 'open' | 'closed' | 'pending' | 'under_review';
  assignedOfficer: string;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'paused' | 'planned' | 'aborted';
  assignedDrones: string[];
  targetSuspects: string[];
  startTime: string;
  endTime: string | null;
  area: {
    name: string;
    coordinates: Coordinates[];
  };
  objectives: string[];
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  droneId?: string;
  suspectId?: string;
  missionId?: string;
  description: string;
  confidence?: number;
  coordinates?: Coordinates;
  locationName?: string;
  alertStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  priority: NotificationPriority;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  acknowledged: boolean;
  droneId?: string;
  suspectId?: string;
  missionId?: string;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  variant?: 'primary' | 'ghost' | 'danger';
}

export interface PlaybackSession {
  id: string;
  droneId: string;
  droneName: string;
  missionId: string | null;
  missionName: string | null;
  recordingDate: string;
  startTime: string;
  duration: number; // seconds
  suspects: string[];
  fileUrl: string;
  thumbnailUrl: string;
  eventMarkers: PlaybackMarker[];
}

export interface PlaybackMarker {
  id: string;
  timestamp: number; // seconds into recording
  type: 'detection' | 'alert' | 'mission_event' | 'evidence';
  label: string;
  suspectId?: string;
  confidence?: number;
}

export interface MapEntity {
  id: string;
  type: MapEntityType;
  coordinates: Coordinates;
  label: string;
  status?: string;
  data: Drone | Suspect | null;
}

// ── Settings ─────────────────────────────────────────────────

export interface AppSettings {
  general: {
    systemName: string;
    timezone: string;
    units: 'metric' | 'imperial';
    language: string;
    autoRefreshInterval: number; // seconds
  };
  dashboard: {
    defaultView: OperationalView;
    panelLayout: 'standard' | 'focus' | 'minimal';
    showTelemetry: boolean;
    showTimeline: boolean;
  };
  map: {
    defaultCenter: Coordinates;
    defaultZoom: number;
    mapStyle: string;
    showDroneTrails: boolean;
    trailLength: number; // points
  };
  notifications: {
    soundEnabled: boolean;
    criticalAlert: boolean;
    highAlert: boolean;
    mediumAlert: boolean;
    lowAlert: boolean;
    retentionDays: number;
  };
  ai: {
    faceRecognitionEnabled: boolean;
    minimumConfidence: number;
    autoTagging: boolean;
    modelVersion: string;
  };
  camera: {
    defaultQuality: '1080p' | '720p' | '480p';
    recordingEnabled: boolean;
    storageLimit: number; // GB
  };
}

// ── Auth ─────────────────────────────────────────────────────

export type UserRole = 'admin' | 'operator' | 'analyst' | 'viewer';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatar?: string;
  lastLogin: string;
  permissions: string[];
}

// ── API Responses ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

// ── Panel Visibility ──────────────────────────────────────────

export interface PanelVisibility {
  entityPanel: boolean;
  timelinePanel: boolean;
  notificationPanel: boolean;
  detailPanel: boolean;
  cameraControls: boolean;
}
