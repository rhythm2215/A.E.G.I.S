# A.E.G.I.S. Complete Architecture

This document describes how the A.E.G.I.S. project currently works, from opening
the Windows launcher through the React interface, FastAPI services, image
enrollment, face-vector storage, live recognition, video overlays, and alert
delivery.

The description is based on the files and runtime assets currently present in
the workspace. It distinguishes implemented behavior from UI placeholders and
from services declared in Docker but not wired into the application code.

## 1. System Summary

A.E.G.I.S. is a two-process local surveillance dashboard:

1. A React/Vite frontend runs on port `5173`.
2. A FastAPI/Uvicorn backend runs on port `8000`.
3. The backend reads one configured camera source through OpenCV.
4. The backend runs face detection and face recognition in background threads.
5. Suspect metadata is stored in `backend/data/suspects_db.json`.
6. Face embeddings are stored in `backend/data/vectors/*.npy`.
7. Uploaded reference images are stored in `backend/uploads/*.jpg`.
8. The live video is returned as an HTTP multipart MJPEG stream.
9. Telemetry and recognition alerts are delivered through a WebSocket.
10. The frontend keeps most operational state in Zustand stores.

The local `.bat` launcher is the path that is most closely connected to the
current source code. The Docker setup provisions additional PostgreSQL and
MinIO services, but the current Python code does not use them for suspect
metadata, vectors, images, or alerts.

## 2. What Happens When `AEGIS.bat` Is Opened

### 2.1 Windows launcher sequence

`AEGIS.bat` is a two-line wrapper:

```bat
@echo off
call "%~dp0launch_aegis.bat"
```

`%~dp0` means the directory containing the batch file. The wrapper calls
`launch_aegis.bat` from the same project directory.

`launch_aegis.bat` then performs these steps:

1. Sets the console title and clears the console.
2. Sets `PROJECT_ROOT` to the directory containing the launcher.
3. Changes the current directory to `PROJECT_ROOT`.
4. Tries to activate `backend\venv\Scripts\activate.bat`.
5. If that does not exist, tries `.venv\Scripts\activate.bat`.
6. Starts a new backend console window.
7. Starts a new frontend console window.
8. Waits exactly four seconds.
9. Opens Chrome in application mode at `http://localhost:5173`.

The exact server commands are:

```bat
cd /d "<project>\backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
cd /d "<project>" && npm run dev
```

The launcher does not install Python or Node dependencies, download ONNX
models, verify that either server is ready, or verify that a camera can be
opened. The four-second delay is only a fixed startup wait.

### 2.2 Backend boot sequence

Uvicorn imports `app.main:app` from the `backend` directory. During that
import:

1. `main.py` imports `camera_manager` from `app.services.camera`.
2. `camera.py` calls `load_dotenv()` and reads camera-related environment
   settings.
3. It calculates paths for models, uploads, JSON data, and vectors.
4. It conditionally loads the SFace and YuNet ONNX models through OpenCV.
5. It loads the OpenCV Haar cascade fallback when available.
6. It creates the `CameraStreamManager` singleton at the bottom of the file.
7. The singleton loads suspect metadata and vector files from disk.
8. The singleton starts a 30-FPS capture thread.
9. The singleton starts a separate AI inference worker thread.
10. `main.py` creates the FastAPI application and registers routes.
11. `main.py` registers the camera alert callback with the WebSocket manager.
12. On FastAPI startup, the WebSocket manager stores the active asyncio event
    loop so camera threads can broadcast alerts safely.

The camera manager starts while the module is being imported, before the first
HTTP request. If `CAMERA_SOURCE=0` and no camera is available, the capture loop
keeps retrying and the backend generates a standby frame instead of exiting.

### 2.3 Frontend boot sequence

After `npm run dev`, Vite serves `index.html`. The browser then:

1. Loads `/src/main.tsx`.
2. Creates a React root at the element with `id="root"`.
3. Renders the app inside `React.StrictMode`.
4. Creates a TanStack Query client in `src/app/App.tsx`.
5. Mounts `QueryClientProvider`.
6. Mounts the React Router provider.
7. Resolves `/` to `AppShell` containing `DashboardPage`.
8. `AppShell` calls `useSuspectStore().fetchSuspects()` on mount.
9. The suspect store requests `GET /api/suspects`.
10. The dashboard's `CentralOperationsView` opens the telemetry WebSocket.
11. The camera view uses an `<img>` pointed at `/api/video/feed`.

The Vite development server proxies relative `/api`, `/ws`, and `/uploads`
requests to `localhost:8000`. Some frontend code also uses absolute
`http://localhost:8000` URLs directly.

### 2.4 What the operator sees

The default `/` route renders a full-bleed dashboard containing:

- A fixed top navigation bar.
- A left column with drone, suspect, and timeline panels.
- A center map or live camera workspace.
- A right column with alerts and intelligence details.
- A draggable picture-in-picture preview of the other center view.
- Resizable sidebars and vertical panel splits.

The initial frontend stores contain mock data. The suspect store attempts to
replace its mock suspects with backend data during hydration. The drone,
notification, timeline, and playback features remain primarily mock-driven.

## 3. Alternative Docker Startup

The batch launcher does not call Docker. Docker can be started separately with:

```bash
docker compose up --build
```

The Compose file declares these services:

| Service | Purpose | Port |
| --- | --- | --- |
| `frontend` | Builds the React app and serves static files through Nginx | `5173` |
| `backend` | Runs FastAPI/Uvicorn | `8000` |
| `postgres` | PostgreSQL 15 container | `5432` |
| `minio` | S3-compatible object storage | `9000`, `9001` |

The current Docker path has important differences from the local path:

- The frontend image is static Nginx, not the Vite development server.
- `nginx.conf` currently serves files and performs SPA fallback only. It does
  not proxy `/api`, `/ws`, or `/uploads` to the backend.
- `VITE_API_URL` and `VITE_WS_URL` are declared in Compose but are not read by
  the current frontend code.
