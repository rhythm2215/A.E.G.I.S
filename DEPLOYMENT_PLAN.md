# 🚀 A.E.G.I.S. Railway Cloud Deployment Plan

**Autonomous Enhanced Geographic Intelligence System (A.E.G.I.S.)**  
*Cloud-Native Military-Grade Computer Vision & Border Surveillance Platform*

---

## 1. Executive Summary & Architecture

The A.E.G.I.S. platform has been refactored from a local hardware-dependent architecture to a **cloud-native, headless microservice architecture** fully optimized for deployment on [Railway](https://railway.app).

All dependencies on physical server-side cameras (`cv2.VideoCapture(0)`, `/dev/video0`, local webcam drivers) have been removed. Instead, the application implements a modern **browser-based camera streaming architecture** (mirroring Google Meet / Zoom):
- The browser client captures video frames via `navigator.mediaDevices.getUserMedia()`.
- Every 250–300ms, frames are ingested by the FastAPI backend via `POST /api/analyze-frame`.
- Inference runs server-side on OpenCV DNN using pre-trained ONNX models (**YuNet** for face landmark detection + **SFace** for 128-dimensional biometric embeddings).
- Recognition results (authorized personnel vs. watchlist suspects vs. unknown individuals), threat classifications, and virtual fence perimeter breaches are returned in real time as structured JSON.
- The React frontend renders high-precision tactical overlays directly over the live video.

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT BROWSER                       │
│  navigator.mediaDevices.getUserMedia()                 │
│  Live 1080p Video + High-Tech Tactical SVG/Canvas HUD   │
└──────────────────────────┬─────────────────────────────┘
                           │
       Frame (Blob / base64) every 250-350ms
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               RAILWAY BACKEND SERVICE                  │
│  FastAPI + Uvicorn ($PORT dynamic binding, 0.0.0.0)   │
│  POST /api/analyze-frame                               │
│  ├── YuNet ONNX Face Detection (720p inference)       │
│  ├── SFace ONNX 128-d Biometric Extraction             │
│  ├── Personnel DB (Authorized, Cyan reticle)           │
│  ├── Watchlist DB (Target Match, Red reticle)          │
│  ├── Virtual Fence Ray-Casting Breach Engine           │
│  └── WebSocket Telemetry Broker (/ws/telemetry)        │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             RAILWAY POSTGRESQL PLUGIN                  │
│  Managed database auto-injects DATABASE_URL            │
└────────────────────────────────────────────────────────┘
```

---

## 2. Service Breakdown & Topology

| Service | Technology | Railway Deployment Method | Port / Exposure |
|---|---|---|---|
| **Backend** | Python 3.11, FastAPI, Uvicorn, OpenCV DNN | Dockerfile (`backend/Dockerfile`) | Dynamic `$PORT` (auto-bound to 0.0.0.0) |
| **Frontend** | React 19, TypeScript, Vite, Nginx | Dockerfile (`Dockerfile`) | Dynamic `$PORT` via `envsubst` template |
| **Database** | PostgreSQL 15 | Railway Database Plugin | Port 5432 (Internal private network) |
| **Storage** | MinIO / S3 or Railway Volume | Railway Volume or Cloudflare R2 | Storage mount for `/app/uploads` |

---

## 3. Environment Variables Configuration

### Backend Service Variables
Configure the following in the Railway Dashboard under the **backend** service:

| Variable | Recommended Value | Description |
|---|---|---|
| `PORT` | Auto-injected by Railway | Port assigned by Railway |
| `CAMERA_SOURCE` | `browser` | Sets ingest mode to browser-first architecture |
| `MIN_MATCH_CONFIDENCE` | `0.80` | Minimum cosine similarity confidence |
| `SFACE_THRESHOLD` | `0.38` | SFace cosine distance rejection threshold |
| `AI_SCAN_INTERVAL_FRAMES` | `2` | Interval for frame processing |
| `FRAME_RESIZE_SCALE` | `0.5` | Downscale factor for auxiliary processing |
| `DATABASE_URL` | Auto-injected by Postgres Plugin | PostgreSQL connection string |
| `PYTHONUNBUFFERED` | `1` | Forces realtime Python stdout/stderr logging |

### Frontend Service Variables
Configure the following in the Railway Dashboard under the **frontend** service:

| Variable | Recommended Value | Description |
|---|---|---|
| `PORT` | Auto-injected by Railway | Port assigned by Railway |
| `VITE_API_URL` | `https://<your-backend>.up.railway.app` | Backend public HTTPS URL |
| `VITE_WS_URL` | `wss://<your-backend>.up.railway.app/ws` | Backend public WSS WebSocket URL |

---

## 4. Step-by-Step Railway Deployment Guide

### Step 1: Install Railway CLI & Authenticate
```bash
npm install -g @railway/cli
railway login
```

### Step 2: Initialize Project in Repository Root
Navigate to the project root:
```bash
cd "c:\Users\work\Desktop\web\Boarder patroling"
railway init
```
Select **"Create new project"** and name it `aegis-intelligence-platform`.

### Step 3: Provision PostgreSQL Database
In the Railway Web Dashboard:
1. Click **+ New** → **Database** → **Add PostgreSQL**.
2. Railway creates a managed PostgreSQL instance and exposes `DATABASE_URL` inside your private environment.

### Step 4: Deploy the FastAPI Backend
Deploy using the Railway CLI or connect your GitHub repository:
```bash
# Deploy backend directory
railway up --service backend --source ./backend
```
*In the Railway Dashboard under Backend Service Settings:*
- Set **Root Directory** to `backend`.
- Set **Dockerfile Path** to `Dockerfile`.
- Set **Healthcheck Path** to `/api/health`.
- Set **Healthcheck Timeout** to `100` seconds.
- Click **Generate Domain** under Networking to get your public backend URL (e.g., `https://backend-production-xxxx.up.railway.app`).

### Step 5: Deploy the React Frontend
Deploy the frontend service:
```bash
# Deploy root directory
railway up --service frontend --source .
```
*In the Railway Dashboard under Frontend Service Settings:*
- Set **Root Directory** to `/`.
- Set **Dockerfile Path** to `Dockerfile`.
- Under **Variables**, add:
  - `VITE_API_URL` = `https://<backend-domain>.up.railway.app`
  - `VITE_WS_URL` = `wss://<backend-domain>.up.railway.app/ws`
- Click **Generate Domain** under Networking to expose your frontend publicly.

---

## 5. Verification & Healthchecks

Once both services are deployed, verify the endpoints:

1. **System Health Check**:
   ```bash
   curl -s https://<backend-domain>.up.railway.app/api/health
   ```
   **Expected Response:**
   ```json
   {
     "status": "OPERATIONAL",
     "system": "A.E.G.I.S. Command Node #01",
     "camera_source": "browser",
     "ai_vision_pipeline": "YUNET_SFACE_ACTIVE",
     "telemetry_broker": "ACTIVE",
     "deployment_platform": "RAILWAY_READY"
   }
   ```

2. **Frame Analysis Endpoint**:
   ```bash
   curl -X POST https://<backend-domain>.up.railway.app/api/analyze-frame \
     -F "file=@test_face.jpg"
   ```
   **Expected Response:** JSON with `success: true`, bounding boxes, classifications, and confidence.

3. **Telemetry WebSocket**:
   Connect via browser or wscat to `wss://<backend-domain>.up.railway.app/ws/telemetry`.
   Receives continuous simulated UAV drone telemetry and alarm broadcasts.

---

## 6. Zero-Downtime Rollback & Maintenance

- If a deployment fails health checks, Railway retains the previous healthy replica.
- Railway's restart policy in `railway.json` is set to `ON_FAILURE` with a maximum of 3 retries.
- Personnel, suspect, and vehicle biometric databases are persisted in `backend/data/` (mount a persistent Railway Volume at `/app/data` and `/app/uploads` to preserve enrolled faces across redeployments).
