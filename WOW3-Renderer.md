# WOW3 Renderer API

HTTP API for rendering WOW3 animation projects into MP4 video files.

## Base URL

```
http://<host>:3000
```

## Authentication

All endpoints require an `X-API-Key` header. API keys are created from the admin UI at `/admin/`.

```
X-API-Key: <your-api-key>
```

Every request without a valid key returns `401`.

---

## Endpoints

### 1. Submit a Render Job

```
POST /jobs
```

Accepts a WOW3 project and queues it for rendering. The server processes one job at a time (FIFO). Returns immediately with a job ID for polling.

#### Option A: Upload a `.wow3a` file (ZIP archive with assets)

```http
POST /jobs HTTP/1.1
X-API-Key: <key>
Content-Type: multipart/form-data; boundary=----boundary

------boundary
Content-Disposition: form-data; name="file"; filename="presentation.wow3a"
Content-Type: application/octet-stream

<binary .wow3a content>
------boundary--
```

#### Option B: Upload a `.json` file (project definition only, no assets)

```http
POST /jobs HTTP/1.1
X-API-Key: <key>
Content-Type: multipart/form-data; boundary=----boundary

------boundary
Content-Disposition: form-data; name="file"; filename="project.json"
Content-Type: application/json

{"title":"My Project","tracks":[...]}
------boundary--
```

#### Option C: Send JSON directly in the request body

```http
POST /jobs HTTP/1.1
X-API-Key: <key>
Content-Type: application/json

{"title":"My Project","tracks":[...]}
```

#### Response (all options)

```
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "pending"
}
```

#### Errors

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error":"No file uploaded"}` | Multipart request with no file field |
| 400 | `{"error":"File must have .wow3a or .json extension"}` | Uploaded file has wrong extension |
| 400 | `{"error":"Invalid JSON body"}` | JSON body is not a valid object |
| 401 | `{"error":"Missing X-API-Key header"}` | No API key provided |
| 401 | `{"error":"Invalid API key"}` | API key not recognized |

---

### 2. Poll Job Status

```
GET /jobs/:id/status
```

Returns the current state of a job. Poll this endpoint until `status` is `completed` or `failed`.

#### Response

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "running",
  "progress": 42
}
```

On failure, an `error` field is included:

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "failed",
  "progress": 0,
  "error": "3 asset(s) failed to load — aborting render"
}
```

#### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Job is queued, waiting for the current render to finish |
| `running` | Job is actively rendering |
| `completed` | Render finished successfully, MP4 is ready for download |
| `failed` | Render failed, see `error` field for details |

#### Progress

Integer `0`–`100`. Only updates while `status` is `running`. Represents the percentage of the video timeline that has been recorded.

#### Errors

| Status | Body | Cause |
|--------|------|-------|
| 404 | `{"error":"Job not found"}` | No job with this ID exists |

---

### 3. Download Rendered MP4

```
GET /jobs/:id/result
```

Streams the rendered MP4 file. Only available when `status` is `completed`.

#### Response

```
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Disposition: attachment; filename="presentation.mp4"

<binary MP4 data>
```

#### Errors

| Status | Body | Cause |
|--------|------|-------|
| 404 | `{"error":"Job not found"}` | No job with this ID exists |
| 404 | `{"error":"Job is not completed (status: running)"}` | Job has not finished yet |
| 410 | `{"error":"Output file has been deleted"}` | MP4 was cleaned up (files expire after 48 hours) |

---

## Complete Workflow

```
1. POST /jobs          →  { jobId, status: "pending" }
2. GET /jobs/:id/status  →  { status: "pending", progress: 0 }     (poll)
3. GET /jobs/:id/status  →  { status: "running", progress: 35 }    (poll)
4. GET /jobs/:id/status  →  { status: "running", progress: 78 }    (poll)
5. GET /jobs/:id/status  →  { status: "completed", progress: 100 }
6. GET /jobs/:id/result  →  MP4 binary stream
```

Recommended polling interval: **3–5 seconds**.

---

## Implementation Notes for n8n Node

- **Submit**: Use an HTTP Request node. For `.wow3a` files, send as `multipart/form-data` with field name `file`. For JSON project definitions, send as `application/json` body.
- **Poll**: Use a polling loop (e.g., n8n's "Wait" + "IF" nodes, or a Loop node). Check `status` field. Exit loop when `status` is `completed` or `failed`.
- **Download**: When `status === "completed"`, GET `/jobs/:id/result` returns the raw MP4 binary. Save it as a file or pass it downstream.
- **Error handling**: If `status === "failed"`, read the `error` field and surface it to the user. Do not attempt to download the result.
- **Timeouts**: Renders typically take 1–5 minutes depending on project length. Set a reasonable timeout (e.g., 10 minutes) on the polling loop.
- **File expiry**: Completed MP4 files are automatically deleted after **48 hours**. Download promptly.
- **Queue**: The server processes one render at a time. If a job is `pending`, it is waiting in the queue behind another render. There is no way to cancel a queued job via the public API.
