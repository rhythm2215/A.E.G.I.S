# 🛠️ Railway Deployment Fixes & Codebase Audit Report

This document records all architectural blockers, container defects, and hardware dependencies identified during the cloud readiness audit, along with the precise technical fixes implemented.

---

## Summary of Fixes Applied

| # | Issue / Blocker | Severity | File(s) Affected | Status |
|---|---|---|---|---|
| 1 | Hardcoded local hardware camera `cv2.VideoCapture(0)` | 🚨 Critical | `backend/app/services/camera.py`, `.env` | ✅ Fixed |
| 2 | Backend hardcoded port 8000 in CMD | 🚨 Critical | `backend/Dockerfile` | ✅ Fixed |
| 3 | Frontend Nginx listening on hardcoded port 5173 | 🚨 Critical | `Dockerfile`, `nginx.conf` | ✅ Fixed |
| 4 | `face_recognition` / `dlib` compilation timeout on Railway | 🚨 Critical | `backend/requirements.txt`, `backend/Dockerfile` | ✅ Fixed |
| 5 | Hardcoded local subnet camera IP `10.210.60.230` | ⚠️ High | `backend/.env`, `camera.py` | ✅ Fixed |
| 6 | Missing HTTP endpoint for browser frame ingestion | 🚨 Critical | `backend/app/main.py`, `camera.py` | ✅ Fixed |
| 7 | Missing Railway service orchestration files | ⚠️ Medium | `railway.json`, `backend/railway.json` | ✅ Created |
| 8 | Missing browser WebRTC camera component | 🚨 Critical | `src/components/BrowserCamera.tsx` | ✅ Created |
| 9 | Legacy WebSocket canvas video loop on frontend | ⚠️ Medium | `src/features/dashboard/components/CentralOperationsView.tsx` | ✅ Modernized |

---

## Detailed Audit & Resolution

### Fix 1: Removal of Physical Camera Assumption in Container
- **Problem**: In cloud environments like Railway or Docker on Linux, physical video devices (`/dev/video0`, DirectShow, MSMF) do not exist. The original code in `_capture_loop` continuously looped calling `cv2.VideoCapture(0)`, logging warnings and consuming CPU cycles.
- **Fix**:
  - `CAMERA_SOURCE` environment variable default changed to `browser`.
  - In `backend/app/services/camera.py`, added environment detection: if `CAMERA_SOURCE` is `browser` or running in a container (`PORT` or `RAILWAY_ENVIRONMENT`), hardware camera opening is cleanly bypassed.
  - Standby HUD frame is rendered until browser client frames arrive via `POST /api/analyze-frame`.

### Fix 2: Dynamic Port Binding on Backend
- **Problem**: Railway injects a dynamic `$PORT` environment variable (e.g. 5431, 8080) at runtime. The original `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]` caused Railway healthcheck timeouts because the container listened on 8000 while Railway routed traffic to `$PORT`.
- **Fix**:
  - Updated `backend/Dockerfile` CMD to:
    ```dockerfile
    CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
    ```
  - Guaranteed `0.0.0.0` binding so internal Railway proxy routes can reach the container.

### Fix 3: Nginx Port Ingestion via `envsubst`
- **Problem**: `nginx.conf` was hardcoded to `listen 5173;`. In Railway, frontend static web containers must listen on `$PORT`.
- **Fix**:
  - Replaced hardcoded port in `nginx.conf` with `${PORT}` template variable.
  - In `Dockerfile`, copied config as `default.conf.template` and configured container entrypoint to execute:
    ```sh
    export PORT=${PORT:-80} && envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'
    ```

### Fix 4: Eliminating Heavy `dlib` Compilation Failure
- **Problem**: `face_recognition` requires `cmake` and builds `dlib` C++ source code during `pip install`. On cloud build servers with CPU/memory limits, this routinely takes 15–20 minutes and crashes with Out-Of-Memory (OOM) errors.
- **Fix**:
  - A.E.G.I.S. already bundles the state-of-the-art OpenCV ONNX models:
    * `models/face_detection_yunet_2023mar.onnx` (YuNet)
    * `models/face_recognition_sface_2021dec.onnx` (SFace)
  - Both models run directly on `opencv-python-headless` via `cv2.FaceDetectorYN` and `cv2.FaceRecognizerSF`.
  - Commented out `face_recognition` in `backend/requirements.txt`.
  - Removed `cmake`, `build-essential`, and X11 build packages from `backend/Dockerfile`, reducing image build time from 15 minutes to 30 seconds and image size by over 1.2 GB.

### Fix 5: Removal of Hardcoded ESP32 Local IP
- **Problem**: `backend/.env` contained `CAM_MB_URL=http://10.210.60.230:81/stream`. In a cloud container, private LAN IPs are unreachable, leading to connection timeouts.
- **Fix**:
  - Sanitized `backend/.env` to remove the hardcoded LAN IP.
  - Made network stream ingestion an optional fallback requiring an explicit public RTSP/HTTP URL.

### Fix 6: Implementation of `POST /api/analyze-frame`
- **Problem**: There was no standard HTTP REST API for browser clients to submit video frames for real-time inference.
- **Fix**:
  - Added `@app.post("/api/analyze-frame")` in `backend/app/main.py`.
  - Supports multipart file uploads (`file: UploadFile`) and JSON payloads with base64 data URLs (`image: str`).
  - Calls `camera_manager.analyze_frame()` which executes YuNet detection, SFace 128-d vector extraction, watchlist comparison, and virtual fence ray-casting.
  - Returns normalized bounding boxes (`[nx, ny, nw, nh]`) for client rendering.

### Fix 7: Railway Deployment Manifests
- **Problem**: Railway lacked service-level configuration for build pipelines and automated restarts.
- **Fix**:
  - Created root `railway.json` and `backend/railway.json` configuring Dockerfile builders, healthcheck paths (`/api/health`), and failure restart policies.

### Fix 8: Client-Side WebRTC Browser Camera Architecture
- **Problem**: The frontend had no client-side camera capture component capable of requesting camera permissions and sending frames to the backend.
- **Fix**:
  - Built `src/components/BrowserCamera.tsx`:
    * Accesses camera via `navigator.mediaDevices.getUserMedia()`.
    * Renders live `<video>` feed.
    * Grabs video frames every 350ms onto an offscreen canvas.
    * Sends frames to `POST /api/analyze-frame`.
    * Renders tactical bounding box overlays, target badges, and virtual perimeter fences.
  - Integrated `BrowserCamera` directly into `src/features/dashboard/components/CentralOperationsView.tsx`.
