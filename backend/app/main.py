"""
A.E.G.I.S. (Autonomous Enhanced Geographic Intelligence System)
FastAPI Backend Application & Real-Time Telemetry / Video Vision Broker
"""

import os
import cv2
import numpy as np
import json
import random
import asyncio
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.services.camera import camera_manager

logger = logging.getLogger("aegis.main")
logging.basicConfig(level=logging.INFO)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI(
    title="A.E.G.I.S. Intelligence Platform API",
    description="Backend microservices for real-time video streaming, facial recognition pipeline, drone telemetry, and target tracking alerts.",
    version="1.0.0",
)

# Enable CORS for local Vite development & network deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static uploads directory so suspect avatar photos are served publicly
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# ── WebSocket Real-Time Connection Manager ─────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

    def broadcast_threadsafe(self, message: dict):
        """Thread-safe broadcast called from camera background threads."""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(message), self._loop)

manager = ConnectionManager()

# Hook camera alert events directly into the WebSocket broadcast manager
camera_manager.register_alert_callback(manager.broadcast_threadsafe)


@app.on_event("startup")
async def startup_event():
    manager.set_event_loop(asyncio.get_running_loop())
    logger.info("A.E.G.I.S. FastAPI Server & WebSocket Broker Started.")


# ── Video Streaming Endpoint ───────────────────────────────────


