# Design: wow3-renderer Docker Service

**Date:** 2026-04-10
**Status:** Approved

## Overview

Extend `apps/wow3-renderer` with an HTTP server that exposes the existing CLI render pipeline as an async job API. The service runs in a Docker container on Hetzner, is triggered by n8n, processes one render at a time (single-slot queue), persists state to SQLite, and exposes an admin web UI built with WoxGUI 0.2.2.

---

## Architecture

The existing CLI (`src/index.js`, `recorder.js`, `server.js`, `audio.js`) is left untouched. A new `src/api/` subtree adds the server layer on top.

```
apps/wow3-renderer/
  src/
    index.js            ← CLI (unchanged)
    recorder.js         ← unchanged
    server.js           ← unchanged (local static server for Puppeteer)
    audio.js            ← unchanged
    api/
      app.js            ← Fastify server entry point (port 3000)
      db.js             ← SQLite setup via better-sqlite3
      queue.js          ← single-slot in-process job queue
      cleanup.js        ← hourly cron, deletes jobs/files older than 48h
      middleware/
        auth.js         ← X-API-Key header validation
        admin-auth.js   ← admin session (JWT in httpOnly cookie)
      routes/
        jobs.js         ← public job endpoints
        admin.js        ← admin CRUD endpoints
    admin/
      index.html        ← Admin UI (WoxGUI 0.2.2 CDN)
  Dockerfile
  docker-compose.yml
```

---

## HTTP API

### Public endpoints — require `X-API-Key` header

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/jobs` | Upload `.wow3a` (multipart/form-data, field: `file`). Returns `{ jobId, status: "pending" }` |
| `GET` | `/jobs/:id/status` | Returns `{ jobId, status, progress, error? }` |
| `GET` | `/jobs/:id/result` | Streams MP4 file. HTTP 404 if not completed, HTTP 410 if expired/deleted |

**Job status flow:** `pending → running → completed | failed`

**Progress:** integer 0–100, updated by the recorder's `onProgress` callback.

### Admin endpoints — require valid session cookie

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/login` | Body: `{ username, password }`. Sets httpOnly JWT cookie. Returns `{ ok: true }` |
| `POST` | `/admin/logout` | Clears cookie |
| `GET` | `/admin/api-keys` | List all API keys (label, created_at; key_hash hidden) |
| `POST` | `/admin/api-keys` | Create key. Body: `{ label }`. Returns `{ id, label, key }` — key shown once |
| `DELETE` | `/admin/api-keys/:id` | Delete key |
| `GET` | `/admin/jobs` | List all jobs (all statuses) with metadata |
| `DELETE` | `/admin/jobs/:id` | Delete job record and its MP4 file |

### Static admin UI

`GET /admin` and `GET /admin/*` serve the WoxGUI single-page admin interface.

---

## Data Layer (SQLite)

Database file: `$DATA_DIR/wow3.db` (default `/data/wow3.db`).

```sql
CREATE TABLE api_keys (
  id          TEXT PRIMARY KEY,   -- UUID
  label       TEXT NOT NULL,
  key_hash    TEXT NOT NULL,      -- SHA-256 hex of raw key
  created_at  INTEGER NOT NULL    -- Unix ms
);

CREATE TABLE jobs (
  id            TEXT PRIMARY KEY, -- UUID
  status        TEXT NOT NULL,    -- pending | running | completed | failed
  wow3a_name    TEXT NOT NULL,    -- original filename
  output_path   TEXT,             -- absolute path to .mp4, null until completed
  progress      INTEGER DEFAULT 0,
  error         TEXT,
  created_at    INTEGER NOT NULL,
  started_at    INTEGER,
  completed_at  INTEGER
);
```

API keys are stored as SHA-256 hashes. The raw key is returned once on creation and never persisted.

---

## Single-Slot Queue