- The declared WebSocket value uses `/ws`, while the backend route is
  `/ws/telemetry`.
- The frontend WebSocket client hardcodes `ws://localhost:8000/ws/telemetry`.
- The frontend upload page hardcodes `http://localhost:8000/api/suspects`.
- No camera device mapping is declared for the backend container. With
  `CAMERA_SOURCE=0`, the container normally cannot access a host webcam.
- The backend container does not declare a volume for `backend/data` or
  `backend/uploads`, so container recreation can lose runtime suspect data.
- Compose creates PostgreSQL and MinIO, but no current backend module connects
  to either service.
- `face_recognition` may require native build prerequisites that are not
  installed by the minimal backend Dockerfile.

Therefore, the local `.bat` path and the Compose path should not be treated as
equivalent deployments without additional wiring.

## 4. Technology and Library Stack

### 4.1 Frontend libraries

| Library | Current role |
| --- | --- |
| React 19 | Component rendering and UI state integration |
| React DOM | Browser root mounting |
| Vite 6 | Development server and production build tool |
| TypeScript | Static typing and project compilation |
| React Router | Route and page navigation |
| Zustand | Runtime stores for suspects, drones, alerts, layout, selection, and UI |
| TanStack React Query | Query client provider is created, but current data calls use direct `fetch` |
| Tailwind CSS | Utility styling and design tokens |
| PostCSS and Autoprefixer | CSS processing |
| Framer Motion | Dashboard picture-in-picture dragging and transitions |
| Lucide React | Icon set |
| Recharts | Declared chart library; not central to the current live recognition path |
| Mapbox GL | Declared dependency; the current central map is a static simulated map rather than an active Mapbox map |
| `clsx` and `tailwind-merge` | Class-name composition in `src/lib/utils.ts` |

### 4.2 Backend libraries

| Library | Current role |
| --- | --- |
| FastAPI | HTTP API, file upload handling, WebSocket route, streaming response |
| Uvicorn | ASGI server launched by the batch file and Dockerfile |
| Python multipart support | Parses `multipart/form-data` image registration requests |
| `python-dotenv` | Loads `backend/.env` values |
| OpenCV Python (`cv2`) | Camera access, image decoding/resizing, ONNX face detection/recognition APIs, drawing, JPEG encoding, Haar fallback |
| NumPy | Image buffers and face embedding arrays; `.npy` persistence |
| OpenCV FaceDetectorYN | YuNet face detection API |
| OpenCV FaceRecognizerSF | SFace alignment, feature extraction, and cosine matching API |
| `face_recognition` | Optional dlib-backed fallback for face locations and encodings |
| Pillow, Requests, Websockets | Listed in requirements; not central to the current camera pipeline |

### 4.3 Direct answer: which facial-recognition library is called?

The primary facial-recognition implementation is OpenCV's DNN face pipeline:

1. YuNet is loaded through `cv2.FaceDetectorYN` using
   `face_detection_yunet_2023mar.onnx`.
2. SFace is loaded through `cv2.FaceRecognizerSF` using
   `face_recognition_sface_2021dec.onnx`.
3. SFace produces the face feature vector and compares known and live vectors
   with cosine similarity.

The separately installed Python package named `face_recognition` is a fallback,
not the primary path when SFace is successfully initialized. It uses dlib's
HOG face detector and face encoding functions when the SFace path is not
available. OpenCV's Haar cascade is another detector fallback.

The Settings screen displays a text value mentioning `YOLOv10 + InsightFace`,
but the current backend does not import or run YOLOv10 or InsightFace.

## 5. Full Project Tree

This is the project-owned source and runtime tree. `node_modules` is an
installed dependency tree and is intentionally collapsed because it contains
third-party package internals rather than A.E.G.I.S. implementation files.
Generated Python bytecode and TypeScript build metadata are shown separately.

```text
drone project web/
├── .agents/
│   └── rules/
│       └── drone-project.md
├── backend/
│   ├── app/
│   │   ├── __pycache__/
│   │   │   └── main.cpython-312.pyc
│   │   ├── main.py
│   │   └── services/
│   │       ├── __pycache__/
│   │       │   └── camera.cpython-312.pyc
│   │       └── camera.py
│   ├── data/
│   │   ├── suspects_db.json
│   │   └── vectors/
│   │       ├── SUS-108.npy
│   │       └── SUS-534.npy
│   ├── models/
│   │   ├── face_detection_yunet_2023mar.onnx
│   │   └── face_recognition_sface_2021dec.onnx
│   ├── uploads/
│   │   ├── SUS-108.jpg
│   │   ├── SUS-143.jpg
│   │   ├── SUS-165.jpg
│   │   ├── SUS-438.jpg
│   │   ├── SUS-482.jpg
│   │   ├── SUS-534.jpg
│   │   ├── SUS-540.jpg
│   │   ├── SUS-559.jpg
│   │   ├── SUS-571.jpg
│   │   ├── SUS-612.jpg
│   │   ├── SUS-620.jpg
│   │   ├── SUS-689.jpg
│   │   ├── SUS-810.jpg
│   │   ├── SUS-857.jpg
│   │   ├── SUS-867.jpg
│   │   ├── SUS-870.jpg
│   │   ├── SUS-911.jpg
│   │   └── SUS-986.jpg
│   ├── .env
│   ├── Dockerfile
│   └── requirements.txt
├── node_modules/
│   └── installed frontend dependencies; contents intentionally collapsed
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── core/
│   │   └── components/
│   │       └── AppShell/
│   │           ├── AppShell.tsx
│   │           └── TopNavBar.tsx
│   ├── features/
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── CentralOperationsView.tsx
│   │   │   │   ├── DetailPanel.tsx
│   │   │   │   ├── DronePanel.tsx
│   │   │   │   ├── EntityPanel.tsx
│   │   │   │   ├── NotificationPanel.tsx
│   │   │   │   ├── SuspectPanel.tsx
│   │   │   │   └── TimelinePanel.tsx
│   │   │   └── DashboardPage.tsx
│   │   ├── drones/
│   │   │   └── AddDronePage.tsx
│   │   ├── notifications/
│   │   │   └── NotificationsPage.tsx
│   │   ├── playback/
│   │   │   └── PlaybackPage.tsx
│   │   ├── records/
│   │   │   ├── AddSuspectPage.tsx
│   │   │   ├── RecordDetailPage.tsx
│   │   │   └── RecordsPage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   ├── lib/
│   │   └── utils.ts
│   ├── services/
│   │   ├── mock/
│   │   │   └── mockData.ts
│   │   └── websocket/
│   │       └── useTelemetryWebSocket.ts
│   ├── store/
│   │   ├── droneStore.ts
│   │   ├── layoutStore.ts
│   │   ├── notificationStore.ts
│   │   ├── selectionStore.ts
│   │   ├── suspectStore.ts
│   │   └── uiStore.ts
│   ├── types/
│   │   └── index.ts
│   ├── index.css
│   └── main.tsx
├── AEGIS.bat
├── complete_architecture.md
├── docker-compose.yml
├── Dockerfile
├── index.html
├── launch_aegis.bat
├── nginx.conf
├── package-lock.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.node.tsbuildinfo
├── tsconfig.tsbuildinfo
├── vite.config.d.ts
├── vite.config.js
└── vite.config.ts
```

