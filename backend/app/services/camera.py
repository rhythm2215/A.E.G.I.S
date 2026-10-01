"""
A.E.G.I.S. Camera Stream Manager & Real-Time Biometric / Vehicle Intelligence Pipeline

High-Performance Architecture (Ultra-Smooth 30 FPS + Async AI Worker):
  - _capture_loop (Background Capture Thread - 30 FPS)
    * Reads camera frames at native 30 FPS
    * Stretches last known bounding boxes onto current frame
    * Yields smooth JPEG buffer without blocking
  - _ai_worker_loop (Async Background AI Worker)
    * Downscales frame to 360px width for fast ONNX inference
    * Runs YuNet Face Landmark Localization
    * SFace 128-d Deep Feature Alignment & Vector Extraction
    * Dual Biometric Matching: Personnel DB (Blue) vs Watchlist DB (Red) vs Unknown (Orange)
    * Vehicle Intelligence: Contour/Aspect-Ratio Detection & Classification
"""

import os
import json
import glob
import cv2
import time
import math
import shutil
import logging
import threading
from collections import Counter
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable, Tuple
from datetime import datetime
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()

logger = logging.getLogger("aegis.camera")
logging.basicConfig(level=logging.INFO)
UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")
VECTORS_DIR = os.path.join(DATA_DIR, "vectors")

PERSONNEL_JSON_PATH = os.path.join(DATA_DIR, "personnel_db.json")
SUSPECTS_JSON_PATH = os.path.join(DATA_DIR, "suspects_db.json")
VEHICLES_JSON_PATH = os.path.join(DATA_DIR, "vehicles_db.json")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(VECTORS_DIR, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")

#        1. dlib / face_recognition Detection                                                                   
try:
    import face_recognition
    HAS_FACE_RECOGNITION = True
except ImportError:
    HAS_FACE_RECOGNITION = False

#        2. OpenCV YuNet & SFace Initialization                                                             
HAS_SFACE = False
_sface_recognizer = None
_yunet_detector = None

if os.path.exists(SFACE_MODEL_PATH) and hasattr(cv2, "FaceRecognizerSF"):
    try:
        _sface_recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL_PATH, "")
        HAS_SFACE = True
        logger.info(f"SFace 128-d DNN Recognizer loaded: {SFACE_MODEL_PATH}")
    except Exception as e:
        logger.warning(f"SFace init error: {e}")

if os.path.exists(YUNET_MODEL_PATH) and hasattr(cv2, "FaceDetectorYN"):
    try:
        # Initialize at 720p-wide inference for better landmark precision on tilted faces.
        # 360p gave only ~10-15px inter-eye distance on tilted faces — too imprecise for alignCrop.
        # 720p gives ~20-30px inter-eye distance, making landmark alignment reliable.
        _yunet_detector = cv2.FaceDetectorYN.create(YUNET_MODEL_PATH, "", (720, 404), score_threshold=0.60, nms_threshold=0.3)
        logger.info(f"YuNet DNN Detector loaded at 720x404 inference resolution: {YUNET_MODEL_PATH}")
    except Exception as e:
        logger.warning(f"YuNet init error: {e}")

_yunet_lock = threading.Lock()

#        3. Haar Cascade Fallback                                                                                                       
_global_face_cascade = None
try:
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml" if hasattr(cv2, "data") else None
    if hasattr(cv2, "CascadeClassifier"):
        _global_face_cascade = cv2.CascadeClassifier(cascade_path)
    elif hasattr(cv2, "legacy") and hasattr(cv2.legacy, "CascadeClassifier"):
        _global_face_cascade = cv2.legacy.CascadeClassifier(cascade_path)
except Exception:
    pass

#        4. Default Seed Databases                                                                                                    

DEFAULT_SEED_PERSONNEL: Dict[str, Dict[str, Any]] = {
    "PER-101": {
        "id": "PER-101",
        "fullName": "Col. Vikram Rathore",
        "rank": "Colonel / Sector Commander",
        "threatLevel": "LOW",
        "alias": "Sector Commander",
        "age": 48,
        "gender": "Male",
        "nationality": "Indian",
        "role": "officer",
        "unit": "Alpha Garrison",
        "department": "Border Reconnaissance Cmd",
        "clearanceLevel": "LEVEL 4     COMMAND",
        "status": "AUTHORIZED",
        "watchlisted": False,
        "facialImages": [
            {
                "id": "fi-per-101",
                "url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
                "capturedAt": "2026-08-30T16:00:00Z",
                "droneId": "CAM-01",
                "confidence": 98,
                "verified": True,
            }
        ],
        "recognitionConfidence": 98,
        "physicalDescription": {
            "height": "180 cm",
            "weight": "80 kg",
            "clothing": "Sector Commander Uniform",
            "distinguishingFeatures": "Authorized Officer",
        },
        "tracking": {"currentSector": "Sector Command Center"},
        "intelligence": {"notes": "Authorized Sector Commander. Free clearance."},
        "encodings": [],
    },
    "PER-102": {
        "id": "PER-102",
        "fullName": "Capt. Ananya Sharma",
        "rank": "Captain / Tactical Lead",
        "threatLevel": "LOW",
        "alias": "Tactical Lead",
        "age": 32,
        "gender": "Female",
        "nationality": "Indian",
        "role": "officer",
        "unit": "Bravo Tactical Unit",
        "department": "Quick Reaction Team 2",
        "clearanceLevel": "LEVEL 3     OPERATIONAL",
        "status": "AUTHORIZED",
        "watchlisted": False,
        "facialImages": [
            {
                "id": "fi-per-102",
                "url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face",
                "capturedAt": "2026-08-30T16:00:00Z",
                "droneId": "CAM-02",
                "confidence": 96,
                "verified": True,
            }
        ],
        "recognitionConfidence": 96,
        "physicalDescription": {
            "height": "168 cm",
            "weight": "60 kg",
            "clothing": "Tactical Operations Gear",
            "distinguishingFeatures": "Authorized Officer",
        },
        "tracking": {"currentSector": "Sector B7"},
        "intelligence": {"notes": "Authorized Tactical Lead. Free clearance."},
        "encodings": [],
    },
    "PER-103": {
        "id": "PER-103",
        "fullName": "Rhythm Gupta",
        "rank": "Officer / Tactical Lead",
        "threatLevel": "LOW",
        "alias": "Lead Specialist",
        "age": 28,
        "gender": "Male",
        "nationality": "Indian",
        "role": "officer",
        "unit": "Technical Surveillance Division",
        "department": "Cyber & Tactical Intel",
        "clearanceLevel": "LEVEL 4     COMMAND",
        "status": "AUTHORIZED",
        "watchlisted": False,
        "facialImages": [
            {
                "id": "fi-per-103",
                "url": "/uploads/PER-103.jpg",
                "capturedAt": "2026-09-23T06:28:14Z",
                "droneId": "CAM-01",
                "confidence": 98,
                "verified": True,
            }
        ],
        "recognitionConfidence": 98,
        "physicalDescription": {
            "height": "178 cm",
            "weight": "72 kg",
            "clothing": "Authorized Attire",
            "distinguishingFeatures": "Authorized Officer",
        },
        "tracking": {"currentSector": "Sector Command Center"},
        "intelligence": {"notes": "Authorized Tactical Systems Officer. Free clearance."},
        "encodings": [],
    },
}

DEFAULT_SEED_SUSPECTS: Dict[str, Dict[str, Any]] = {
    "SUS-127": {
        "id": "SUS-127",
        "fullName": "Arjun Mehta",
        "threatLevel": "CRITICAL",
        "alias": "The Ghost",
        "age": 34,
        "gender": "Male",
        "nationality": "Indian",
        "status": "active_surveillance",
        "watchlisted": True,
        "facialImages": [
            {
                "id": "fi-001",
                "url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
                "capturedAt": "2026-08-31T03:18:41Z",
                "droneId": "DRN-03",
                "confidence": 96,
                "verified": True,
            }
        ],
        "recognitionConfidence": 96,
        "physicalDescription": {
            "height": "178 cm",
            "weight": "72 kg",
            "clothing": "Dark grey jacket, black trousers",
            "distinguishingFeatures": "Scar on left cheek, tattoo on right forearm",
        },
        "tracking": {
            "assignedDrones": ["DRN-03", "DRN-07"],
            "firstDetection": "2026-08-31T03:18:41Z",
            "lastDetection": "2026-08-31T03:44:12Z",
            "currentCoordinates": {"lat": 25.3184, "lng": 82.9752},
            "currentSector": "Sector B7",
        },
        "intelligence": {
            "criminalHistory": ["Arms trafficking", "Organized crime", "Money laundering"],
            "openInvestigations": ["INV-2024-089", "INV-2025-014"],
            "associatedIndividuals": ["SUS-212", "SUS-431"],
            "notes": "Considered armed and extremely dangerous. Do not approach without backup.",
        },
        "encodings": [],
    },
    "SUS-212": {
        "id": "SUS-212",
        "fullName": "Kavitha Rajan",
        "threatLevel": "HIGH",
        "alias": "K-Rajan",
        "age": 29,
        "gender": "Female",
        "nationality": "Indian",
        "status": "watchlist",
        "watchlisted": True,
        "facialImages": [
            {
                "id": "fi-002",
                "url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
                "capturedAt": "2026-08-30T14:22:00Z",
                "droneId": "DRN-07",
                "confidence": 89,
                "verified": True,
            }
        ],
        "recognitionConfidence": 89,
        "physicalDescription": {
            "height": "162 cm",
            "weight": "58 kg",
            "clothing": "Blue kurta, jeans",
            "distinguishingFeatures": "Distinctive birthmark on neck",
        },
        "tracking": {
            "assignedDrones": ["DRN-07"],
            "firstDetection": "2026-08-29T11:00:00Z",
            "lastDetection": "2026-08-31T02:50:00Z",
            "currentCoordinates": {"lat": 25.3210, "lng": 82.9801},
            "currentSector": "Sector C2",
        },
        "intelligence": {
            "criminalHistory": ["Financial fraud", "Identity theft"],
            "openInvestigations": ["INV-2025-031"],
            "associatedIndividuals": ["SUS-127"],
            "notes": "Suspected financial handler for SUS-127 network.",
        },
        "encodings": [],
    },
    "SUS-431": {
        "id": "SUS-431",
        "fullName": "Rakesh Verma",
        "threatLevel": "CRITICAL",
        "alias": "Bullet",
        "age": 41,
        "gender": "Male",
        "nationality": "Indian",
        "status": "at_large",
        "watchlisted": True,
        "facialImages": [
            {
                "id": "fi-003",
                "url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
                "capturedAt": "2026-08-28T09:15:00Z",
                "droneId": "DRN-03",
                "confidence": 82,
                "verified": False,
            }
        ],
        "recognitionConfidence": 82,
        "physicalDescription": {
            "height": "185 cm",
            "weight": "95 kg",
            "clothing": "Black tactical vest, combat boots",
            "distinguishingFeatures": "Burns on right hand",
        },
        "tracking": {
            "assignedDrones": ["DRN-03"],
            "firstDetection": "2026-08-28T09:15:00Z",
            "lastDetection": "2026-08-30T19:00:00Z",
            "currentCoordinates": {"lat": 25.3090, "lng": 82.9650},
            "currentSector": "Transit",
        },
        "intelligence": {
            "criminalHistory": ["Homicide", "Extortion", "Weapons trafficking"],
            "openInvestigations": ["INV-2024-042", "INV-2025-008"],
            "associatedIndividuals": ["SUS-127"],
            "notes": "Former military contractor, highly trained in evasion tactics.",
        },
        "encodings": [],
    },
}