@app.websocket("/ws/camera/feed")
async def ws_camera_feed(websocket: WebSocket):
    """Real-time browser webcam streaming with AI face detection & HUD overlay."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            np_arr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if frame is not None:
                annotated = camera_manager.feed_external_frame(frame)
                ret, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
                if ret:
                    await websocket.send_bytes(buf.tobytes())
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"Browser camera disconnected: {e}")

@app.post("/api/analyze-frame")
async def analyze_frame_endpoint(request: Request):
    """
    Primary AI Vision Inference Endpoint for Browser-Based Cameras:
    Accepts:
      - Multipart/form-data: form field 'file' (JPEG/PNG/WebP image) and optional 'zones'
      - Application/json: { "image": "data:image/jpeg;base64,...", "zones": [...] }
      - Raw binary image payload
    Executes:
      - YuNet face detection & SFace 128-d biometric feature extraction
      - Dual matching: Personnel DB (Authorized) vs Suspects DB (Watchlist)
      - Virtual fence polygon & tripwire breach evaluation
      - Real-time alert dispatch across WebSocket broker
    Returns:
      - JSON containing normalized bounding boxes, classifications, threat levels,
        confidence scores, and perimeter breach indicators.
    """
    image_bytes: Optional[bytes] = None
    client_zones: Optional[List[Dict[str, Any]]] = None
    content_type = request.headers.get("content-type", "").lower()

    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file") or form.get("image")
        if uploaded_file and hasattr(uploaded_file, "read"):
            image_bytes = await uploaded_file.read()
        zones_raw = form.get("zones")
        if zones_raw and isinstance(zones_raw, str):
            try:
                client_zones = json.loads(zones_raw)
            except Exception:
                pass
    elif "application/json" in content_type:
        try:
            body = await request.json()
            img_str = body.get("image") or body.get("frame") or ""
            if "," in img_str:
                img_str = img_str.split(",", 1)[1]
            if img_str:
                import base64
                image_bytes = base64.b64decode(img_str)
            client_zones = body.get("zones")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {e}")
    else:
        body = await request.body()
        if body and len(body) > 100:
            image_bytes = body

    if not image_bytes or len(image_bytes) < 100:
        raise HTTPException(
            status_code=400,
            detail="No valid image frame provided. Send 'file' via multipart form or 'image' base64 string in JSON."
        )

    np_arr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Failed to decode image frame.")

    return camera_manager.analyze_frame(frame, client_zones=client_zones)


@app.get("/api/video/feed")
async def video_feed():
    """
    Live aerial video stream with real-time AI face detection & target recognition overlays.
    Returns multipart/x-mixed-replace JPEG boundary stream.
    """
    return StreamingResponse(
        camera_manager.generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ── Camera Source Switching Endpoints ─────────────────────────

class CameraSwitchRequest(BaseModel):
    sourceId: str


@app.get("/api/camera/sources")
async def get_camera_sources():
    """Returns list of selectable camera/drone video sources."""
    return {
        "sources": camera_manager.get_camera_sources(),
        "activeSource": camera_manager.active_source_id,
        "status": camera_manager.connection_status,
    }


@app.post("/api/camera/source")
async def switch_camera_source(req: CameraSwitchRequest):
    """Dynamically switches active camera source (Browser Camera / Network Stream)."""
    res = camera_manager.switch_camera_source(req.sourceId)
    if not res.get("success", False):
        raise HTTPException(status_code=400, detail=res.get("error", "Switch failed"))
    return res


@app.get("/api/camera/status")
async def get_camera_status():
    """Returns real-time connection status and active source."""
    return camera_manager.get_camera_status()


# ── Health & Diagnostic Endpoints ──────────────────────────────

@app.get("/api/health")
async def health_check():
    return {
        "status": "OPERATIONAL",
        "system": "A.E.G.I.S. Command Node #01",
        "timestamp": datetime.utcnow().isoformat(),
        "camera_source": os.getenv("CAMERA_SOURCE", "browser"),
        "ai_vision_pipeline": "YUNET_SFACE_ACTIVE",
        "telemetry_broker": "ACTIVE",
        "deployment_platform": "RAILWAY_READY",
    }


# ── Drones API ─────────────────────────────────────────────────

@app.get("/api/drones")
async def get_drones():
    return {
        "drones": [
            {
                "id": "DRN-03",
                "name": "Falcon-03",
                "status": "patrol_active",
                "coordinates": {"lat": 25.3176, "lng": 82.9739, "altitude": 85},
                "battery": {"percentage": 78, "remainingFlightTime": 24},
                "telemetry": {"speed": 42, "heading": 127, "signalStrength": 96},
            },
            {
                "id": "DRN-07",
                "name": "Raven-07",
                "status": "manual_control",
                "coordinates": {"lat": 25.3210, "lng": 82.9801, "altitude": 60},
                "battery": {"percentage": 55, "remainingFlightTime": 18},
                "telemetry": {"speed": 12, "heading": 225, "signalStrength": 88},
            },
        ]
    }


# ── Surveillance Nodes API ──────────────────────────────────────

@app.get("/api/nodes")
async def get_surveillance_nodes():
    """Return all fixed border CCTV, PTZ, and checkpoint surveillance nodes."""
    return {
        "nodes": [
            {
                "id": "CAM-01",
                "name": "Gate-Alpha Primary",
                "sector": "Sector Alpha - Border Entry",
                "type": "fixed_cctv",
                "status": "online",
                "ip": "192.168.10.101",
                "streamUrl": "/api/video/feed",
                "ptzCapable": False,
                "thermalCapable": True,
                "fps": 30,
                "resolution": "4K UHD (3840x2160)",
                "coordinates": {"lat": 25.3176, "lng": 82.9739},
                "activeDetections": {"faces": 2, "vehicles": 1},
            },
            {
                "id": "CAM-02",
                "name": "Sector B7 Perimeter",
                "sector": "Sector Bravo - Buffer Strip",
                "type": "ptz",
                "status": "offline",
                "ip": "192.168.10.102",
                "streamUrl": "",
                "ptzCapable": True,
                "thermalCapable": True,
                "fps": 0,
                "resolution": "1080p Tactical",
                "coordinates": {"lat": 25.3210, "lng": 82.9801},
                "activeDetections": {"faces": 0, "vehicles": 0},
            },
            {
                "id": "CAM-03",
                "name": "Buffer Zone Charlie",
                "sector": "Sector Charlie - No-Man Land",
                "type": "thermal",
                "status": "offline",
                "ip": "192.168.10.103",
                "streamUrl": "",
                "ptzCapable": True,
                "thermalCapable": True,
                "fps": 0,
                "resolution": "1080p Flir FLX",
                "coordinates": {"lat": 25.3145, "lng": 82.9690},
                "activeDetections": {"faces": 0, "vehicles": 0},
            },
            {
                "id": "CAM-04",
                "name": "South Outpost B4",
                "sector": "Sector Delta - High Ground",
                "type": "ptz",
                "status": "offline",
                "ip": "192.168.10.104",
                "streamUrl": "",
                "ptzCapable": True,
                "thermalCapable": False,
                "fps": 0,
                "resolution": "4K UHD",
                "coordinates": {"lat": 25.3260, "lng": 82.9850},
                "activeDetections": {"faces": 0, "vehicles": 0},
            },
            {
                "id": "CAM-05",
                "name": "Checkpoint Charlie Gate",
                "sector": "Sector Charlie - Road Access",
                "type": "checkpoint",
                "status": "offline",
                "ip": "192.168.10.105",
                "streamUrl": "",
                "ptzCapable": False,
                "thermalCapable": False,
                "fps": 0,
                "resolution": "1080p Standard",
                "coordinates": {"lat": 25.3090, "lng": 82.9650},
                "activeDetections": {"faces": 0, "vehicles": 0},
            },
            {
                "id": "CAM-06",
                "name": "Riverine Watch North",
                "sector": "Sector Alpha - River Bank",
                "type": "thermal",
                "status": "offline",
                "ip": "192.168.10.106",
                "streamUrl": "",
                "ptzCapable": True,
                "thermalCapable": True,
                "fps": 0,
                "resolution": "720p Standby",
                "coordinates": {"lat": 25.3310, "lng": 82.9780},
                "activeDetections": {"faces": 0, "vehicles": 0},
            },
        ]
    }


# ── Personnel API ──────────────────────────────────────────────

@app.get("/api/personnel")
async def get_personnel():
    """Return authorized border security and operations staff."""
    return {"personnel": camera_manager.get_all_personnel_detail()}


@app.post("/api/personnel")
async def create_personnel(
    full_name: str = Form(...),
    rank: str = Form("Officer"),
    role: str = Form("officer"),
    unit: str = Form("Sector Garrison"),
    department: str = Form("Border Operations"),
    clearance_level: str = Form("LEVEL 3 - OPERATIONAL"),
    image: UploadFile = File(...),
):
    """
    Register a new Authorized Personnel into A.E.G.I.S.
    Computes 128-d face embedding and saves to Personnel DB.
    """
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image (JPEG/PNG).")

    image_bytes = await image.read()
    if len(image_bytes) < 1024:
        raise HTTPException(status_code=400, detail="Image file appears empty or too small.")

    personnel_id = f"PER-{random.randint(100, 999)}"
    while personnel_id in camera_manager.personnel_db:
        personnel_id = f"PER-{random.randint(100, 999)}"

    enrolled = camera_manager.add_personnel_with_encoding(
        personnel_id=personnel_id,
        full_name=full_name.strip(),
        rank=rank.strip(),
        role=role.strip(),
        unit=unit.strip(),
        department=department.strip(),
        clearance_level=clearance_level.strip(),
        image_bytes=image_bytes,
    )

    return {
        "success": True,
        "personnelId": personnel_id,
        "fullName": full_name,
        "faceEnrolled": enrolled,
        "message": f"Personnel {personnel_id} ({full_name}) registered successfully.",
    }


@app.delete("/api/personnel/{personnel_id}")
async def delete_personnel(personnel_id: str):
    """Delete an authorized personnel record and associated face embeddings."""
    deleted = camera_manager.delete_personnel(personnel_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Personnel {personnel_id} not found.")
    return {"success": True, "personnelId": personnel_id, "message": f"Personnel {personnel_id} removed."}


# ── Vehicles API ───────────────────────────────────────────────

@app.get("/api/vehicles")
async def get_vehicles():
    """Return tracked, authorized, and watchlist vehicles."""
    return {"vehicles": camera_manager.get_all_vehicles_detail()}


@app.post("/api/vehicles")
async def create_vehicle(
    vehicle_type: str = Form(...),
    plate: str = Form(...),
    owner: str = Form(""),
    unit: str = Form(""),
    status: str = Form("Authorized"),
    make_model: str = Form(""),
    color: str = Form(""),
    image: Optional[UploadFile] = File(None),
):
    """
    Register a vehicle into A.E.G.I.S. fleet/watchlist database.
    """
    vehicle_id = f"VEH-{random.randint(100, 999)}"
    while vehicle_id in camera_manager.vehicle_db:
        vehicle_id = f"VEH-{random.randint(100, 999)}"

    image_bytes = None
    if image:
        image_bytes = await image.read()

    v_data = camera_manager.add_vehicle(
        vehicle_id=vehicle_id,
        vehicle_type=vehicle_type.strip(),
        plate_number=plate.strip().upper(),
        owner=owner.strip(),
        unit=unit.strip(),
        status=status.strip(),
        make_model=make_model.strip(),
        color=color.strip(),
        image_bytes=image_bytes,
    )

    return {
        "success": True,
        "vehicleId": vehicle_id,
        "vehicle": v_data,
        "message": f"Vehicle {plate} registered as {status}.",
    }


@app.delete("/api/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    """Remove a vehicle from the fleet/watchlist database."""
    deleted = camera_manager.delete_vehicle(vehicle_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found.")
    return {"success": True, "vehicleId": vehicle_id, "message": f"Vehicle {vehicle_id} deleted."}


# ── Virtual Fence Zones API ────────────────────────────────────

@app.get("/api/zones")
async def get_zones():
    """Return configured virtual fences and restricted border zones."""
    return {
        "zones": [
            {
                "id": "ZONE-ALPHA",
                "name": "Restricted Border Buffer Strip",
                "nodeId": "CAM-01",
                "type": "polygon",
                "color": "#ff562c",
                "active": True,
                "alarmOnBreach": True,
                "breachCount": 3,
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
                "nodeId": "CAM-02",
                "type": "line",
                "color": "#fec931",
                "active": True,
                "alarmOnBreach": True,
                "breachCount": 1,
                "points": [
                    {"x": 5, "y": 72},
                    {"x": 95, "y": 70},
                ],
            },
        ]
    }


# ── Suspects API ───────────────────────────────────────────────

@app.get("/api/suspects")
async def get_suspects():
    """Return all currently tracked suspects from live/disk database."""
    return {"suspects": camera_manager.get_all_suspects_detail()}


@app.post("/api/suspects/reset")
async def reset_suspects():
    """
    Purge all uploaded suspects & vector embeddings, restoring
    the initial clean seed suspects state in memory and on disk.
    """
    reset_suspects_list = camera_manager.reset_suspect_db()
    logger.info("POST /api/suspects/reset — restored clean seed database.")
    manager.broadcast_threadsafe({
        "event": "SUSPECT_RESET",
        "type": "SUSPECT_RESET",
        "timestamp": datetime.utcnow().isoformat(),
    })
    return {
        "success": True,
        "message": "Database reset to initial clean seed state.",
        "suspects": reset_suspects_list,
    }


@app.post("/api/suspects")
async def create_suspect(
    full_name: str = Form(...),
    alias: str = Form(""),
    threat_level: str = Form("medium"),
    image: UploadFile = File(...),
):
    """
    Register a new suspect into the live A.E.G.I.S. watchlist.

    Accepts multipart/form-data:
      - full_name   : str  (required)
      - alias       : str  (optional, comma-separated)
      - threat_level: str  critical | high | medium | low
      - image       : file (JPEG/PNG of suspect's face)

    On success: computes 128-d face encoding and hot-injects into
    CameraStreamManager's in-memory watchlist and disk storage. Detection begins immediately
    on the next AI scan cycle.
    """
    # Validate file type
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image (JPEG/PNG).")

    image_bytes = await image.read()
    if len(image_bytes) < 1024:
        raise HTTPException(status_code=400, detail="Image file appears empty or too small.")

    # Generate suspect ID
    suspect_id = f"SUS-{random.randint(100, 999)}"
    while suspect_id in camera_manager.suspect_db:
        suspect_id = f"SUS-{random.randint(100, 999)}"

    enrolled = camera_manager.add_suspect_with_encoding(
        suspect_id=suspect_id,
        full_name=full_name,
        threat_level=threat_level.upper(),
        alias=alias,
        image_bytes=image_bytes,
    )

    logger.info(
        f"POST /api/suspects → {suspect_id} ({full_name}) | "
        f"enrolled={enrolled} | threat={threat_level}"
    )

    # Broadcast registration event to all connected WebSocket clients so the
    # Watchlist Panel syncs immediately without a manual page refresh.
    manager.broadcast_threadsafe({
        "event": "SUSPECT_REGISTERED",
        "type": "SUSPECT_REGISTERED",
        "suspectId": suspect_id,
        "fullName": full_name,
        "threatLevel": threat_level,
        "faceEnrolled": enrolled,
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "success": True,
        "suspectId": suspect_id,
        "fullName": full_name,
        "threatLevel": threat_level,
        "faceEnrolled": enrolled,
        "message": (
            f"Suspect {suspect_id} registered and face encoding computed successfully."
            if enrolled else
            f"Suspect {suspect_id} registered, but no face was detected in the uploaded image. "
            "Re-upload a clear frontal face photo to enable live recognition."
        ),
    }


@app.delete("/api/suspects/{suspect_id}")
async def delete_suspect(suspect_id: str):
    """
    Remove a suspect from the live A.E.G.I.S. watchlist.
    Deletes their profile and face encodings from CameraStreamManager memory and disk.
    """
    deleted = camera_manager.delete_suspect(suspect_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Suspect {suspect_id} not found.")

    manager.broadcast_threadsafe({
        "event": "SUSPECT_DELETED",
        "type": "SUSPECT_DELETED",
        "suspectId": suspect_id,
        "timestamp": datetime.utcnow().isoformat(),
    })
    logger.info(f"DELETE /api/suspects/{suspect_id} — removed from active watchlist and disk.")
    return {"success": True, "suspectId": suspect_id, "message": f"Suspect {suspect_id} purged from watchlist."}


# ── Real-Time WebSocket Telemetry Feed ─────────────────────────

@app.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Broadcast simulated real-time drone telemetry every second
            lat_jitter = (random.random() - 0.5) * 0.0003
            lng_jitter = (random.random() - 0.5) * 0.0003

            payload = {
                "type": "TELEMETRY_UPDATE",
                "timestamp": datetime.utcnow().isoformat(),
                "drone": {
                    "id": "DRN-03",
                    "coordinates": {
                        "lat": round(25.3176 + lat_jitter, 6),
                        "lng": round(82.9739 + lng_jitter, 6),
                        "altitude": round(80 + random.random() * 6, 1),
                    },
                    "telemetry": {
                        "speed": round(42 + random.random() * 4, 1),
                        "heading": random.randint(124, 130),
                        "signalStrength": 96,
                    },
                },
            }
            await websocket.send_json(payload)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