## 6. Core File Responsibilities

### 6.1 Backend application

#### `backend/app/main.py`

- Creates the FastAPI application.
- Enables permissive CORS with `allow_origins=["*"]`.
- Serves `backend/uploads` at `/uploads` through `StaticFiles`.
- Creates `ConnectionManager` for active WebSocket clients.
- Registers camera recognition alerts with the WebSocket broadcast manager.
- Sets the asyncio event loop during FastAPI startup.
- Exposes the MJPEG endpoint at `GET /api/video/feed`.
- Exposes health information at `GET /api/health`.
- Returns two hardcoded drone objects from `GET /api/drones`.
- Returns live in-memory suspect details from `GET /api/suspects`.
- Resets suspect metadata and vectors through `POST /api/suspects/reset`.
- Accepts suspect name, alias, threat level, and image through
  `POST /api/suspects`.
- Deletes a suspect through `DELETE /api/suspects/{suspect_id}`.
- Emits simulated one-second drone telemetry through `WS /ws/telemetry`.

#### `backend/app/services/camera.py`

- Defines the `CameraStreamManager` singleton.
- Loads model and data paths.
- Initializes YuNet, SFace, and Haar fallback components.
- Loads and saves suspect metadata and vectors.
- Decodes uploaded images and creates enrollment vectors.
- Opens a webcam, URL, or RTSP-like camera source with OpenCV.
- Maintains a 30-FPS capture thread.
- Maintains a separate AI inference thread.
- Detects faces, extracts features, and matches the watchlist.
- Creates target and neutral detection records.
- Draws red target boxes, neutral boxes, labels, and HUD information.
- Encodes annotated frames as JPEG parts for the MJPEG response.
- Triggers throttled recognition alerts for WebSocket delivery.

#### `backend/app/__pycache__/` and `backend/app/services/__pycache__/`

These are generated Python bytecode directories, not source code. They contain
`.pyc` files generated by Python imports.

### 6.2 Backend data and assets

#### `backend/data/suspects_db.json`

Stores suspect metadata, including:

- Suspect ID and name.
- Threat level, aliases, status, and watchlist flag.
- Facial image URL and capture information.
- Recognition display confidence.
- Physical description.
- Assigned drones and tracking coordinates.
- Criminal history, investigations, associates, and notes.

The JSON intentionally excludes the NumPy `encodings` field. Embeddings are
stored separately in `.npy` files.

#### `backend/data/vectors/*.npy`

Stores one NumPy file per suspect ID. Each file contains one or more face
feature vectors produced by SFace or the dlib fallback. The vectors are loaded
into the in-memory watchlist at backend startup.

The current workspace contains `SUS-108.npy` and `SUS-534.npy`. Seed suspects
in the default seed dictionary have empty encoding lists, so they are visible
in the UI but cannot match live faces until vectors exist.

#### `backend/models/`

- `face_detection_yunet_2023mar.onnx`: YuNet face detector.
- `face_recognition_sface_2021dec.onnx`: SFace face feature extractor and
  matcher.

#### `backend/uploads/`

Contains reference photos written by suspect enrollment. The backend exposes
this directory publicly through `/uploads`.

#### `backend/.env`

Current values are:

```text
CAMERA_SOURCE=0
MIN_MATCH_CONFIDENCE=0.80
AI_SCAN_INTERVAL_FRAMES=2
FRAME_RESIZE_SCALE=0.5
```

`CAMERA_SOURCE` and `MIN_MATCH_CONFIDENCE` are used. The current implementation
does not use `AI_SCAN_INTERVAL_FRAMES` or `FRAME_RESIZE_SCALE`; it hardcodes
every fourth frame and a 360-pixel inference width.

#### `backend/requirements.txt`

Declares the FastAPI, Uvicorn, Pydantic, dotenv, NumPy, OpenCV, multipart,
websocket, Pillow, Requests, and `face_recognition` dependencies. The comments
note that `face_recognition` requires CMake and dlib installation support.

### 6.3 Frontend application shell and routing

#### `src/main.tsx`

Creates the browser React root, renders `App`, imports global CSS, and enables
React Strict Mode.

#### `src/app/App.tsx`

Creates a TanStack Query client and mounts `AppRouter` inside the provider.

#### `src/app/router.tsx`

Defines these routes:

| Route | Page |
| --- | --- |
| `/` | Dashboard |
| `/records` | Suspect records list |
| `/records/new` | Suspect enrollment form |
| `/records/:id` | Suspect detail dossier |
| `/drones/new` | Local drone registration form |
| `/playback` | Playback and forensic marker UI |
| `/notifications` | Alert log |
| `/settings` | Local settings UI |
| `*` | Redirect to `/` |