DEFAULT_SEED_VEHICLES: Dict[str, Dict[str, Any]] = {
    "VEH-101": {
        "id": "VEH-101",
        "plate": "IND-ARMY-0824",
        "plateNumber": "IND-ARMY-0824",
        "vehicleName": "Mahindra Marksman Light Armoured",
        "category": "authorized",
        "vehicleType": "SUV",
        "vehicleClass": "patrol_truck",
        "makeModel": "Mahindra Marksman Light Armoured",
        "color": "Matte Olive Drab",
        "assignedUnit": "Border Patrol Unit Alpha",
        "owner": "Border Patrol Unit Alpha",
        "status": "authorized",
        "confidence": 98.4,
        "speedKmh": 28,
        "lastSeen": "Just now",
        "lastDetected": "2026-09-23T05:31:00Z",
        "notes": "Standard issue armored border patrol vehicle.",
    },
    "VEH-102": {
        "id": "VEH-102",
        "plate": "AR-99-TK-8821",
        "plateNumber": "AR-99-TK-8821",
        "vehicleName": "Armored Personnel Carrier",
        "category": "authorized",
        "vehicleType": "Military Vehicle",
        "vehicleClass": "apc",
        "makeModel": "Armored Tactical Personnel Carrier",
        "color": "Camo Green",
        "assignedUnit": "Quick Reaction Team 1",
        "owner": "Quick Reaction Team 1",
        "status": "authorized",
        "confidence": 99.1,
        "speedKmh": 35,
        "lastSeen": "5m ago",
        "lastDetected": "2026-09-23T05:20:00Z",
        "notes": "QRF Tactical Carrier with unrestricted sector clearance.",
    },
    "VEH-103": {
        "id": "VEH-103",
        "plate": "DL-01-AB-1234",
        "plateNumber": "DL-01-AB-1234",
        "vehicleName": "Toyota Corolla Patrol Liaison",
        "category": "authorized",
        "vehicleType": "Car",
        "vehicleClass": "sedan",
        "makeModel": "Toyota Corolla Patrol Liaison",
        "color": "White",
        "assignedUnit": "Command Liaison",
        "owner": "Major Arjun Rathore",
        "status": "authorized",
        "confidence": 97.2,
        "speedKmh": 40,
        "lastSeen": "12m ago",
        "lastDetected": "2026-09-23T04:45:00Z",
        "notes": "Authorized command staff vehicle.",
    },
    "VEH-201": {
        "id": "VEH-201",
        "plate": "DL-04-BB-0911",
        "plateNumber": "DL-04-BB-0911",
        "vehicleName": "Mahindra Scorpio Classic",
        "category": "watchlist",
        "vehicleType": "SUV",
        "vehicleClass": "suv",
        "makeModel": "Mahindra Scorpio Classic",
        "color": "Black",
        "assignedUnit": "Unassigned / Syndicate",
        "owner": "Rakesh Verma (SUS-431)",
        "status": "watchlist",
        "threatLevel": "CRITICAL",
        "confidence": 96.1,
        "speedKmh": 52,
        "lastSeen": "2m ago",
        "lastDetected": "2026-09-23T05:28:44Z",
        "notes": "Flagged vehicle linked to illicit border weapons transit network.",
    },
    "VEH-202": {
        "id": "VEH-202",
        "plate": "JK-05-XY-9900",
        "plateNumber": "JK-05-XY-9900",
        "vehicleName": "Off-road Recon 4x4",
        "category": "watchlist",
        "vehicleType": "Jeep",
        "vehicleClass": "jeep",
        "makeModel": "Off-road Recon 4x4",
        "color": "Dark Grey",
        "assignedUnit": "Unassigned",
        "owner": "Watchlist Syndicate",
        "status": "watchlist",
        "threatLevel": "HIGH",
        "confidence": 94.0,
        "speedKmh": 45,
        "lastSeen": "18m ago",
        "lastDetected": "2026-09-23T03:15:00Z",
        "notes": "Evaded checkpoint at Sector Charlie.",
    },
    "VEH-203": {
        "id": "VEH-203",
        "plate": "UP-14-BT-5544",
        "plateNumber": "UP-14-BT-5544",
        "vehicleName": "Yamaha FZ-25",
        "category": "watchlist",
        "vehicleType": "Motorcycle",
        "vehicleClass": "motorcycle",
        "makeModel": "Yamaha FZ-25",
        "color": "Red",
        "assignedUnit": "Unassigned",
        "owner": "Smuggling Courier",
        "status": "watchlist",
        "threatLevel": "HIGH",
        "confidence": 91.5,
        "speedKmh": 68,
        "lastSeen": "35m ago",
        "lastDetected": "2026-09-23T02:40:00Z",
        "notes": "High-speed courier bike flagged across perimeter roads.",
    },
}