`queue.js` maintains an in-memory FIFO array. A `runNext()` function picks the first `pending` job, sets it to `running`, executes the render pipeline (reusing `recorder.js`, `server.js`, `audio.js`), then calls `runNext()` again on completion or failure. If a job is already running, `runNext()` is a no-op.

The queue survives container restarts gracefully: on startup, any job left in `running` state (from a previous crash) is reset to `failed` with error `"interrupted by restart"`, and the queue reloads all `pending` jobs.

---

## Cleanup

`cleanup.js` runs every hour via `setInterval`. It queries for jobs where `completed_at < now - 48h` (or `status = failed` and `created_at < now - 48h`), deletes their MP4 files from disk, and removes the database rows.

---

## Admin UI (WoxGUI 0.2.2)

Single HTML file loaded from `/admin`. Uses WoxGUI CDN — no build step.

**Login screen:** centered `wox-modal` (non-closable) with username + password `wox-input` fields and a login `wox-button`. On failure shows `WoxToast.error(...)`.

**Main layout** (after login):
- `wox-menubar` with app title and logout button
- `wox-tabs` with two tabs:

**API Keys tab:**
- `wox-datagrid` columns: Label, Created At, Actions (Delete button per row)
- "New API Key" `wox-button` opens a `wox-modal` with a label input; on confirm, shows the generated key once in a read-only input with a copy button (`WoxToast.success` on copy)

**Jobs tab:**
- `wox-datagrid` columns: ID (truncated), File, Status (`wox-badge`), Created At, Duration, Actions (Download + Delete)
- Auto-refresh every 10 seconds via `setInterval`
- Delete shows a confirmation `wox-modal`
- `wox-statusbar` bottom-left shows total job count and queue depth

---

## Docker

### Dockerfile

```dockerfile
FROM node:22-slim

# Install Chromium + FFmpeg
RUN apt-get update && apt-get install -y \
    chromium ffmpeg \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests for pnpm install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/wow3-renderer/package.json ./apps/wow3-renderer/
# Only package.json needed for workspace resolution (renderer does not import @wow/core)
COPY packages/wow-core/package.json ./packages/wow-core/package.json

RUN npm install -g pnpm && pnpm install --frozen-lockfile --filter @wow/wow3-renderer

# Copy source
COPY apps/wow3-renderer/src ./apps/wow3-renderer/src

# Copy pre-built wow3-animation dist (must be built before docker build)
COPY apps/wow3-animation/dist ./apps/wow3-animation/dist

VOLUME ["/data"]
EXPOSE 3000

ENV DATA_DIR=/data \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

CMD ["node", "apps/wow3-renderer/src/api/app.js"]
```

### docker-compose.yml

```yaml
services:
  wow3-renderer:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - renderer-data:/data
    env_file:
      - .env
    restart: unless-stopped

volumes:
  renderer-data:
```

### Environment variables (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_USER` | yes | Admin login username |
| `ADMIN_PASS` | yes | Admin login password |
| `JWT_SECRET` | yes | Secret for signing admin session JWTs |
| `DATA_DIR` | no | Storage path (default `/data`) |
| `PORT` | no | HTTP port (default `3000`) |
| `PUPPETEER_EXECUTABLE_PATH` | no | Override Chromium path |

---

## Deployment on Hetzner

1. Build `wow3-animation`: `pnpm build:animation`
2. Build Docker image: `docker build -t wow3-renderer .`
3. Push to registry or copy to server: `docker save | ssh ... docker load`
4. On Hetzner: `docker compose up -d`
5. Optionally place Nginx in front for HTTPS termination

---

## n8n Integration

In n8n, use an HTTP Request node:
- Method: `POST`
- URL: `http://<hetzner-ip>:3000/jobs`
- Authentication: Header `X-API-Key: <key>`
- Body: multipart/form-data, field `file` → the `.wow3a` binary

Then poll `GET /jobs/:id/status` until `status === "completed"`, then download from `GET /jobs/:id/result`.