#### `src/core/components/AppShell/AppShell.tsx`

Provides the full-screen shell, top navigation, dashboard full-bleed mode, and
scrollable page mode. It also refreshes suspects from the backend on mount.

#### `src/core/components/AppShell/TopNavBar.tsx`

Provides branding, route links, live clock, unread-alert badge, panel visibility
menu, operational status display, and settings navigation.

### 6.4 Frontend features

#### `src/features/dashboard/DashboardPage.tsx`

Composes the live operations workspace. It renders the left and right panel
columns, central operations view, draggable sidebar-width handles, and
vertical panel splitters. Layout values come from `layoutStore`.

#### `src/features/dashboard/components/CentralOperationsView.tsx`

- Opens the telemetry WebSocket hook.
- Renders the simulated tactical map.
- Renders the live camera `<img>` using `/api/video/feed`.
- Provides map/camera switching and draggable picture-in-picture mode.
- Shows static map markers, geofence shapes, flight paths, and HUD controls.
- Displays live drone values from the drone store.

The map currently uses static CSS positions and external imagery. It does not
position markers from the stored geographic coordinates and does not currently
initialize Mapbox.

#### `src/features/dashboard/components/DronePanel.tsx`

Lists mock and newly added local drones, supports status filtering, selection,
and navigation to the local drone registration page.

#### `src/features/dashboard/components/SuspectPanel.tsx`

Lists suspects from the suspect store, displays reference thumbnails and threat
levels, and selects a suspect for the dashboard.

#### `src/features/dashboard/components/EntityPanel.tsx`

An older combined drone/suspect panel implementation. It provides similar
selection, filter, and add/link behavior to the separate current panels.

#### `src/features/dashboard/components/TimelinePanel.tsx`

Filters `mockTimelineEvents` by selected drone or suspect and by search text.
The time-range control is rendered but the current filter logic does not apply
the selected time range.

#### `src/features/dashboard/components/NotificationPanel.tsx`

Displays notifications from the notification store, filters by priority,
supports acknowledgement, and selects the related drone or suspect.

#### `src/features/dashboard/components/DetailPanel.tsx`

Displays selected drone telemetry or suspect intelligence details. It combines
the selection store with the drone and suspect stores.

#### `src/features/records/AddSuspectPage.tsx`

- Provides the suspect registration form.
- Validates that a name and image are present.
- Supports file selection and drag-and-drop.
- Creates a local preview using `URL.createObjectURL`.
- Sends a multipart request to `POST http://localhost:8000/api/suspects`.
- Sends only `full_name`, `alias`, `threat_level`, and `image` to the backend.
- Adds a locally constructed `Suspect` object to Zustand after the request.
- Shows whether the backend reported a face vector.
- Redirects to `/records` after a short delay.

The rest of the form fields are used to construct the temporary frontend object,
but they are not submitted to the current backend endpoint. The backend stores
its own default values for those fields.

If the backend request fails, the page intentionally continues in a local-only
session using a random suspect ID and the temporary browser preview URL.

#### `src/features/records/RecordsPage.tsx`

Fetches suspects, provides search and filters, displays the suspect table, and
offers backend delete and reset actions.

#### `src/features/records/RecordDetailPage.tsx`

Displays a selected suspect's dossier, image, physical description, tracking,
criminal intelligence, associates, and mock timeline. The criminal record and
timeline sections are sourced from `mockData`, not backend endpoints. It also
supports printing and deleting the suspect.

#### `src/features/drones/AddDronePage.tsx`

Creates a new drone object directly in the frontend Zustand store. It does not
call `POST /api/drones`, because that endpoint does not exist. The new drone is
lost on reload.

#### `src/features/playback/PlaybackPage.tsx`

Uses mock playback sessions, static thumbnails, simulated time progression,
event markers, and local playback controls. Referenced recording paths are not
served by the current backend and the player does not load the MP4 files.

#### `src/features/notifications/NotificationsPage.tsx`

Displays and filters notifications, supports acknowledgement and dismissal,
and exports the currently filtered in-memory notifications as a browser JSON
download.

#### `src/features/settings/SettingsPage.tsx`

Provides a visual settings form for general, dashboard, map, AI, notification,
user, and system sections. Current settings are local React state only. Saving
shows a confirmation but does not write configuration to the backend or disk.

### 6.5 Frontend services and stores

#### `src/services/mock/mockData.ts`

Contains mock drones, suspects, criminal records, notifications, timeline
events, and playback sessions. It is the initial data source for most frontend
stores and pages.

#### `src/services/websocket/useTelemetryWebSocket.ts`

- Connects to `ws://localhost:8000/ws/telemetry`.
- Reconnects after three seconds when the connection closes.
- Updates `droneStore` from `TELEMETRY_UPDATE` messages.
- Converts `TARGET_MATCH` messages into critical notifications.
- Does not persist WebSocket events.

#### `src/store/suspectStore.ts`

Stores suspects and the selected suspect. It fetches backend suspects, adds
local suspects, updates local records, calls backend deletion, and resets the
backend database. It starts a fetch during browser startup.

#### `src/store/droneStore.ts`

Stores mock and locally added drones, selected drone, filter state, linked drone
IDs, and telemetry updates received from the WebSocket.

The frontend does not fetch `GET /api/drones`, so the backend's two-drone response
is not currently the source of the dashboard fleet list.

#### `src/store/notificationStore.ts`

Stores initial mock notifications plus live target-match notifications. It
supports filtering, acknowledgement, read state, dismissal, and unread counts.

#### `src/store/selectionStore.ts`

Coordinates entity selection across the drone, suspect, and UI stores. Selecting
an entity updates the active type, ID, detail panel, map selection, and timeline
mode.

#### `src/store/layoutStore.ts`

Stores sidebar widths and panel split ratios. It clamps widths and persists the
layout under `localStorage` key `aegis_panel_layout_v1`.

#### `src/store/uiStore.ts`