#                                                                                                                                                                                              
class CameraStreamManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        cam_src = os.getenv("CAMERA_SOURCE", "browser").strip()
        # In cloud containers or when camera source is local, default to browser
        if cam_src in ("0", "1", "local", "webcam") or os.getenv("PORT") or os.getenv("RAILWAY_ENVIRONMENT"):
            cam_src = "browser"

        self.camera_source: Any = cam_src

        self.min_confidence = float(os.getenv("MIN_MATCH_CONFIDENCE", "0.75"))
        # Threshold: 0.38 accommodates moderate tilt (up to ~40°) while still rejecting strangers.
        # Frontal matches score ~0.85-0.95. 30° tilt drops to ~0.50-0.65. 45° tilt ~0.38-0.50.
        self.sface_cosine_threshold = float(os.getenv("SFACE_THRESHOLD", "0.38"))
        self.alert_cooldown_sec = 3.0
        self._face_debug_log_counter = 0  # Rate-limit debug logs to avoid flood

        # Camera Sources Catalog — Browser-driven & Network Streams (no container hardware dependency)
        self.camera_sources_catalog: Dict[str, Dict[str, Any]] = {
            "Browser Camera": {
                "id": "Browser Camera",
                "name": "Browser Camera",
                "type": "browser",
                "source": "browser",
                "description": "Live Browser WebRTC / MediaStream Client Feed",
            },
            "CAM-01": {
                "id": "CAM-01",
                "name": "Browser Camera",
                "type": "browser",
                "source": "browser",
                "description": "Border Gate Primary Camera (Browser Client Feed)",
            },
            "Cam MB": {
                "id": "Cam MB",
                "name": "Cam MB",
                "type": "network",
                "source": os.getenv("CAM_MB_URL", ""),
                "description": "Tactical Remote RTSP/HTTP Stream",
            },
        }

        # Active source ID resolution
        if isinstance(self.camera_source, str) and ("http" in self.camera_source or "rtsp" in self.camera_source):
            self.active_source_id = "Cam MB"
            self.camera_sources_catalog["Cam MB"]["source"] = self.camera_source
        else:
            self.active_source_id = "Browser Camera"

        self.connection_status: str = "ready"
        self._switch_requested: bool = False
        self._target_camera_source: Any = self.camera_source
        self._target_source_id: str = self.active_source_id

        self.lock = threading.Lock()
        self._annotated_frame: Optional[np.ndarray] = None
        self._cached_detections: List[Dict[str, Any]] = []
        self._target_persist_until: float = 0.0
        self._last_matched_target: Optional[Dict[str, Any]] = None
        self._last_alert_time: Dict[str, float] = {}

        # Temporal smoothing buffer for face recognition (majority vote across frames)
        self._recog_buffer: List[Tuple[str, Optional[str], float, Dict[str, Any]]] = []
        self._recog_buffer_maxlen: int = 5

        # AI worker queue / state
        self._latest_raw_frame: Optional[np.ndarray] = None
        self._ai_busy = False

        # Load 3 distinct registries: Personnel, Suspects, Vehicles
        self.personnel_db: Dict[str, Dict[str, Any]] = {}
        self.suspect_db: Dict[str, Dict[str, Any]] = {}
        self.vehicle_db: Dict[str, Dict[str, Any]] = {}
        self._load_all_databases()

        self.alert_callbacks: List[Callable[[Dict[str, Any]], Any]] = []
        self._initialized = True

        # Start 30-FPS video capture thread
        self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True, name="aegis-cap")
        self._capture_thread.start()

        # Start dedicated AI inference worker thread
        self._ai_thread = threading.Thread(target=self._ai_worker_loop, daemon=True, name="aegis-ai")
        self._ai_thread.start()

        logger.info(
            f"CameraStreamManager running | SFace={HAS_SFACE} | Source={self.camera_source} [{self.active_source_id}] | "
            f"Personnel: {len(self.personnel_db)}, Suspects: {len(self.suspect_db)}, Vehicles: {len(self.vehicle_db)}"
        )

    #        Database Persistence & Migration Helpers                                                    

    def _load_all_databases(self):
        """Loads and syncs Personnel, Suspects, and Vehicles from disk."""
        with self.lock:
            # 1. Migration: if user enrolled previously as SUS-649, migrate vector to PER-103
            old_sus_vec = os.path.join(VECTORS_DIR, "SUS-649.npy")
            per_103_vec = os.path.join(VECTORS_DIR, "PER-103.npy")
            if os.path.exists(old_sus_vec):
                try:
                    shutil.copy2(old_sus_vec, per_103_vec)
                    os.remove(old_sus_vec)
                    logger.info("Migrated user vector SUS-649.npy -> PER-103.npy (Authorized Personnel)")
                except Exception as e:
                    logger.error(f"Migration error for SUS-649: {e}")

            old_sus_img = UPLOADS_DIR / "SUS-649.jpg"
            per_103_img = UPLOADS_DIR / "PER-103.jpg"
            if old_sus_img.exists() and not per_103_img.exists():
                try:
                    shutil.copy2(str(old_sus_img), str(per_103_img))
                except Exception:
                    pass

            # 2. Personnel Database
            loaded_personnel = {}
            if os.path.exists(PERSONNEL_JSON_PATH):
                try:
                    with open(PERSONNEL_JSON_PATH, "r", encoding="utf-8") as f:
                        loaded_personnel = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to read personnel_db.json: {e}")

            for pid, info in DEFAULT_SEED_PERSONNEL.items():
                if pid not in loaded_personnel:
                    loaded_personnel[pid] = dict(info)

            # Load vectors for personnel
            for pid, info in loaded_personnel.items():
                info["encodings"] = []
                vec_file = os.path.join(VECTORS_DIR, f"{pid}.npy")
                if os.path.exists(vec_file):
                    info["encodings"] = self._read_vector_file(vec_file, pid)

            self.personnel_db = loaded_personnel
            self._save_personnel_to_disk_internal()

            # 3. Suspect Database
            loaded_suspects = {}
            if os.path.exists(SUSPECTS_JSON_PATH):
                try:
                    with open(SUSPECTS_JSON_PATH, "r", encoding="utf-8") as f:
                        loaded_suspects = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to read suspects_db.json: {e}")

            # Clean out any old SUS-649 or PER-* from suspects_db
            loaded_suspects.pop("SUS-649", None)
            for k in list(loaded_suspects.keys()):
                if k.startswith("PER-"):
                    loaded_suspects.pop(k, None)

            for sid, info in DEFAULT_SEED_SUSPECTS.items():
                if sid not in loaded_suspects:
                    loaded_suspects[sid] = dict(info)

            for sid, info in loaded_suspects.items():
                info["encodings"] = []
                vec_file = os.path.join(VECTORS_DIR, f"{sid}.npy")
                if os.path.exists(vec_file):
                    info["encodings"] = self._read_vector_file(vec_file, sid)

            self.suspect_db = loaded_suspects
            self._save_suspects_to_disk_internal()

            # 4. Vehicle Database
            loaded_vehicles = {}
            if os.path.exists(VEHICLES_JSON_PATH):
                try:
                    with open(VEHICLES_JSON_PATH, "r", encoding="utf-8") as f:
                        loaded_vehicles = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to read vehicles_db.json: {e}")

            for vid, info in DEFAULT_SEED_VEHICLES.items():
                if vid not in loaded_vehicles:
                    loaded_vehicles[vid] = dict(info)

            self.vehicle_db = loaded_vehicles
            self._save_vehicles_to_disk_internal()

            logger.info("A.E.G.I.S. Multi-Registry Loaded: Personnel, Suspects, and Vehicles initialized.")

    def _read_vector_file(self, vec_file: str, entity_id: str) -> List[np.ndarray]:
        sanitized = []
        try:
            loaded_vecs = np.load(vec_file, allow_pickle=True)
            if isinstance(loaded_vecs, np.ndarray):
                flat = np.asarray(loaded_vecs, dtype=np.float32).reshape(-1)
                if flat.size % 128 == 0 and flat.size > 0:
                    num_v = flat.size // 128
                    reshaped = flat.reshape(num_v, 128)
                    for i in range(num_v):
                        sanitized.append(reshaped[i:i+1].astype(np.float32))
                elif flat.size == 128:
                    sanitized.append(flat.reshape(1, 128).astype(np.float32))
            if sanitized:
                logger.info(f"      {entity_id}: loaded {len(sanitized)} SFace vector(s) shape (1, 128)")
        except Exception as e:
            logger.error(f"Error loading vector for {entity_id}: {e}")
        return sanitized

    def _save_personnel_to_disk_internal(self):
        clean_json = {}
        for pid, info in self.personnel_db.items():
            item = dict(info)
            item.pop("encodings", None)
            clean_json[pid] = item
        try:
            with open(PERSONNEL_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(clean_json, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write personnel_db.json: {e}")

    def _save_suspects_to_disk_internal(self):
        clean_json = {}
        for sid, info in self.suspect_db.items():
            item = dict(info)
            item.pop("encodings", None)
            clean_json[sid] = item
        try:
            with open(SUSPECTS_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(clean_json, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write suspects_db.json: {e}")

    def _save_vehicles_to_disk_internal(self):
        try:
            with open(VEHICLES_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(self.vehicle_db, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write vehicles_db.json: {e}")

    #        Personnel CRUD                                                                                                                                  

    def add_personnel_with_encoding(
        self,
        personnel_id: str,
        full_name: str,
        rank: str,
        role: str,
        unit: str,
        department: str,
        clearance_level: str,
        image_bytes: bytes,
    ) -> bool:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        bgr_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if bgr_img is None:
            logger.error(f"Could not decode image for personnel {personnel_id}")
            return False

        try:
            (UPLOADS_DIR / f"{personnel_id}.jpg").write_bytes(image_bytes)
        except Exception as e:
            logger.error(f"Could not save personnel image {personnel_id}: {e}")
            return False

        encodings = self.extract_face_vector(bgr_img)
        if encodings:
            vec_file = os.path.join(VECTORS_DIR, f"{personnel_id}.npy")
            clean_arrs = [np.asarray(e, dtype=np.float32).reshape(1, 128) for e in encodings]
            np.save(vec_file, np.concatenate(clean_arrs, axis=0))

        person_info = {
            "id": personnel_id,
            "fullName": full_name,
            "rank": rank,
            "role": role or "officer",
            "threatLevel": "LOW",
            "alias": rank,
            "unit": unit or "Sector Garrison",
            "department": department or "Border Operations",
            "clearanceLevel": clearance_level or "LEVEL 3     OPERATIONAL",
            "status": "AUTHORIZED",
            "watchlisted": False,
            "facialImages": [
                {
                    "id": f"fi-{personnel_id}",
                    "url": f"/uploads/{personnel_id}.jpg",
                    "capturedAt": datetime.utcnow().isoformat(),
                    "droneId": "CAM-01",
                    "confidence": 98,
                    "verified": True,
                }
            ],
            "recognitionConfidence": 98,
            "encodings": encodings,
        }

        with self.lock:
            self.personnel_db[personnel_id] = person_info
            self._save_personnel_to_disk_internal()

        logger.info(f"Registered Authorized Personnel {personnel_id} ({full_name}) with {len(encodings)} vector(s).")
        return len(encodings) > 0

    def get_all_personnel_detail(self) -> List[Dict[str, Any]]:
        with self.lock:
            res = []
            for pid, info in self.personnel_db.items():
                res.append({
                    "id": pid,
                    "fullName": info.get("fullName", "Officer"),
                    "callsign": info.get("alias", "Personnel"),
                    "rank": info.get("rank", "Officer"),
                    "role": info.get("role", "officer"),
                    "clearanceLevel": info.get("clearanceLevel", "LEVEL 3     OPERATIONAL"),
                    "department": info.get("department", "Border Operations"),
                    "unit": info.get("unit", "Sector Unit"),
                    "status": info.get("status", "AUTHORIZED"),
                    "assignedZone": info.get("unit", "Sector Alpha"),
                    "assignedSector": info.get("unit", "Sector Alpha"),
                    "photoUrl": (info.get("facialImages", [{}])[0].get("url") if info.get("facialImages") else f"/uploads/{pid}.jpg"),
                    "lastKnownLocation": "Gate Alpha / Sector HQ",
                    "contactRadio": "FREQ-440.00",
                    "shift": "Standard Duty",
                    "enrolled": len(info.get("encodings", [])) > 0,
                })
            return res

    def delete_personnel(self, personnel_id: str) -> bool:
        with self.lock:
            if personnel_id not in self.personnel_db:
                return False
            del self.personnel_db[personnel_id]
            vec_file = os.path.join(VECTORS_DIR, f"{personnel_id}.npy")
            if os.path.exists(vec_file):
                try:
                    os.remove(vec_file)
                except Exception:
                    pass
            img_file = UPLOADS_DIR / f"{personnel_id}.jpg"
            if img_file.exists():
                try:
                    img_file.unlink()
                except Exception:
                    pass
            self._save_personnel_to_disk_internal()
        logger.info(f"Purged personnel {personnel_id}")
        return True

    #        Suspect CRUD                                                                                                                                        

    def add_suspect_with_encoding(
        self,
        suspect_id: str,
        full_name: str,
        threat_level: str,
        alias: str,
        image_bytes: bytes,
    ) -> bool:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        bgr_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if bgr_img is None:
            logger.error(f"Could not decode image for {suspect_id}")
            return False

        try:
            (UPLOADS_DIR / f"{suspect_id}.jpg").write_bytes(image_bytes)
        except Exception as e:
            logger.error(f"Could not save uploaded image for {suspect_id}: {e}")
            return False

        h, w = bgr_img.shape[:2]
        max_dim = 640
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            bgr_img = cv2.resize(bgr_img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        encodings = self.extract_face_vector(bgr_img)
        if encodings:
            vec_file = os.path.join(VECTORS_DIR, f"{suspect_id}.npy")
            clean_arrs = [np.asarray(e, dtype=np.float32).reshape(1, 128) for e in encodings]
            np.save(vec_file, np.concatenate(clean_arrs, axis=0))

        suspect_info = {
            "id": suspect_id,
            "fullName": full_name,
            "threatLevel": threat_level.upper(),
            "alias": alias,
            "age": 30,
            "gender": "Unknown",
            "nationality": "Indian",
            "status": "active_surveillance",
            "watchlisted": True,
            "facialImages": [
                {
                    "id": f"fi-{suspect_id}",
                    "url": f"/uploads/{suspect_id}.jpg",
                    "capturedAt": datetime.utcnow().isoformat(),
                    "droneId": "CAM-01",
                    "confidence": 95,
                    "verified": True,
                }
            ],
            "recognitionConfidence": 95,
            "physicalDescription": {
                "height": "175 cm",
                "weight": "70 kg",
                "clothing": "Standard Attire",
                "distinguishingFeatures": "Live Enrolled Subject",
            },
            "tracking": {
                "assignedDrones": ["CAM-01"],
                "firstDetection": datetime.utcnow().isoformat(),
                "lastDetection": datetime.utcnow().isoformat(),
                "currentCoordinates": {"lat": 25.3184, "lng": 82.9752},
                "currentSector": "Sector B7",
            },
            "intelligence": {
                "criminalHistory": ["Watchlist Match Registry"],
                "openInvestigations": ["INV-LIVE-001"],
                "associatedIndividuals": [],
                "notes": "Enrolled into Watchlist. Immediate alert on detection.",
            },
            "encodings": encodings,
        }

        with self.lock:
            self.suspect_db[suspect_id] = suspect_info
            self._save_suspects_to_disk_internal()

        logger.info(f"Suspect {suspect_id} ({full_name}) registered with {len(encodings)} vector(s).")
        return len(encodings) > 0

    def get_all_suspects_detail(self) -> List[Dict[str, Any]]:
        with self.lock:
            suspects = []
            for sid, info in self.suspect_db.items():
                aliases = info.get("alias", "")
                if isinstance(aliases, str):
                    alias_list = [a.strip() for a in aliases.split(",") if a.strip()] if aliases else []
                elif isinstance(aliases, list):
                    alias_list = aliases
                else:
                    alias_list = []

                suspects.append({
                    "id": sid,
                    "fullName": info.get("fullName", "Unknown"),
                    "alias": alias_list,
                    "age": info.get("age", 30),
                    "gender": info.get("gender", "Unknown"),
                    "nationality": info.get("nationality", "Indian"),
                    "status": info.get("status", "active_surveillance"),
                    "threatLevel": str(info.get("threatLevel", "medium")).lower(),
                    "watchlisted": info.get("watchlisted", True),
                    "facialImages": info.get("facialImages", [
                        {
                            "id": f"fi-{sid}",
                            "url": f"/uploads/{sid}.jpg",
                            "capturedAt": datetime.utcnow().isoformat(),
                            "droneId": "CAM-01",
                            "confidence": 92,
                            "verified": True,
                        }
                    ]),
                    "recognitionConfidence": info.get("recognitionConfidence", 92),
                    "physicalDescription": info.get("physicalDescription", {
                        "height": "175 cm",
                        "weight": "70 kg",
                        "clothing": "Dark attire",
                        "distinguishingFeatures": "None recorded",
                    }),
                    "tracking": info.get("tracking", {
                        "assignedDrones": ["CAM-01"],
                        "firstDetection": datetime.utcnow().isoformat(),
                        "lastDetection": datetime.utcnow().isoformat(),
                        "currentCoordinates": {"lat": 25.3184, "lng": 82.9752},
                        "currentSector": "Sector B7",
                    }),
                    "intelligence": info.get("intelligence", {
                        "criminalHistory": ["Watchlist Target"],
                        "notes": "Flagged in surveillance registry.",
                    }),
                    "lastUpdated": datetime.utcnow().isoformat(),
                    "enrolled": len(info.get("encodings", [])) > 0,
                })
            return suspects

    def delete_suspect(self, suspect_id: str) -> bool:
        with self.lock:
            if suspect_id not in self.suspect_db:
                return False
            del self.suspect_db[suspect_id]

            vec_file = os.path.join(VECTORS_DIR, f"{suspect_id}.npy")
            if os.path.exists(vec_file):
                try:
                    os.remove(vec_file)
                except Exception:
                    pass

            img_file = UPLOADS_DIR / f"{suspect_id}.jpg"
            if img_file.exists():
                try:
                    img_file.unlink()
                except Exception:
                    pass

            if self._last_matched_target and self._last_matched_target.get("suspect_id") == suspect_id:
                self._last_matched_target = None
                self._target_persist_until = 0.0

            self._save_suspects_to_disk_internal()

        logger.info(f"Suspect {suspect_id} purged.")
        return True

    def reset_suspect_db(self) -> List[Dict[str, Any]]:
        with self.lock:
            for fpath in glob.glob(os.path.join(VECTORS_DIR, "SUS-*.npy")):
                try:
                    os.remove(fpath)
                except Exception:
                    pass

            self.suspect_db = {k: dict(v) for k, v in DEFAULT_SEED_SUSPECTS.items()}
            self._save_suspects_to_disk_internal()

            self._cached_detections = []
            self._last_alert_time.clear()
            self._target_persist_until = 0.0
            self._last_matched_target = None

        logger.info("Suspect database reset to seed state.")
        return self.get_all_suspects_detail()

    #        Vehicle CRUD                                                                                                                                        

    def add_vehicle(
        self,
        vehicle_id: str,
        vehicle_type: str,
        plate_number: str,
        owner: str,
        unit: str,
        status: str,
        make_model: str = "",
        color: str = "",
        image_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        norm_status = status.lower()
        category = "authorized" if norm_status in ["authorized", "active", "cleared"] else "watchlist" if norm_status in ["watchlist", "alert", "blocked"] else "unknown"

        if image_bytes:
            try:
                (UPLOADS_DIR / f"{vehicle_id}.jpg").write_bytes(image_bytes)
            except Exception as e:
                logger.error(f"Error saving vehicle image: {e}")

        v_data = {
            "id": vehicle_id,
            "plate": plate_number,
            "plateNumber": plate_number,
            "vehicleName": make_model or f"{vehicle_type} ({plate_number})",
            "category": category,
            "vehicleType": vehicle_type,
            "vehicleClass": vehicle_type.lower().replace(" ", "_"),
            "makeModel": make_model or f"{vehicle_type} {plate_number}",
            "color": color or "Standard",
            "assignedUnit": unit or "Sector Transport",
            "owner": owner or "Authorized Unit",
            "status": status,
            "confidence": 98.0,
            "speedKmh": 30,
            "lastSeen": "Just now",
            "lastDetected": datetime.utcnow().isoformat(),
            "notes": f"Registered in AEGIS fleet registry as {status}.",
        }

        with self.lock:
            self.vehicle_db[vehicle_id] = v_data
            self._save_vehicles_to_disk_internal()

        logger.info(f"Registered Vehicle {vehicle_id} ({plate_number}) - Status: {status}")
        return v_data

    def get_all_vehicles_detail(self) -> List[Dict[str, Any]]:
        with self.lock:
            return list(self.vehicle_db.values())

    def delete_vehicle(self, vehicle_id: str) -> bool:
        with self.lock:
            if vehicle_id not in self.vehicle_db:
                return False
            del self.vehicle_db[vehicle_id]
            self._save_vehicles_to_disk_internal()
        logger.info(f"Deleted vehicle {vehicle_id}")
        return True

    #        Camera Switching & Status                                                                                                 

    def register_alert_callback(self, cb: Callable[[Dict[str, Any]], Any]):
        self.alert_callbacks.append(cb)

    def switch_camera_source(self, source_id: str) -> Dict[str, Any]:
        s_clean = str(source_id).strip().lower()
        target_item = None
        for k, v in self.camera_sources_catalog.items():
            if k.lower() == s_clean or v["name"].lower() == s_clean or v.get("id", "").lower() == s_clean:
                target_item = v
                break

        if not target_item:
            if s_clean in ["browser", "browser camera", "webcam", "laptop camera", "0", "1", "cam-01", "local", "cctv-1"]:
                target_item = self.camera_sources_catalog.get("Browser Camera") or {
                    "id": "Browser Camera",
                    "name": "Browser Camera",
                    "type": "browser",
                    "source": "browser",
                    "description": "Live Browser WebRTC / MediaStream Client Feed",
                }
            elif "http" in s_clean or "rtsp" in s_clean or "network" in s_clean:
                stream_url = source_id if ("http" in s_clean or "rtsp" in s_clean) else os.getenv("CAM_MB_URL", "")
                target_item = {
                    "id": "Cam MB",
                    "name": "Cam MB",
                    "type": "network",
                    "source": stream_url,
                    "description": "Tactical Remote RTSP/HTTP Stream",
                }
            else:
                target_item = self.camera_sources_catalog.get("Browser Camera") or {
                    "id": "Browser Camera",
                    "name": "Browser Camera",
                    "type": "browser",
                    "source": "browser",
                    "description": "Live Browser WebRTC / MediaStream Client Feed",
                }

        logger.info(
            f"     [SWITCH REQUEST] {self.active_source_id} -> {target_item['name']} "
            f"(source={target_item['source']}, type={target_item['type']})"
        )
        with self.lock:
            self._target_camera_source = target_item["source"]
            self._target_source_id = target_item["name"]
            self.connection_status = "ready" if target_item["type"] == "browser" else "connecting"
            self._switch_requested = True

        return {
            "success": True,
            "activeSource": target_item["name"],
            "status": self.connection_status,
            "source": str(target_item["source"]),
        }

    def get_camera_sources(self) -> List[Dict[str, Any]]:
        sources = []
        for k, v in self.camera_sources_catalog.items():
            is_active = (v["name"] == self.active_source_id)
            sources.append({
                "id": v["name"],
                "name": v["name"],
                "type": v["type"],
                "source": str(v["source"]),
                "description": v["description"],
                "active": is_active,
                "status": self.connection_status if is_active else "idle",
            })
        return sources

    def get_camera_status(self) -> Dict[str, Any]:
        return {
            "activeSource": self.active_source_id,
            "status": self.connection_status,
            "source": str(self.camera_source),
        }

    #        Biometric Feature Extraction                                                                                        

    def extract_face_vector(self, bgr_img: np.ndarray) -> List[np.ndarray]:
        vectors: List[np.ndarray] = []
        ih, iw = bgr_img.shape[:2]
        resized_img = bgr_img

        if HAS_SFACE and _sface_recognizer is not None:
            if os.path.exists(YUNET_MODEL_PATH) and hasattr(cv2, "FaceDetectorYN"):
                try:
                    upload_yunet = cv2.FaceDetectorYN.create(
                        YUNET_MODEL_PATH, "", (iw, ih), score_threshold=0.5
                    )
                    _, detected_faces = upload_yunet.detect(resized_img)
                    if detected_faces is not None and len(detected_faces) > 0:
                        face = detected_faces[0]
                        with _yunet_lock:
                            aligned = _sface_recognizer.alignCrop(resized_img, face)
                            feat = _sface_recognizer.feature(aligned)
                        vectors.append(feat)
                        logger.info("Face vector extracted via YuNet + SFace landmark alignment.")
                        return vectors
                except Exception as e:
                    logger.warning(f"Upload YuNet detect failed: {e}")

            if _global_face_cascade is not None:
                try:
                    gray = cv2.cvtColor(resized_img, cv2.COLOR_BGR2GRAY)
                    haar_boxes = _global_face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
                    if hasattr(haar_boxes, "__iter__") and len(haar_boxes) > 0:
                        x, y, w, h = haar_boxes[0]
                        crop = resized_img[y:y+h, x:x+w]
                        crop_resized = cv2.resize(crop, (112, 112))
                        with _yunet_lock:
                            feat = _sface_recognizer.feature(crop_resized)
                        vectors.append(feat)
                        logger.info("Face vector extracted via Haar crop + SFace.")
                        return vectors
                except Exception as e:
                    logger.warning(f"Haar+SFace fallback failed: {e}")

            try:
                side = min(resized_img.shape[:2])
                y0 = (resized_img.shape[0] - side) // 2
                x0 = (resized_img.shape[1] - side) // 2
                center_crop = resized_img[y0:y0 + side, x0:x0 + side]
                center_crop = cv2.resize(center_crop, (112, 112), interpolation=cv2.INTER_AREA)
                with _yunet_lock:
                    feat = _sface_recognizer.feature(center_crop)
                vectors.append(feat)
                logger.info("Face vector extracted via direct SFace resize.")
            except Exception as e:
                logger.warning(f"Direct SFace failed: {e}")
            return vectors

        if HAS_FACE_RECOGNITION:
            rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
            locs = face_recognition.face_locations(rgb_img, model="hog")
            if not locs:
                locs = face_recognition.face_locations(rgb_img, number_of_times_to_upsample=1, model="hog")
            if locs:
                encs = face_recognition.face_encodings(rgb_img, locs)
                if encs:
                    vectors.append(encs[0])
                    return vectors

        return vectors

    #        Camera Open Dispatcher                                                                                                          

    def _open_local_camera(self, source: int) -> Optional[cv2.VideoCapture]:
        candidates = [source]
        for alt in [0, 1]:
            if alt not in candidates:
                candidates.append(alt)

        for dev_idx in candidates:
            cap = None
            if os.name == "nt":
                try:
                    cap = cv2.VideoCapture(dev_idx, cv2.CAP_DSHOW)
                except Exception:
                    pass
                if cap is None or not cap.isOpened():
                    if cap is not None:
                        cap.release()
                    try:
                        cap = cv2.VideoCapture(dev_idx, cv2.CAP_MSMF)
                    except Exception:
                        pass
            if cap is None or not cap.isOpened():
                if cap is not None:
                    cap.release()
                try:
                    cap = cv2.VideoCapture(dev_idx)
                except Exception:
                    pass

            if cap is not None and cap.isOpened():
                ret, test_frame = cap.read()
                if ret and test_frame is not None:
                    try:
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                        cap.set(cv2.CAP_PROP_FPS, 30)
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    except Exception:
                        pass
                    logger.info(f"Local camera device {dev_idx} opened successfully.")
                    return cap
                else:
                    cap.release()
                    cap = None

        logger.warning(f"Could not open local camera from candidates: {candidates}")
        return None

    def _open_network_camera_with_abort(self, source: str, timeout_sec: float = 10.0) -> Optional[cv2.VideoCapture]:
        import threading as _threading
        result_box: list = [None]
        done_event = _threading.Event()

        def _worker():
            try:
                cap = cv2.VideoCapture(source)
                if not cap.isOpened():
                    cap.release()
                    cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
                result_box[0] = cap
            except Exception as exc:
                logger.error(f"Network open exception: {exc}")
            finally:
                done_event.set()

        t = _threading.Thread(target=_worker, daemon=True, name="aegis-net-open")
        t.start()

        deadline = time.time() + timeout_sec
        while not done_event.is_set():
            with self.lock:
                if self._switch_requested:
                    logger.warning(f"Network open aborted due to switch request: {source}")
                    return None
            if time.time() > deadline:
                logger.warning(f"Network open timed out: {source}")
                return None
            done_event.wait(timeout=0.1)

        cap = result_box[0]
        if cap is not None and cap.isOpened():
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            logger.info(f"Network stream opened: {source}")
            return cap
        return None

    def _open_camera(self, source=None) -> Optional[cv2.VideoCapture]:
        if source is None:
            source = self.camera_source
        if isinstance(source, str) and source.lower() in ("browser", "client", "cloud", "webrtc", "none", "virtual"):
            return None
        if isinstance(source, int) or str(source).isdigit():
            # In cloud / headless container, local hardware cameras are disabled
            if os.getenv("PORT") or os.getenv("RAILWAY_ENVIRONMENT") or os.name != "nt":
                logger.info("Headless/cloud environment: skipping hardware webcam capture.")
                return None
            return self._open_local_camera(int(source))
        else:
            if not str(source).startswith(("http://", "https://", "rtsp://")):
                return None
            return self._open_network_camera_with_abort(source, timeout_sec=10.0)

    #        Fast 30-FPS Video Capture Loop                                                                                  

    def _capture_loop(self):
        cap: Optional[cv2.VideoCapture] = None
        frame_idx = 0
        prev_source_was_network = False

        while True:
            do_switch = False
            new_source = None
            new_source_id = None
            with self.lock:
                if self._switch_requested:
                    do_switch = True
                    new_source = self._target_camera_source
                    new_source_id = self._target_source_id
                    self._switch_requested = False

            if do_switch:
                logger.info(f"     Switching camera: {self.active_source_id} -> {new_source_id}")
                if cap is not None:
                    try:
                        cap.release()
                    except Exception:
                        pass
                    cap = None

                settle_time = 0.8 if (isinstance(new_source, int) and prev_source_was_network) else 0.2
                time.sleep(settle_time)

                self.camera_source = new_source
                self.active_source_id = new_source_id
                prev_source_was_network = not isinstance(new_source, int)

            # In Browser / WebRTC mode, frames are supplied directly via POST /api/analyze-frame
            if isinstance(self.camera_source, str) and self.camera_source.lower() in ("browser", "client", "cloud", "webrtc", "none", "virtual"):
                if cap is not None:
                    try:
                        cap.release()
                    except Exception:
                        pass
                    cap = None
                with self.lock:
                    if self._annotated_frame is None:
                        self._annotated_frame = self._generate_standby_frame()
                time.sleep(0.040)
                continue

            if cap is None or not cap.isOpened():
                self.connection_status = "connecting"
                with self.lock:
                    self._annotated_frame = self._generate_standby_frame()

                cap = self._open_camera(self.camera_source)
                if cap is None or not cap.isOpened():
                    self.connection_status = "disconnected"
                    time.sleep(1.0)
                    continue
                else:
                    self.connection_status = "connected"
                    # Warmup
                    for _ in range(3):
                        cap.read()
                        time.sleep(0.02)

            success, frame = cap.read()
            if not success or frame is None:
                _retry_ok = False
                for _ in range(4):
                    time.sleep(0.04)
                    success, frame = cap.read()
                    if success and frame is not None:
                        _retry_ok = True
                        break
                if not _retry_ok:
                    self.connection_status = "disconnected"
                    if cap is not None:
                        try:
                            cap.release()
                        except Exception:
                            pass
                    cap = None
                    time.sleep(0.3)
                    continue

            frame_idx += 1

            if not self._ai_busy and frame_idx % 2 == 0:
                with self.lock:
                    self._latest_raw_frame = frame.copy()

            with self.lock:
                detections = list(self._cached_detections)

            annotated = self._draw_tactical_overlays(frame, detections)

            with self.lock:
                self._annotated_frame = annotated

            time.sleep(0.030)

    #        Dedicated Async AI Inference Loop                                                                         

    def _ai_worker_loop(self):
        while True:
            raw_frame = None
            with self.lock:
                if self._latest_raw_frame is not None:
                    raw_frame = self._latest_raw_frame
                    self._latest_raw_frame = None
                    self._ai_busy = True

            if raw_frame is None:
                time.sleep(0.015)
                continue

            try:
                new_detections = self._run_ai_inference(raw_frame)
                with self.lock:
                    self._cached_detections = new_detections
            except Exception as e:
                logger.error(f"AI Worker error: {e}", exc_info=True)
            finally:
                with self.lock:
                    self._ai_busy = False

            time.sleep(0.02)

    #        AI Inference Engine: Faces & Vehicles                                                             

    def _run_ai_inference(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        orig_h, orig_w = frame.shape[:2]

        # --- RESOLUTION PIPELINE ---
        # Run YuNet on 720px-wide inference frame (was 360px).
        # Why: At 360px, inter-eye pixel distance on a 30° tilted face is ~10-15px,
        # making landmark precision too poor for reliable alignCrop.
        # At 720px, inter-eye is ~20-30px — enough for accurate geometric alignment.
        # Performance: 720p YuNet is still very fast (~15-25ms on CPU).
        target_w = 720
        scale = target_w / float(orig_w)
        target_h = int(orig_h * scale)
        inference_frame = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_AREA)

        inv_scale = 1.0 / scale
        detections: List[Dict[str, Any]] = []

        # Log pipeline resolution once every 150 frames (~5 sec)
        self._face_debug_log_counter = getattr(self, '_face_debug_log_counter', 0) + 1
        should_log = (self._face_debug_log_counter % 150 == 1)
        if should_log:
            logger.info(
                f"[FACE PIPELINE] Original: {orig_w}x{orig_h} | "
                f"YuNet input: {target_w}x{target_h} | "
                f"scale={scale:.4f} inv_scale={inv_scale:.4f}"
            )

        face_boxes: List[Tuple[int, int, int, int]] = []
        face_crops: List[Optional[np.ndarray]] = []

        #        Step 1: Detect Faces (YuNet + Haar)       
        if _yunet_detector is not None:
            try:
                with _yunet_lock:
                    _yunet_detector.setInputSize((target_w, target_h))
                    _, yunet_faces = _yunet_detector.detect(inference_frame)
                if yunet_faces is not None and len(yunet_faces) > 0:
                    for f in yunet_faces:
                        sx, sy, sw, sh = int(f[0]), int(f[1]), int(f[2]), int(f[3])
                        ox = int(sx * inv_scale)
                        oy = int(sy * inv_scale)
                        ow = int(sw * inv_scale)
                        oh = int(sh * inv_scale)

                        ox, oy = max(0, ox), max(0, oy)
                        ow, oh = min(ow, orig_w - ox), min(oh, orig_h - oy)

                        # Enforce minimum face size to reject noise/texture detections
                        if ow >= 35 and oh >= 35:
                            # --- Scale YuNet detection back to full-resolution coordinate space ---
                            # YuNet face row: f[0..3]=bbox(x,y,w,h), f[4..13]=5 landmarks(x,y pairs),
                            # f[14]=confidence score.
                            # We scale all spatial values by inv_scale to get full-res coordinates.
                            face_row_fullres = f.copy().astype(np.float32)
                            face_row_fullres[0] = f[0] * inv_scale  # x
                            face_row_fullres[1] = f[1] * inv_scale  # y
                            face_row_fullres[2] = f[2] * inv_scale  # w
                            face_row_fullres[3] = f[3] * inv_scale  # h
                            for li in range(4, 14):                  # 5 landmarks = 10 values
                                face_row_fullres[li] = f[li] * inv_scale

                            # Inter-eye distance quality check on full-resolution coordinates.
                            # left_eye=(f[4],f[5]), right_eye=(f[6],f[7]) after landmark scaling.
                            lx, ly = face_row_fullres[4], face_row_fullres[5]
                            rx, ry = face_row_fullres[6], face_row_fullres[7]
                            eye_dx = rx - lx
                            eye_dy = ry - ly
                            inter_eye = math.sqrt(eye_dx**2 + eye_dy**2)
                            tilt_angle = math.degrees(math.atan2(eye_dy, eye_dx))

                            if should_log:
                                logger.info(
                                    f"[FACE DEBUG] Face at ({ox},{oy}) size={ow}x{oh} | "
                                    f"inter_eye_px={inter_eye:.1f} | tilt={tilt_angle:.1f}° | "
                                    f"detection_score={float(f[14]):.3f}"
                                )

                            crop = None
                            crop_method = "none"

                            # Primary: SFace alignCrop on FULL-RES frame with full-res landmarks.
                            # This exactly mirrors the enrollment path (extract_face_vector).
                            # Requires inter_eye >= 8px on full-res (was 12 — relaxed for tilt).
                            if HAS_SFACE and _sface_recognizer is not None and inter_eye >= 8.0:
                                try:
                                    with _yunet_lock:
                                        crop = _sface_recognizer.alignCrop(frame, face_row_fullres)
                                    if crop is not None and getattr(crop, 'size', 0) > 0:
                                        crop_method = "alignCrop_fullres"
                                    else:
                                        crop = None
                                except Exception:
                                    crop = None

                            # Fallback 1: geometric tilt correction via affine rotation.
                            # Rotate full frame by the measured inter-eye angle so face becomes upright.
                            if (crop is None) and inter_eye >= 6.0:
                                try:
                                    angle = tilt_angle
                                    cx = ox + ow / 2.0
                                    cy = oy + oh / 2.0
                                    M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
                                    rotated = cv2.warpAffine(frame, M, (orig_w, orig_h), flags=cv2.INTER_LINEAR)
                                    rot_crop = rotated[oy:oy+oh, ox:ox+ow]
                                    if rot_crop.size > 0:
                                        crop = cv2.resize(rot_crop, (112, 112), interpolation=cv2.INTER_AREA)
                                        crop_method = "affine_tilt_correction"
                                        # Also attempt alignCrop on the rotation-corrected inference_frame slice
                                        if HAS_SFACE and _sface_recognizer is not None:
                                            try:
                                                # Build a synthetic zero-tilt face row from the rotated detection
                                                syn_row = face_row_fullres.copy()
                                                syn_row[4] = lx  # left_eye x
                                                syn_row[5] = ry  # left_eye y (use right_eye y = same after rotation)
                                                syn_row[6] = rx  # right_eye x
                                                syn_row[7] = ry  # right_eye y
                                                syn_crop = _sface_recognizer.alignCrop(rotated, syn_row)
                                                if syn_crop is not None and getattr(syn_crop, 'size', 0) > 0:
                                                    crop = syn_crop
                                                    crop_method = "alignCrop_rotated"
                                            except Exception:
                                                pass  # keep affine crop
                                except Exception:
                                    crop = None

                            # Fallback 2: plain bbox crop (no tilt correction).
                            # Least accurate for tilted faces but keeps pipeline alive.
                            if crop is None:
                                raw_crop = frame[oy:oy+oh, ox:ox+ow]
                                if raw_crop.size > 0:
                                    crop = cv2.resize(raw_crop, (112, 112), interpolation=cv2.INTER_AREA)
                                    crop_method = "plain_bbox"

                            if should_log:
                                crop_shape = crop.shape if crop is not None else None
                                logger.info(
                                    f"[FACE DEBUG] Crop method: {crop_method} | "
                                    f"crop_shape={crop_shape}"
                                )

                            face_boxes.append((ox, oy, ow, oh))
                            face_crops.append(crop)
            except Exception as e:
                logger.warning(f"YuNet inference error: {e}")

        # Fallback to Haar Cascade if no faces found
        if not face_boxes and _global_face_cascade is not None:
            try:
                gray_inference = cv2.cvtColor(inference_frame, cv2.COLOR_BGR2GRAY)
                # Tight Haar settings to avoid false positives on background objects
                haar_boxes = _global_face_cascade.detectMultiScale(
                    gray_inference, scaleFactor=1.1, minNeighbors=6, minSize=(50, 50)
                )
                if hasattr(haar_boxes, "__iter__"):
                    for (sx, sy, sw, sh) in haar_boxes:
                        ox = int(sx * inv_scale)
                        oy = int(sy * inv_scale)
                        ow = int(sw * inv_scale)
                        oh = int(sh * inv_scale)
                        ox, oy = max(0, ox), max(0, oy)
                        ow, oh = min(ow, orig_w - ox), min(oh, orig_h - oy)
                        # Face aspect ratio guard: reject obviously non-face detections
                        if ow >= 35 and oh >= 35 and 0.65 <= (ow / float(oh)) <= 1.4:
                            face_boxes.append((ox, oy, ow, oh))
                            raw_crop = frame[oy:oy+oh, ox:ox+ow]
                            crop = cv2.resize(raw_crop, (112, 112), interpolation=cv2.INTER_AREA) if raw_crop.size > 0 else None
                            face_crops.append(crop)
            except Exception as e:
                logger.warning(f"Haar fallback error: {e}")

        #        Step 2: Extract SFace Embedding & Dual Matching       
        for face_idx, ((x, y, w, h), crop) in enumerate(zip(face_boxes, face_crops)):
            live_vector = None
            if HAS_SFACE and _sface_recognizer is not None and crop is not None and getattr(crop, "size", 0) > 0:
                try:
                    with _yunet_lock:
                        live_vector = _sface_recognizer.feature(crop)
                except Exception:
                    pass
            elif HAS_FACE_RECOGNITION and crop is not None:
                try:
                    rgb_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                    locs = face_recognition.face_locations(rgb_crop, model="hog")
                    if locs:
                        encs = face_recognition.face_encodings(rgb_crop, locs)
                        if encs:
                            live_vector = encs[0]
                except Exception:
                    pass

            category, entity_id, confidence, info = self._match_identity(live_vector)

            if should_log:
                logger.info(
                    f"[FACE DEBUG] Face[{face_idx}] match: category={category} "
                    f"entity={entity_id} confidence={confidence:.3f} "
                    f"vector_dim={getattr(live_vector, 'shape', None)}"
                )

            # Temporal smoothing buffer for single-face surveillance stream
            if len(face_boxes) == 1:
                self._recog_buffer.append((category, entity_id, confidence, info))
                if len(self._recog_buffer) > self._recog_buffer_maxlen:
                    self._recog_buffer.pop(0)

                # If current frame dipped to UNKNOWN, verify if recent window has established match
                if category == "UNKNOWN" and len(self._recog_buffer) >= 2:
                    recent_cats = [r[0] for r in self._recog_buffer]
                    cat_counts = Counter(recent_cats)
                    for candidate_cat in ["WATCHLIST", "AUTHORIZED"]:
                        if cat_counts.get(candidate_cat, 0) >= 2:
                            matching_items = [r for r in self._recog_buffer if r[0] == candidate_cat]
                            best_item = max(matching_items, key=lambda it: it[2])
                            category = candidate_cat
                            entity_id = best_item[1]
                            confidence = float(best_item[2] * 0.96)
                            info = best_item[3]
                            break

            if category == "AUTHORIZED":
                #        Class 1: AUTHORIZED PERSONNEL (Blue Box)       
                target_det = {
                    "box": (x, y, w, h),
                    "type": "person",
                    "classification": "authorized",
                    "is_target": False,
                    "person_id": entity_id,
                    "name": info.get("fullName", "Authorized Personnel"),
                    "rank": info.get("rank", "Officer"),
                    "confidence": confidence,
                }
                detections.append(target_det)
                self._target_persist_until = time.time() + 0.8
                self._last_matched_target = target_det

            elif category == "WATCHLIST":
                #        Class 2: WATCHLIST MATCH (Red Box)       
                target_det = {
                    "box": (x, y, w, h),
                    "type": "person",
                    "classification": "watchlist",
                    "is_target": True,
                    "suspect_id": entity_id,
                    "name": info.get("fullName", "Suspect"),
                    "threat": info.get("threatLevel", "CRITICAL").upper(),
                    "confidence": confidence,
                }
                detections.append(target_det)
                self._target_persist_until = time.time() + 1.0
                self._last_matched_target = target_det
                self._trigger_match_alert(entity_id, confidence, info)

            else:
                #        Class 3: UNKNOWN PERSON (Orange Box)       
                unknown_det = {
                    "box": (x, y, w, h),
                    "type": "person",
                    "classification": "unknown",
                    "is_target": False,
                    "suspect_id": None,
                    "name": "UNKNOWN PERSON",
                    "threat": "UNREGISTERED",
                    "confidence": 0.0,
                }
                detections.append(unknown_det)
                self._trigger_unknown_alert("person")

        # Clean reset buffer if no faces present in current frame
        if not face_boxes:
            self._recog_buffer.clear()

        # NOTE: Canny-contour vehicle detection is intentionally disabled.
        # It produced massive false positives on indoor objects: shelves, monitors,
        # desks, curtains, and background clutter. Vehicle detection is reserved
        # for dedicated outdoor perimeter cameras with proper vehicle classifiers.
        # Only face-based person detection runs on this general indoor/webcam feed.

        # Return only confirmed face detections — no ghost persistence.
        # Stale target re-injection is removed: if no face is in the current frame,
        # return [] immediately so no boxes linger after a person leaves.
        return detections

    def _match_identity(
        self, live_vector: Optional[np.ndarray]
    ) -> Tuple[str, Optional[str], float, Dict[str, Any]]:
        """
        Simultaneous dual comparison:
        1. Compares against Personnel DB first -> If match: "AUTHORIZED" (Blue Box)
        2. Compares against Watchlist DB second -> If match: "WATCHLIST" (Red Box)
        3. If no match -> "UNKNOWN" (Orange Box)
        """
        if live_vector is None:
            return "UNKNOWN", None, 0.0, {}

        try:
            live_flat = np.asarray(live_vector, dtype=np.float32).reshape(-1)
            if live_flat.size != 128:
                return "UNKNOWN", None, 0.0, {}
            norm_live = float(np.linalg.norm(live_flat))
            if norm_live <= 0:
                return "UNKNOWN", None, 0.0, {}
            live_sf = live_flat.reshape(1, 128)
        except Exception:
            return "UNKNOWN", None, 0.0, {}

        #        1. Check Personnel DB First (Authorized Clearance)       
        with self.lock:
            personnel_copy = {k: dict(v) for k, v in self.personnel_db.items()}

        best_p_id = None
        best_p_score = -1.0

        for pid, info in personnel_copy.items():
            known_encs = info.get("encodings", [])
            for known_vec in known_encs:
                try:
                    k_flat = np.asarray(known_vec, dtype=np.float32).reshape(-1)
                    if k_flat.size != 128:
                        continue
                    norm_k = float(np.linalg.norm(k_flat))
                    if norm_k <= 0:
                        continue
                    score = float(np.dot(k_flat, live_flat) / (norm_k * norm_live))
                    if HAS_SFACE and _sface_recognizer is not None:
                        try:
                            k_sf = k_flat.reshape(1, 128)
                            with _yunet_lock:
                                sf_score = float(_sface_recognizer.match(k_sf, live_sf, cv2.FaceRecognizerSF_FR_COSINE))
                            score = max(score, sf_score)
                        except Exception:
                            pass
                    if score > best_p_score:
                        best_p_score = score
                        best_p_id = pid
                except Exception:
                    pass

        if best_p_id is not None and best_p_score >= self.sface_cosine_threshold:
            norm_conf = 0.85 + ((best_p_score - self.sface_cosine_threshold) / max(0.01, 0.70 - self.sface_cosine_threshold)) * 0.14
            confidence = float(np.clip(norm_conf, 0.85, 0.99))
            return "AUTHORIZED", best_p_id, confidence, personnel_copy[best_p_id]

        #        2. Check Watchlist DB Second (Suspect Match)       
        with self.lock:
            suspects_copy = {k: dict(v) for k, v in self.suspect_db.items()}

        best_s_id = None
        best_s_score = -1.0

        for sid, info in suspects_copy.items():
            known_encs = info.get("encodings", [])
            for known_vec in known_encs:
                try:
                    k_flat = np.asarray(known_vec, dtype=np.float32).reshape(-1)
                    if k_flat.size != 128:
                        continue
                    norm_k = float(np.linalg.norm(k_flat))
                    if norm_k <= 0:
                        continue
                    score = float(np.dot(k_flat, live_flat) / (norm_k * norm_live))
                    if HAS_SFACE and _sface_recognizer is not None:
                        try:
                            k_sf = k_flat.reshape(1, 128)
                            with _yunet_lock:
                                sf_score = float(_sface_recognizer.match(k_sf, live_sf, cv2.FaceRecognizerSF_FR_COSINE))
                            score = max(score, sf_score)
                        except Exception:
                            pass
                    if score > best_s_score:
                        best_s_score = score
                        best_s_id = sid
                except Exception:
                    pass

        if best_s_id is not None and best_s_score >= self.sface_cosine_threshold:
            norm_conf = 0.82 + ((best_s_score - self.sface_cosine_threshold) / max(0.01, 0.70 - self.sface_cosine_threshold)) * 0.17
            confidence = float(np.clip(norm_conf, 0.82, 0.99))
            return "WATCHLIST", best_s_id, confidence, suspects_copy[best_s_id]

        return "UNKNOWN", None, 0.0, {}

    def _match_vehicle(self, vw: int, vh: int, aspect: float) -> Dict[str, Any]:
        """Classifies detected vehicle as Authorized (Blue), Watchlist (Red), or Unknown (Orange)."""
        with self.lock:
            vehicles = list(self.vehicle_db.values())

        # Select matching vehicle profile or default
        matched = None
        for v in vehicles:
            if aspect > 1.8 and v.get("vehicleType") in ["Truck", "Military Vehicle"]:
                matched = v
                break
            elif 1.2 <= aspect <= 1.8 and v.get("vehicleType") in ["Car", "SUV", "Jeep"]:
                matched = v
                break
            elif aspect < 1.1 and v.get("vehicleType") in ["Motorcycle"]:
                matched = v
                break

        if not matched and vehicles:
            matched = vehicles[0]

        if matched:
            cat = matched.get("category", "authorized")
            status = matched.get("status", "authorized").lower()
            if cat == "authorized" or status in ["authorized", "active", "cleared"]:
                return {
                    "box": (30, 200, vw, vh),
                    "type": "vehicle",
                    "classification": "authorized_vehicle",
                    "vehicle_id": matched.get("id"),
                    "plate": matched.get("plate", "IND-ARMY-0824"),
                    "model": matched.get("vehicleName", "Patrol Vehicle"),
                    "owner": matched.get("assignedUnit", "Border Patrol"),
                    "confidence": matched.get("confidence", 98.0) / 100.0,
                }
            elif cat == "watchlist" or status in ["watchlist", "alert", "blocked"]:
                return {
                    "box": (30, 200, vw, vh),
                    "type": "vehicle",
                    "classification": "watchlist_vehicle",
                    "vehicle_id": matched.get("id"),
                    "plate": matched.get("plate", "DL-04-BB-0911"),
                    "model": matched.get("vehicleName", "Watchlist Vehicle"),
                    "threat": matched.get("threatLevel", "CRITICAL"),
                    "confidence": matched.get("confidence", 96.0) / 100.0,
                }

        return {
            "box": (30, 200, vw, vh),
            "type": "vehicle",
            "classification": "unknown_vehicle",
            "plate": "UNREGISTERED",
            "model": "Unknown Vehicle Class",
            "confidence": 0.70,
        }

    #        Alert Dispatch                                                                                                                                  

    def _trigger_match_alert(
        self, suspect_id: str, confidence: float, info: Dict[str, Any]
    ):
        now = time.time()
        if (now - self._last_alert_time.get(suspect_id, 0)) < self.alert_cooldown_sec:
            return

        self._last_alert_time[suspect_id] = now
        payload = {
            "event": "TARGET_MATCH",
            "type": "TARGET_MATCH",
            "suspectId": suspect_id,
            "fullName": info.get("fullName", "Suspect"),
            "threatLevel": info.get("threatLevel", "CRITICAL"),
            "confidence": round(confidence, 3),
            "timestamp": datetime.utcnow().isoformat(),
            "droneId": self.active_source_id or "CAM-01",
            "sector": "Sector B7 Perimeter",
        }
        logger.warning(f"     WATCHLIST MATCH: {suspect_id} ({info.get('fullName')}) - Confidence: {confidence*100:.1f}%")
        for cb in self.alert_callbacks:
            try:
                cb(payload)
            except Exception as exc:
                logger.error(f"Alert callback error: {exc}")

    def _trigger_vehicle_alert(self, v_info: Dict[str, Any]):
        vid = v_info.get("vehicle_id", "VEH-ALERT")
        now = time.time()
        if (now - self._last_alert_time.get(vid, 0)) < self.alert_cooldown_sec:
            return

        self._last_alert_time[vid] = now
        payload = {
            "event": "VEHICLE_WATCHLIST_MATCH",
            "type": "VEHICLE_WATCHLIST_MATCH",
            "vehicleId": vid,
            "plate": v_info.get("plate", "UNKNOWN"),
            "model": v_info.get("model", "Flagged Vehicle"),
            "threatLevel": v_info.get("threat", "CRITICAL"),
            "confidence": round(v_info.get("confidence", 0.95), 3),
            "timestamp": datetime.utcnow().isoformat(),
            "droneId": self.active_source_id or "CAM-01",
            "sector": "Sector B7 Perimeter",
        }
        logger.warning(f"     WATCHLIST VEHICLE DETECTED: {vid} [{v_info.get('plate')}]")
        for cb in self.alert_callbacks:
            try:
                cb(payload)
            except Exception as exc:
                logger.error(f"Vehicle alert callback error: {exc}")

    def _trigger_unknown_alert(self, entity_type: str = "person"):
        now = time.time()
        key = f"UNKNOWN_{entity_type.upper()}"
        if (now - self._last_alert_time.get(key, 0)) < 6.0:
            return

        self._last_alert_time[key] = now
        payload = {
            "event": "UNKNOWN_DETECTION",
            "type": "UNKNOWN_DETECTION",
            "title": f"UNIDENTIFIED {entity_type.upper()} DETECTED",
            "description": f"Unregistered {entity_type} detected in surveillance feed",
            "severity": "MEDIUM",
            "alertStatus": "MEDIUM",
            "timestamp": datetime.utcnow().isoformat(),
            "droneId": self.active_source_id or "CAM-01",
            "sector": "Sector B7 Perimeter",
        }
        logger.info(f"       UNKNOWN {entity_type.upper()} DETECTED: Dispatched notification")
        for cb in self.alert_callbacks:
            try:
                cb(payload)
            except Exception as exc:
                logger.error(f"Unknown alert callback error: {exc}")

    #        Tactical Overlay Rendering (Clean, No Clutter)                                  

    def _draw_tactical_overlays(
        self, frame: np.ndarray, detections: List[Dict[str, Any]]
    ) -> np.ndarray:
        h, w = frame.shape[:2]

        for det in detections:
            x, y, bw, bh = det["box"]
            cls = det.get("classification")

            if cls == "watchlist":
                #        1. RED BOX: WATCHLIST SUSPECT (TARGET MATCH)       
                color = (30, 30, 245)     # Bright BGR Red (#f43f5e)
                cl = min(28, int(bw * 0.28))
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2, cv2.LINE_AA)
                corners = [
                    ((x, y), (x + cl, y)), ((x, y), (x, y + cl)),
                    ((x + bw, y), (x + bw - cl, y)), ((x + bw, y), (x + bw, y + cl)),
                    ((x, y + bh), (x + cl, y + bh)), ((x, y + bh), (x, y + bh - cl)),
                    ((x + bw, y + bh), (x + bw - cl, y + bh)), ((x + bw, y + bh), (x + bw, y + bh - cl)),
                ]
                for p1, p2 in corners:
                    cv2.line(frame, p1, p2, color, 3, cv2.LINE_AA)

                badge = "TARGET MATCH"
                sub1 = f"{det.get('suspect_id', 'SUS-127')}    {det.get('name', 'Suspect')}"
                sub2 = f"Confidence: {det.get('confidence', 0.95)*100:.1f}%"
                badge_w = max(260, bw)
                badge_y = max(0, y - 48)

                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), (12, 10, 22), -1)
                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), color, 1)
                cv2.putText(frame, badge, (x + 6, max(14, y - 30)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.44, (30, 50, 255), 1, cv2.LINE_AA)
                cv2.putText(frame, f"{sub1} ({sub2})", (x + 6, max(28, y - 10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, (230, 230, 230), 1, cv2.LINE_AA)

            elif cls == "authorized":
                #        2. BLUE BOX: AUTHORIZED PERSONNEL       
                color = (243, 218, 0)     # Bright BGR Cyan/Blue (#00daf3)
                cl = min(24, int(bw * 0.25))
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2, cv2.LINE_AA)
                corners = [
                    ((x, y), (x + cl, y)), ((x, y), (x, y + cl)),
                    ((x + bw, y), (x + bw - cl, y)), ((x + bw, y), (x + bw, y + cl)),
                    ((x, y + bh), (x + cl, y + bh)), ((x, y + bh), (x, y + bh - cl)),
                    ((x + bw, y + bh), (x + bw - cl, y + bh)), ((x + bw, y + bh), (x + bw, y + bh - cl)),
                ]
                for p1, p2 in corners:
                    cv2.line(frame, p1, p2, color, 3, cv2.LINE_AA)

                badge = "AUTHORIZED PERSONNEL"
                sub1 = f"{det.get('person_id', 'PER-101')}    {det.get('name', 'Personnel')}"
                sub2 = f"Confidence: {det.get('confidence', 0.96)*100:.1f}%"
                badge_w = max(260, bw)
                badge_y = max(0, y - 48)

                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), (10, 16, 20), -1)
                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), color, 1)
                cv2.putText(frame, badge, (x + 6, max(14, y - 30)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.44, color, 1, cv2.LINE_AA)
                cv2.putText(frame, f"{sub1} ({sub2})", (x + 6, max(28, y - 10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, (220, 240, 255), 1, cv2.LINE_AA)

            elif cls == "authorized_vehicle":
                #        3. BLUE BOX: AUTHORIZED VEHICLE       
                color = (243, 218, 0)     # Bright BGR Cyan/Blue (#00daf3)
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2, cv2.LINE_AA)
                badge = "AUTHORIZED VEHICLE"
                sub1 = f"{det.get('plate', 'IND-ARMY')}    {det.get('model', 'Patrol Vehicle')}"
                sub2 = f"Confidence: {det.get('confidence', 0.98)*100:.1f}%"
                badge_w = max(260, bw)
                badge_y = max(0, y - 44)

                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), (10, 16, 20), -1)
                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), color, 1)
                cv2.putText(frame, badge, (x + 6, max(14, y - 26)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, color, 1, cv2.LINE_AA)
                cv2.putText(frame, f"{sub1} ({sub2})", (x + 6, max(28, y - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.36, (220, 240, 255), 1, cv2.LINE_AA)

            elif cls == "watchlist_vehicle":
                #        4. RED BOX: WATCHLIST VEHICLE       
                color = (30, 30, 245)     # Bright BGR Red (#f43f5e)
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2, cv2.LINE_AA)
                badge = "WATCHLIST VEHICLE"
                sub1 = f"{det.get('plate', 'FLAGGED')}    {det.get('model', 'Suspect Vehicle')}"
                sub2 = f"Confidence: {det.get('confidence', 0.96)*100:.1f}%"
                badge_w = max(260, bw)
                badge_y = max(0, y - 44)

                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), (12, 10, 22), -1)
                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), color, 1)
                cv2.putText(frame, badge, (x + 6, max(14, y - 26)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (30, 50, 255), 1, cv2.LINE_AA)
                cv2.putText(frame, f"{sub1} ({sub2})", (x + 6, max(28, y - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.36, (230, 230, 230), 1, cv2.LINE_AA)

            elif cls == "unknown_vehicle":
                #        5. ORANGE BOX: UNKNOWN VEHICLE       
                color = (0, 150, 255)     # Bright BGR Amber/Orange (#f59e0b)
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2, cv2.LINE_AA)
                badge = "UNKNOWN VEHICLE"
                sub1 = "UNREGISTERED VEHICLE DETECTED"
                badge_w = max(240, bw)
                badge_y = max(0, y - 40)

                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), (14, 12, 10), -1)
                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), color, 1)
                cv2.putText(frame, badge, (x + 6, max(14, y - 24)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.40, color, 1, cv2.LINE_AA)
                cv2.putText(frame, sub1, (x + 6, max(28, y - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.34, (200, 210, 220), 1, cv2.LINE_AA)

            else:
                #        6. ORANGE BOX: UNKNOWN PERSON       
                color = (0, 150, 255)     # Bright BGR Amber/Orange (#f59e0b)
                cl = min(20, int(bw * 0.22))
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2, cv2.LINE_AA)
                corners = [
                    ((x, y), (x + cl, y)), ((x, y), (x, y + cl)),
                    ((x + bw, y), (x + bw - cl, y)), ((x + bw, y), (x + bw, y + cl)),
                    ((x, y + bh), (x + cl, y + bh)), ((x, y + bh), (x, y + bh - cl)),
                    ((x + bw, y + bh), (x + bw - cl, y + bh)), ((x + bw, y + bh), (x + bw, y + bh - cl)),
                ]
                for p1, p2 in corners:
                    cv2.line(frame, p1, p2, color, 3, cv2.LINE_AA)

                badge = "UNKNOWN PERSON"
                sub1 = "UNREGISTERED INDIVIDUAL"
                badge_w = max(200, bw)
                badge_y = max(0, y - 42)

                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), (14, 12, 10), -1)
                cv2.rectangle(frame, (x, badge_y), (x + badge_w, y), color, 1)
                cv2.putText(frame, badge, (x + 6, max(14, y - 26)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, color, 1, cv2.LINE_AA)
                cv2.putText(frame, sub1, (x + 6, max(28, y - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.36, (200, 210, 220), 1, cv2.LINE_AA)

        #        Clean, Professional Top Status HUD (No clutter, no fake alerts)       
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        cv2.putText(frame, f"A.E.G.I.S. LIVE SURVEILLANCE FEED  {ts}",
                    (20, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 240, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, f"NODE: {self.active_source_id.upper()}  |  FPS: 30  |  AI PIPELINE: ONLINE  |  STATUS: SECURE",
                    (20, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (160, 190, 190), 1, cv2.LINE_AA)

        return frame

    def _generate_standby_frame(self) -> np.ndarray:
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        frame[:] = (13, 21, 22)
        for gy in range(0, 720, 60):
            cv2.line(frame, (0, gy), (1280, gy), (25, 35, 38), 1)
        for gx in range(0, 1280, 60):
            cv2.line(frame, (gx, 0), (gx, 720), (25, 35, 38), 1)

        cv2.putText(frame, "A.E.G.I.S. OPTICAL SURVEILLANCE FEED",
                    (340, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 240, 255), 2, cv2.LINE_AA)

        source_info = f"TARGET SOURCE: {self.active_source_id.upper()} [{self.camera_source}]"
        cv2.putText(frame, source_info,
                    (280, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 220, 220), 1, cv2.LINE_AA)

        status_text = f"STATUS: {self.connection_status.upper()}"
        status_color = (0, 230, 120) if self.connection_status == "connected" else (30, 80, 255)
        cv2.putText(frame, status_text,
                    (490, 400), cv2.FONT_HERSHEY_SIMPLEX, 0.65, status_color, 2, cv2.LINE_AA)

        sub_tip = "STANDBY FOR STREAM SYNC / SWITCH SOURCE IN CONTROL PANEL"
        cv2.putText(frame, sub_tip,
                    (340, 450), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 180, 255), 1, cv2.LINE_AA)
        return frame

    def _trigger_fence_breach_alert(self, breaches: List[Dict[str, Any]]):
        """Dispatches real-time security breach alerts across WebSocket broker."""
        now = time.time()
        for b in breaches:
            key = f"BREACH_{b['zoneId']}"
            if (now - self._last_alert_time.get(key, 0)) < 4.0:
                continue
            self._last_alert_time[key] = now
            payload = {
                "event": "VIRTUAL_FENCE_BREACH",
                "type": "VIRTUAL_FENCE_BREACH",
                "zoneId": b["zoneId"],
                "zoneName": b["zoneName"],
                "entity": b["entity"],
                "classification": b["classification"],
                "severity": "CRITICAL",
                "alertStatus": "CRITICAL",
                "title": f"PERIMETER BREACH: {b['zoneName'].upper()}",
                "description": f"{b['classification'].upper()} target ({b['entity']}) penetrated virtual perimeter",
                "timestamp": datetime.utcnow().isoformat(),
                "droneId": self.active_source_id or "CAM-01",
                "sector": "Sector Alpha Buffer Zone",
            }
            logger.warning(f"🚨 VIRTUAL FENCE BREACH in {b['zoneName']} by {b['entity']}")
            for cb in self.alert_callbacks:
                try:
                    cb(payload)
                except Exception as exc:
                    logger.error(f"Fence breach callback error: {exc}")

    def analyze_frame(
        self, frame_bgr: np.ndarray, client_zones: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Direct inference endpoint for client browser camera frames:
        1. Runs YuNet face detector + SFace 128-d biometric extraction
        2. Evaluates Personnel DB (Authorized) vs Suspects DB (Watchlist) vs Unknown
        3. Ray-casts entity locations against configured Virtual Fences
        4. Broadcasts WebSocket alerts for suspect matches and perimeter breaches
        5. Updates annotated MJPEG frame cache for /api/video/feed
        6. Returns structured JSON with normalized bounding boxes for React HUD overlay
        """
        orig_h, orig_w = frame_bgr.shape[:2]
        now_iso = datetime.utcnow().isoformat()

        with self.lock:
            self.connection_status = "connected"

        # Execute YuNet + SFace inference pipeline
        detections = self._run_ai_inference(frame_bgr)

        # Default fallback zones if client did not supply custom zones
        zones_to_check = client_zones if client_zones is not None else [
            {
                "id": "ZONE-ALPHA",
                "name": "Restricted Border Buffer Strip",
                "type": "polygon",
                "color": "#ff562c",
                "active": True,
                "alarmOnBreach": True,
                "points": [
                    {"x": 15, "y": 65},
                    {"x": 85, "y": 65},
                    {"x": 92, "y": 90},
                    {"x": 8, "y": 90},
                ],
            },
            {
                "id": "ZONE-BRAVO-LINE",
                "name": "Perimeter Demarcation Line B7",
                "type": "line",
                "color": "#fec931",
                "active": True,
                "alarmOnBreach": True,
                "points": [
                    {"x": 5, "y": 72},
                    {"x": 95, "y": 70},
                ],
            }
        ]

        enriched_detections = []
        active_breaches = []
        watchlist_count = 0
        authorized_count = 0
        unknown_count = 0
        alerts_triggered = []

        for det in detections:
            x, y, bw, bh = det["box"]
            cls = det.get("classification", "unknown")
            is_target = det.get("is_target", False)
            conf = float(det.get("confidence", 0.0))
            name = det.get("name", "Unknown")

            # Normalized coordinates (0.0 to 1.0) for zero-latency SVG/Canvas overlay in React
            norm_x = round(max(0.0, min(1.0, x / float(orig_w))), 4)
            norm_y = round(max(0.0, min(1.0, y / float(orig_h))), 4)
            norm_w = round(max(0.0, min(1.0, bw / float(orig_w))), 4)
            norm_h = round(max(0.0, min(1.0, bh / float(orig_h))), 4)

            # Ground centroid in percentage (0 to 100)
            foot_x_pct = (x + bw / 2.0) / float(orig_w) * 100.0
            foot_y_pct = (y + bh) / float(orig_h) * 100.0

            color = "#f59e0b"  # Amber
            badge = "UNKNOWN PERSON"
            threat = det.get("threat", "UNREGISTERED")
            entity_id = None

            if cls == "watchlist":
                watchlist_count += 1
                color = "#f43f5e"  # Red
                badge = "TARGET MATCH"
                threat = det.get("threat", "CRITICAL")
                entity_id = det.get("suspect_id", "SUS-MATCH")
                alerts_triggered.append({
                    "type": "TARGET_MATCH",
                    "entityId": entity_id,
                    "name": name,
                    "threat": threat,
                    "confidence": round(conf, 3),
                })
            elif cls == "authorized":
                authorized_count += 1
                color = "#00daf3"  # Cyan
                badge = "AUTHORIZED PERSONNEL"
                threat = "LOW"
                entity_id = det.get("person_id", "PER-AUTH")
            else:
                unknown_count += 1
                color = "#f59e0b"  # Amber
                badge = "UNKNOWN PERSON"
                threat = "UNREGISTERED"

            # Check virtual fence breach via point-in-polygon ray-casting
            breached_zones = []
            for zone in zones_to_check:
                if not zone.get("active", True) or not zone.get("alarmOnBreach", False):
                    continue
                z_points = zone.get("points", [])
                if len(z_points) >= 3:
                    inside = False
                    n = len(z_points)
                    p1x, p1y = z_points[0]["x"], z_points[0]["y"]
                    for i in range(n + 1):
                        p2x, p2y = z_points[i % n]["x"], z_points[i % n]["y"]
                        if foot_y_pct > min(p1y, p2y):
                            if foot_y_pct <= max(p1y, p2y):
                                if foot_x_pct <= max(p1x, p2x):
                                    if p1y != p2y:
                                        xinters = (foot_y_pct - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                                    if p1x == p2x or foot_x_pct <= xinters:
                                        inside = not inside
                        p1x, p1y = p2x, p2y
                    if inside:
                        breached_zones.append(zone.get("id", "ZONE"))
                        active_breaches.append({
                            "zoneId": zone.get("id", "ZONE"),
                            "zoneName": zone.get("name", "Restricted Area"),
                            "entity": name,
                            "classification": cls,
                            "timestamp": now_iso,
                        })

            enriched_detections.append({
                "box": [x, y, bw, bh],
                "normalized_box": [norm_x, norm_y, norm_w, norm_h],
                "type": det.get("type", "person"),
                "classification": cls,
                "is_target": is_target,
                "id": entity_id,
                "name": name,
                "rank": det.get("rank"),
                "threat": threat,
                "confidence": round(conf, 3),
                "badge": badge,
                "color": color,
                "fence_breaches": breached_zones,
            })

        # Broadcast fence breach alerts if detected
        if active_breaches:
            self._trigger_fence_breach_alert(active_breaches)

        # Draw tactical HUD overlays on frame and mirror to internal annotated stream
        annotated = self._draw_tactical_overlays(frame_bgr.copy(), detections)
        with self.lock:
            self._annotated_frame = annotated

        return {
            "success": True,
            "timestamp": now_iso,
            "frame_size": {"width": orig_w, "height": orig_h},
            "detections": enriched_detections,
            "alerts": alerts_triggered,
            "fence_breaches": active_breaches,
            "stats": {
                "total_faces": len(detections),
                "watchlist_matches": watchlist_count,
                "authorized_matches": authorized_count,
                "unknown_faces": unknown_count,
            },
        }

    #        Stream Generator (FastAPI endpoint)                                                                

    def feed_external_frame(self, frame_bgr: np.ndarray) -> np.ndarray:
        """Processes external frames streamed from a browser webcam."""
        with self.lock:
            self.connection_status = "connected"
            if not self._ai_busy:
                self._latest_raw_frame = frame_bgr.copy()
            detections = list(self._cached_detections)
        annotated = self._draw_tactical_overlays(frame_bgr, detections)
        with self.lock:
            self._annotated_frame = annotated
        return annotated

    def generate_frames(self):
        while True:
            with self.lock:
                frame = self._annotated_frame

            if frame is None:
                frame = self._generate_standby_frame()

            ret, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + buf.tobytes()
                    + b"\r\n"
                )

            time.sleep(0.030)


#        Singleton                                                                                                                                                             
camera_manager = CameraStreamManager()
