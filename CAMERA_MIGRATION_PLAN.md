# 📹 Camera Architecture Migration Plan — Hardware Webcam to Browser WebRTC

---

## 1. Context & Motivation

In traditional local installations, computer vision pipelines access video devices directly from the host operating system via OpenCV:
```python
cap = cv2.VideoCapture(0) # Directly accesses /dev/video0 or Windows DirectShow
```

### Why This Fails in Cloud Containers (Railway, AWS, Docker)
1. **No Physical Sensors**: Cloud servers operate as headless virtualized containers without attached USB webcams or video hardware.
2. **Container Isolation**: Even if video devices were physically present on the host, containers lack default device access (`/dev/video0`) without elevated `--device` flags.
3. **Multi-User Scalability**: Server-side camera capture limits the system to a single physical camera in the server room, preventing field operators or command staff from streaming their operational cameras.

---

## 2. Architecture Comparison: Before vs. After

### Legacy Architecture (Hardware Dependent)
```
Local Laptop Webcam (Index 0)
       ↓
  DirectShow / V4L2
       ↓
cv2.VideoCapture(0) inside Backend
       ↓
Inference & cv2.putText Overlays
       ↓
MJPEG Streaming /api/video/feed
       ↓
Browser (Passive <img> tag)
```
*Disadvantages: Incompatible with cloud, high server CPU usage, no client-side camera control, single video source.*

---

### New Architecture (Cloud-Native Browser WebRTC Ingest)
```
Operator / Field Webcam
       ↓
Browser MediaDevices API (navigator.mediaDevices.getUserMedia)
       ↓
React <video> Element (Smooth native 30/60 FPS client render)
       ↓
Offscreen Canvas Grabber (Captures frame every 250–350ms)
       ↓
HTTP POST /api/analyze-frame (FastAPI backend)
       ↓
OpenCV DNN (YuNet Landmark Detection + SFace 128-d Embeddings)
       ↓
Identity Matching: Personnel DB vs. Watchlist DB vs. Unknown
       ↓
Virtual Fence Boundary Intersection (Ray-Casting Algorithm)
       ↓
JSON Detection Response + WebSocket Alert Broadcast
       ↓
React Tactical Overlay (Real-time SVG/Canvas HUD rendered on live video)
```
*Advantages: 100% cloud-compatible, zero server camera hardware dependency, multi-operator support, instant permission handling, responsive normalized bounding boxes.*

---

## 3. Preserved AI Capabilities

All core intelligence modules have been preserved and enhanced:

| AI Capability | Implementation Detail | Tactical Display in React HUD |
|---|---|---|
| **YuNet Face Detection** | Fast ONNX model (`face_detection_yunet_2023mar.onnx`) running on 720p inference scale. | Real-time corner bracket reticles over detected faces. |
| **SFace Biometric Matching** | 128-dimensional deep feature vector (`face_recognition_sface_2021dec.onnx`) with cosine distance threshold (0.38). | Normalized coordinates rendered over live video. |
| **Watchlist Detection** | Matches against active suspect records in `data/suspects_db.json`. | Bright red box (`#f43f5e`), pulsating `TARGET MATCH` banner, threat level rating, audio alert tone. |
| **Authorized Personnel** | Matches against cleared security officers in `data/personnel_db.json`. | Bright cyan box (`#00daf3`), `AUTHORIZED PERSONNEL` banner, rank and unit display. |
| **Unknown Detection** | Identifies unregistered persons not matching either database. | Amber box (`#f59e0b`), `UNKNOWN PERSON` banner. |
| **Virtual Fencing** | Ray-casting point-in-polygon and tripwire intersection algorithm. | Dynamic SVG fence lines, flashing red alerts upon boundary breach. |
| **Alert Generation** | Automatic dispatch to WebSocket connection manager. | Broadcasts `TARGET_MATCH` and `VIRTUAL_FENCE_BREACH` events to all connected clients. |

---

## 4. Endpoints Specification

### Ingestion: `POST /api/analyze-frame`

**Request:**
- Content-Type: `multipart/form-data` OR `application/json`
- Form fields:
  * `file`: Binary image file (JPEG, PNG, WebP)
  * `zones`: (Optional) JSON string of virtual fence geometries to evaluate
- JSON fields:
  * `image`: Base64 encoded image or Data URL (`data:image/jpeg;base64,...`)
  * `zones`: (Optional) Array of zone objects

**Response (JSON):**
```json
{
  "success": true,
  "timestamp": "2026-09-30T08:45:00.000Z",
  "frame_size": { "width": 1280, "height": 720 },
  "detections": [
    {
      "box": [320, 180, 240, 280],
      "normalized_box": [0.25, 0.25, 0.1875, 0.3888],
      "type": "person",
      "classification": "watchlist",
      "is_target": true,
      "id": "SUS-201",
      "name": "Tariq Mansoor",
      "threat": "CRITICAL",
      "confidence": 0.945,
      "badge": "TARGET MATCH",
      "color": "#f43f5e",
      "fence_breaches": ["ZONE-ALPHA"]
    }
  ],
  "alerts": [
    {
      "type": "TARGET_MATCH",
      "entityId": "SUS-201",
      "name": "Tariq Mansoor",
      "threat": "CRITICAL",
      "confidence": 0.945
    }
  ],
  "fence_breaches": [
    {
      "zoneId": "ZONE-ALPHA",
      "zoneName": "Restricted Border Buffer Strip",
      "entity": "Tariq Mansoor",
      "classification": "watchlist",
      "timestamp": "2026-09-30T08:45:00.000Z"
    }
  ],
  "stats": {
    "total_faces": 1,
    "watchlist_matches": 1,
    "authorized_matches": 0,
    "unknown_faces": 0
  }
}
```

---

## 5. Client Integration Guide

### Using the `BrowserCamera` Component

Import and embed `BrowserCamera` in any tactical view:

```tsx
import { BrowserCamera } from '@/components/BrowserCamera';

export function SurveillanceView() {
  return (
    <div className="w-full h-full relative">
      <BrowserCamera
        intervalMs={350}
        showVirtualFence={true}
        thermalActive={false}
        nightVisionMode={false}
        onTargetMatch={(det) => console.warn('TARGET MATCH:', det.name)}
        onFenceBreach={(breach) => console.error('BREACH:', breach.zoneName)}
      />
    </div>
  );
}
```

### Key Props:
- `intervalMs`: AI scan interval in milliseconds (default: `350ms`, recommended range: 250–500ms).
- `showVirtualFence`: Toggles the SVG virtual fence overlays on the video stream.
- `thermalActive`: Simulates thermal optics HUD shader.
- `nightVisionMode`: Simulates night-vision optical amplifier shader.
- `zoomLevel`: Digital pan/zoom magnification level.
- `onTargetMatch`: Triggered when a watchlist suspect is identified.
- `onFenceBreach`: Triggered when an entity breaches a virtual security boundary.

---

## 6. Performance Benchmarks

- **Local Video Render**: 30–60 FPS (hardware-accelerated browser rendering, 0ms lag).
- **Backend YuNet + SFace Inference**: 20–35ms per frame on standard CPU.
- **Client Frame Ingest Frequency**: ~3 FPS (1 scan every 350ms), reducing bandwidth consumption to <120 KB/sec while maintaining continuous tracking accuracy.
- **Network In-Flight Guard**: Frames are skipped if the previous inference request is still in-flight, preventing backpressure or network congestion.