Stores active map/camera view, panel visibility, timeline mode, map selection,
filter-menu state, and the playback store. The playback store is colocated in
this file and uses mock playback sessions.

#### `src/types/index.ts`

Defines shared TypeScript interfaces and unions for drones, suspects, facial
images, criminal records, missions, timeline events, notifications, playback,
settings, users, coordinates, and panel visibility.

#### `src/lib/utils.ts`

Provides class-name merging, timestamp/date/duration formatting, status and
threat color mapping, priority styling, coordinate formatting, and relative-time
formatting.

#### `src/index.css`

Defines Tailwind layers and the Obsidian Aegis design system: tactical glass
surfaces, HUD effects, semantic colors, buttons, panels, inputs, telemetry
readouts, typography helpers, and scan-line effects.

### 6.6 Root configuration files

#### `package.json` and `package-lock.json`

Define the frontend project, scripts, exact dependency lock state, and the
`dev`, `build`, `lint`, and `preview` commands.

#### `vite.config.ts`

Configures React support, the `@` alias to `src`, port `5173`, and development
proxies for `/api`, `/ws`, and `/uploads` to port `8000`.

#### `vite.config.js` and `vite.config.d.ts`

Generated/compiled companion files for the TypeScript Vite configuration.

#### `index.html`

Defines the browser document, dark mode class, metadata, page title, Google font
links, root element, and `/src/main.tsx` module entrypoint.

#### `tailwind.config.js`

Defines the Aegis color palette, typography, spacing, shadows, animations,
rounded corners, and content scanning paths.

#### `postcss.config.js`

Enables Tailwind CSS and Autoprefixer.

#### `tsconfig.json`

Configures strict TypeScript compilation for `src`, ES2020 browser libraries,
the `@/*` path alias, no emitted JavaScript, and the Vite config project
reference.

#### `tsconfig.node.json`

Configures strict TypeScript checking for `vite.config.ts` and composite build
metadata.

#### `tsconfig.tsbuildinfo` and `tsconfig.node.tsbuildinfo`

Generated TypeScript incremental-build metadata.

#### Root `Dockerfile`

Uses a Node 20 build stage to install dependencies and build the frontend, then
copies `dist` into an Nginx Alpine image.

#### `backend/Dockerfile`

Uses Python 3.11 Slim, installs `requirements.txt`, copies the backend, and
starts Uvicorn on `0.0.0.0:8000`.

#### `docker-compose.yml`

Declares the frontend, backend, PostgreSQL, and MinIO containers plus named
PostgreSQL and MinIO volumes. The current backend implementation does not use
the database or object-storage services.

#### `nginx.conf`

Serves the built frontend on port `5173` and uses `try_files` for client-side
route fallback. It currently has no backend reverse-proxy locations.

#### `.agents/rules/drone-project.md`

Contains always-on design and implementation guidance for the project, covering
visual hierarchy, enterprise dashboard patterns, accessibility, responsive
behavior, component consistency, and design-system usage.

## 7. Backend API and Transport Paths

| Method/path | Behavior |
| --- | --- |
| `GET /api/health` | Returns backend status, camera source, AI status, and telemetry status |
| `GET /api/drones` | Returns two hardcoded partial drone records |
| `GET /api/suspects` | Returns in-memory suspects transformed for the React UI |
| `POST /api/suspects` | Accepts suspect form fields plus image, computes vector, persists files, and hot-injects the watchlist |
| `DELETE /api/suspects/{id}` | Removes suspect memory, JSON metadata, vector file, and `<id>.jpg` when present |
| `POST /api/suspects/reset` | Deletes vector files and restores the three default seed profiles |
| `GET /api/video/feed` | Streams annotated JPEG frames as multipart MJPEG |
| `GET /uploads/{file}` | Serves uploaded image files publicly |
| `WS /ws/telemetry` | Sends one-second simulated telemetry and receives broadcast target-match alerts |

## 8. Suspect Data and Persistence Model

### 8.1 In-memory representation

The camera manager keeps a dictionary like:

```text
self.suspect_db[suspect_id] = {
    "fullName": "...",
    "threatLevel": "...",
    "facialImages": [...],
    "tracking": {...},
    "intelligence": {...},
    "encodings": [numpy_vector_1, numpy_vector_2, ...]
}
```

The `encodings` list is used for recognition and is not written to the JSON
metadata file.

### 8.2 Startup load from disk

`_load_suspects_from_disk()` performs this process:

1. Reads `backend/data/suspects_db.json`.
2. Copies each suspect metadata object into a new in-memory object.
3. Initializes that object's `encodings` list as empty.
4. Looks for `backend/data/vectors/<suspect_id>.npy`.
5. Loads the NumPy array with `np.load(..., allow_pickle=True)`.
6. Converts a one-dimensional array into a one-item encoding list.
7. Converts a multi-dimensional array into a list of encoding rows.
8. Assigns the completed dictionary to `self.suspect_db`.

If the JSON file is absent or cannot be parsed, the manager loads
`DEFAULT_SEED_SUSPECTS` and writes seed metadata to disk.

### 8.3 New suspect persistence

When a new suspect is enrolled successfully:

1. The original uploaded bytes are written to
   `backend/uploads/<suspect_id>.jpg`.
2. The generated vector list is written to
   `backend/data/vectors/<suspect_id>.npy` if non-empty.
3. All current suspect metadata is written to `suspects_db.json`.
4. The `encodings` key is removed before JSON serialization.

The extension is always `.jpg` even if the original upload was PNG or WEBP.

### 8.4 Delete and reset behavior

Delete removes:

- The suspect from `self.suspect_db`.
- The matching `.npy` vector file.
- The matching `<suspect_id>.jpg` upload when present.
- The suspect metadata from `suspects_db.json`.

Reset removes all `.npy` files and restores only the three default seed profiles
to the JSON file. The reset implementation does not remove old uploaded images,
despite the UI wording saying that uploaded suspects are purged.

### 8.5 What is and is not a persistent record

Persistent backend data:

- Suspect metadata in JSON.
- Face vectors in NumPy files.
- Uploaded reference images in the uploads directory.

Not currently persisted:

- Frontend alert history.
- Frontend drone registration.
- Frontend settings.
- Frontend playback position.
- Frontend offline-only suspect registrations.
- Live recognition alerts and timeline events.
- Criminal records and playback files.

The only frontend state persisted in browser storage is the resizable dashboard
layout.

## 9. Image Upload and Enrollment Flow

The complete enrollment flow is:

```text
Operator selects image in React
        |
        v
AddSuspectPage creates local preview and FormData
        |
        | POST /api/suspects
        v
FastAPI validates MIME type and minimum size
        |
        v
CameraStreamManager decodes bytes with OpenCV
        |
        +--> saves original bytes to backend/uploads/SUS-XXX.jpg
        |
        +--> resizes image to maximum dimension 640
        |
        v
extract_face_vector()
        |
        +--> YuNet + SFace when available
        +--> Haar crop + SFace fallback
        +--> SFace center crop fallback
        +--> face_recognition/dlib fallback when SFace unavailable
        |
        v
Builds suspect metadata and in-memory encodings list
        |
        +--> saves metadata to backend/data/suspects_db.json
        +--> saves vectors to backend/data/vectors/SUS-XXX.npy
        +--> keeps vector in live self.suspect_db
        |
        v
Returns suspectId, faceEnrolled, and status message
        |
        v
React adds a local Suspect object and redirects to /records
```

### 9.1 Frontend request details

The page sends only:

```text
full_name
alias
threat_level
image
```

The UI's age, gender, nationality, status, physical description, drone
assignment, criminal history, and notes are not included in the current
multipart request. They are used to build a temporary frontend object after the
request returns.

If the backend returns normally, the page uses the backend-generated ID and
`faceEnrolled` value. If the backend is offline or returns an error, the page
falls back to a random local ID and reports a local-session registration.

### 9.2 Backend validation

`main.py` rejects the request when:

- The uploaded MIME type does not start with `image/`.
- The uploaded byte length is less than 1024 bytes.

The backend then generates a random `SUS-100` through `SUS-999` identifier and
retries until it does not collide with an in-memory suspect ID.

### 9.3 Enrollment vector extraction

`add_suspect_with_encoding()` performs these image operations:

1. Converts upload bytes to a NumPy byte array.
2. Decodes the bytes to a BGR OpenCV image with `cv2.imdecode`.
3. Saves the original bytes to the uploads directory.
4. Resizes large images so the largest dimension is at most 640 pixels.
5. Calls `extract_face_vector()`.

When SFace is available, `extract_face_vector()` first creates a private YuNet
detector for the upload. The private detector prevents the upload request from
racing the shared live-stream detector. It detects the first face, aligns it
with `alignCrop`, and calls SFace `feature()` to produce the feature vector.

If that path fails, the function tries an OpenCV Haar face crop followed by an
112x112 resize and SFace feature extraction. If that also fails, it uses a
center crop resized to 112x112 and sends it directly to SFace. This last path
can produce a vector even when the image does not contain a detectable face.

If SFace is unavailable but the optional `face_recognition` import succeeded,
the function converts BGR to RGB, runs dlib HOG face location, and calls
`face_recognition.face_encodings()` for the first face.

The API always returns `success: true` after the suspect object is created. The
`faceEnrolled` field reports whether the vector list was non-empty, so a record
can exist without a recognized face vector.

## 10. How Live Facial Recognition Works

Face recognition has two distinct stages:

1. Face detection finds rectangular face regions in a frame.
2. Face identification converts each region to a numeric embedding and compares
   it with enrolled suspect embeddings.

The system does not compare raw uploaded pixels directly. It compares feature
vectors generated by the recognition model.

### 10.1 Camera source initialization

`CAMERA_SOURCE` defaults to `0`, which means the default local webcam. It can
also be a string camera URL. On Windows, the backend tries DirectShow, then
Media Foundation, then the default OpenCV backend for integer camera sources.

On success it requests:

- 1280 by 720 frame size.
- 30 FPS.
- A camera buffer size of one.

On failure it generates a 1280 by 720 standby image and retries.

### 10.2 Capture thread

The `_capture_loop` runs continuously:

1. Opens or reopens the camera.
2. Reads a raw frame.
3. Increments the frame counter.
4. Every fourth frame, if the AI worker is not busy, copies a frame into
   `_latest_raw_frame` for inference.
5. Reads the most recent cached detections.
6. Draws those detections onto the current frame.
7. Stores the annotated frame in `_annotated_frame`.
8. Sleeps approximately 30 milliseconds.

This decouples video display from slower AI work. The video can continue using
the latest known boxes while the AI worker analyzes another frame.

The environment value `AI_SCAN_INTERVAL_FRAMES=2` is currently ignored; the
source code uses `frame_idx % 4 == 0`.

### 10.3 AI worker thread

The `_ai_worker_loop` continuously checks for a pending raw frame:

1. Takes `_latest_raw_frame` under the manager lock.
2. Marks the worker busy.
3. Runs `_run_ai_inference()`.
4. Replaces `_cached_detections` with the new result.
5. Marks the worker available again.

The shared OpenCV YuNet and SFace objects are protected by `_yunet_lock`, since
OpenCV DNN objects are treated as not thread-safe.

### 10.4 Frame detection and feature extraction

`_run_ai_inference()`:

1. Records the original frame width and height.
2. Downscales the frame to a fixed width of 360 pixels.
3. Runs YuNet on the smaller frame when initialized.
4. Converts YuNet face boxes back to original-frame coordinates.
5. Aligns each detected face with SFace when possible.
6. Uses a Haar cascade if YuNet finds no faces.
7. Produces one crop and one face box for each detected face.

The configured `FRAME_RESIZE_SCALE=0.5` is currently ignored. The implementation
uses the hardcoded 360-pixel width instead.

### 10.5 Watchlist matching

For every detected face crop:

1. SFace `feature()` creates the live face vector, or dlib creates a fallback
   encoding when SFace is unavailable.
2. `_match_suspect()` copies the current suspect dictionary under a lock.
3. Suspects with no loaded `encodings` are skipped.
4. Every known vector for every remaining suspect is compared with the live
   vector.
5. SFace uses `cv2.FaceRecognizerSF_FR_COSINE` cosine similarity.
6. The best suspect/vector score is retained.
7. A SFace score of at least `0.33` is considered a positive match.
8. The score is normalized to a display confidence between `0.80` and `0.99`.

The dlib fallback uses a distance cutoff of `0.58`, then converts an accepted
distance into a similarity value.

There are two different thresholds in the current code:

- `sface_cosine_threshold = 0.33` controls whether SFace considers a face a
  match.
- `MIN_MATCH_CONFIDENCE`, defaulting to `0.75` in code and set to `0.80` in
  `.env`, controls whether an accepted match emits an alert.

### 10.6 Detection result and overlay state

For a positive match, the worker creates a detection object containing:

```text
box
is_target: true
suspect_id
name
threat
confidence
```

The capture thread draws a red tactical box and a target label containing the
suspect ID, name, threat, and confidence.

For a detected but unmatched face, it creates a neutral detection with
`is_target: false` and draws a cyan/yellow scanned-node box.

If no face is found for a short period, the last matched target can be returned
for up to 1.2 seconds to reduce flicker. Alert generation has a three-second
per-suspect cooldown.

The system does not currently maintain a separate multi-frame identity tracker;
it re-runs recognition on sampled frames and reuses cached detections between
AI updates.

### 10.7 Seed profiles and current vectors

The three default seed profiles are defined in `DEFAULT_SEED_SUSPECTS`, but
their `encodings` arrays are empty. Matching skips them. The current dynamic
JSON entries and frontend mock entries also do not perfectly match:

- The frontend mock data includes `SUS-127`, `SUS-212`, `SUS-431`, and `SUS-582`.
- The current backend JSON includes `SUS-127`, `SUS-212`, `SUS-431`, `SUS-534`,
  and `SUS-108`.
- The current vector directory contains `SUS-108.npy` and `SUS-534.npy`.
- Reset restores only `SUS-127`, `SUS-212`, and `SUS-431`, with empty vectors.

## 11. How the Live Video Gets Back to the Browser

The live video path is HTTP MJPEG, not WebSocket video and not WebRTC.

```text
Camera or camera URL
        |
        v
OpenCV VideoCapture in _capture_loop
        |
        v
Raw frames plus cached AI detections
        |
        v
_draw_tactical_overlays()
        |
        v
_annotated_frame in CameraStreamManager
        |
        v
generate_frames()
        |
        +--> cv2.imencode('.jpg', frame)
        +--> multipart boundary and JPEG bytes
        |
        v
FastAPI GET /api/video/feed
        |
        v
CentralOperationsView <img src="/api/video/feed">
```

`generate_frames()` repeatedly yields:

```text
--frame
Content-Type: image/jpeg

<JPEG bytes>
```

The frontend browser treats the multipart response as a continuously updating
image. If the image fails, `CentralOperationsView` changes the URL with a
timestamp after 1.5 seconds to force a reconnect.

The backend overlay metadata is hardcoded to `DRN-03` in the HUD and alert
payload. Selecting another frontend drone changes UI labels, but it does not
change the backend camera source or create a separate drone video stream.

## 12. How Telemetry and Recognition Alerts Reach the UI

### 12.1 Simulated telemetry

Each client connected to `WS /ws/telemetry` receives a telemetry payload about
once per second. The backend generates small random latitude/longitude jitter,
altitude, speed, and heading values for `DRN-03`.

The frontend hook parses `TELEMETRY_UPDATE` and calls
`droneStore.updateDroneTelemetry()`. The dashboard then re-renders the selected
drone's coordinates and telemetry values.

### 12.2 Recognition alert

When the AI worker accepts a target match above the alert confidence threshold:

1. `_trigger_match_alert()` checks the three-second suspect cooldown.
2. It builds a `TARGET_MATCH` payload.
3. The camera manager calls its registered alert callbacks.
4. `ConnectionManager.broadcast_threadsafe()` schedules a broadcast on the
   FastAPI event loop.
5. Every connected telemetry WebSocket receives the JSON alert.
6. `useTelemetryWebSocket()` recognizes the target event.
7. The hook creates a critical `Notification` object.
8. `notificationStore.addNotification()` prepends it to the alert list.
9. The navigation badge and dashboard alert panel update.

The alert payload includes:

```json
{
  "event": "TARGET_MATCH",
  "type": "TARGET_MATCH",
  "suspectId": "SUS-XXX",
  "fullName": "...",
  "threatLevel": "...",
  "confidence": 0.94,
  "timestamp": "...",
  "droneId": "DRN-03",
  "sector": "Sector B7"
}
```

Recognition alerts are not written to JSON, PostgreSQL, MinIO, or a timeline
file. They exist only in currently connected browser sessions. Navigating away
from the dashboard closes the hook's WebSocket connection, so a disconnected
client cannot receive or replay missed live alerts.

## 13. Frontend State and Data Flow

### Suspects

```text
backend/data/suspects_db.json + vectors/*.npy
        |
        v
CameraStreamManager in-memory suspect_db
        |
        v
GET /api/suspects
        |
        v
suspectStore.suspects
        |
        +--> RecordsPage
        +--> RecordDetailPage
        +--> SuspectPanel
        +--> DetailPanel
        +--> CentralOperationsView markers
```

An image enrollment follows the reverse direction through
`POST /api/suspects`, then the frontend temporarily adds its own object before
the next backend fetch can normalize the displayed data.

### Drone telemetry

```text
main.py simulated WebSocket telemetry
        |
        v
useTelemetryWebSocket()
        |
        v
droneStore.updateDroneTelemetry()
        |
        +--> DronePanel
        +--> DetailPanel
        +--> CentralOperationsView HUD
        +--> map labels
```

### Target alerts

```text
camera.py target match
        |
        v
ConnectionManager WebSocket broadcast
        |
        v
useTelemetryWebSocket()
        |
        v
notificationStore.addNotification()
        |
        +--> NotificationPanel
        +--> NotificationsPage
        +--> unread navigation badge
```

### Layout and UI state

Zustand manages most local behavior. Only layout dimensions and split ratios are
written to browser `localStorage`. The rest resets when the page or browser
session is reloaded, except for data reloaded from the backend suspect files.

## 14. Feature and Data Source Matrix

| Area | Current source of data | Persistent? | Backend-connected? |
| --- | --- | --- | --- |
| Suspect list | Backend JSON through `/api/suspects`, with mock fallback | Yes for backend records | Yes |
| Suspect image enrollment | Multipart upload and local upload file | Yes when backend is available | Yes |
| Face vectors | `.npy` files loaded by camera manager | Yes | Yes |
| Live camera | OpenCV camera source | Runtime only | Yes |
| Face alerts | Camera worker and WebSocket | No | Yes while connected |
| Drone fleet list | `mockDrones` | No | No; `/api/drones` is not fetched |
| Drone registration | Local Zustand object | No | No endpoint exists |
| Drone telemetry | Simulated backend WebSocket for DRN-03 | No | Yes |
| Timeline | `mockTimelineEvents` | No | No |
| Criminal records | `mockRecords` | No | No |
| Playback sessions | `mockPlaybackSessions` and static thumbnails | No | No |
| Notifications | Mock notifications plus live in-memory alerts | No | Partially |
| Settings | Local React component state | No | No |
| Map markers | Static screen positions | No | No |
| Panel layout | Zustand plus `localStorage` | Browser-local | No |
| PostgreSQL | Compose declaration only | Container volume only | No current code path |
| MinIO | Compose declaration only | Container volume only | No current code path |

## 15. Important Current Implementation Notes

These points describe the current code rather than the intended product
description shown in some UI labels.

1. The primary recognition engine is YuNet plus SFace through OpenCV, not the
   YOLOv10 plus InsightFace text shown in Settings.
2. `face_recognition` is a conditional dlib fallback and may not be used when
   the ONNX models and OpenCV APIs are available.
3. The seed suspects have no face vectors, so a reset can leave visible records
   that cannot produce live matches.
4. A center-crop SFace fallback can generate an enrollment vector without a
   confirmed detected face.
5. The backend returns a successful registration response even when
   `faceEnrolled` is false.
6. The backend JSON is metadata storage, not a database engine.
7. PostgreSQL and MinIO are declared by Compose but are not used by current
   application code.
8. The local launcher does not install dependencies or verify readiness.
9. The frontend Nginx configuration does not currently reverse proxy API,
   WebSocket, or upload requests.
10. The frontend uses hardcoded localhost URLs in several places, so deployment
    to another host requires code or configuration changes.
11. Suspect enrollment sends only four fields to the backend; many form values
    exist only in the temporary frontend object.
12. Offline suspect registration is not durable and its preview URL is a
    browser-session object URL.
13. Drone registration, settings, playback, records, timeline events, and most
    alerts are mock or local-only features.
14. The map markers and flight paths are visual simulations rather than live
    coordinate-driven geospatial rendering.
15. The current backend exposes uploaded images publicly and enables wildcard
    CORS; there is no authentication or authorization enforcement in the API.
16. The current UI can issue duplicate delete requests from some detail-page
    paths because both the store and the page call the delete endpoint.
17. Reset deletes vector files but leaves uploaded image files in place.
18. The live video transport is multipart MJPEG, not WebSocket video or WebRTC.
19. Backend camera and alert labels are effectively tied to `DRN-03`, even when
    the UI allows another drone to be selected.
20. Live alerts are broadcast only to connected WebSocket clients and are not
    persisted or replayed.

## 16. One Complete End-to-End Scenario

The following is the complete path for a new suspect who is later seen by the
camera:

1. The operator opens `AEGIS.bat`.
2. Windows starts Uvicorn and Vite in separate console windows.
3. Chrome opens the React dashboard.
4. FastAPI imports `camera.py`, loads models and disk suspects, and starts the
   capture and AI threads.
5. The operator navigates to `/records/new`.
6. `AddSuspectPage` validates the selected image in the browser and displays a
   temporary preview.
7. The page posts `full_name`, `alias`, `threat_level`, and image bytes to
   `POST /api/suspects`.
8. FastAPI validates and passes the bytes to `CameraStreamManager`.
9. OpenCV decodes and saves the image.
10. YuNet locates a face and SFace turns the aligned face into a feature vector.
11. The backend writes metadata to `suspects_db.json`.
12. The backend writes the feature vector to `vectors/SUS-XXX.npy`.
13. The backend keeps the same vector in `self.suspect_db`, so no restart is
    needed for the new suspect to enter the live watchlist.
14. The UI receives the backend ID and enrollment status, adds a local display
    object, and redirects to the records page.
15. The camera capture thread continues reading frames at approximately 30 FPS.
16. Every fourth frame is sent to the AI worker when it is available.
17. The AI worker downsizes the frame, detects faces with YuNet, extracts SFace
    vectors, and compares them with the loaded suspect vectors.
18. If the best cosine score reaches `0.33`, the detection is labeled as a
    target and the confidence is normalized for display.
19. The capture thread draws a red target box using the cached detection.
20. `generate_frames()` JPEG-encodes the annotated image and streams it through
    `/api/video/feed`.
21. The browser's `<img>` element displays the red-boxed frame in the live
    camera workspace.
22. If the confidence reaches the configured alert threshold, the camera manager
    creates a `TARGET_MATCH` event.
23. The WebSocket manager broadcasts that event to connected dashboard clients.
24. The React WebSocket hook converts the event into a critical notification.
25. Zustand updates the alert panel and unread badge in the browser.

That is the currently implemented path from launcher, through enrollment and
file persistence, through live biometric comparison, to video and alert output.
