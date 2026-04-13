# Job Log Files — Design Spec

**Date:** 2026-04-13
**Status:** Approved

## Overview

Each render job writes a persistent log file to disk. The admin dashboard exposes a Log button per job that opens an inline modal with the log contents, refreshable on demand.

## Storage

Log files live under `$DATA_DIR/logs/<job-id>.log`. The `logs/` directory is created on first use if it does not exist. No DB schema changes are required.

Log line format:
```
[2026-04-13T10:23:45.123Z] Launching browser...
[2026-04-13T10:23:46.456Z] Rendering: 1/30s
[2026-04-13T10:24:17.123Z] ERROR: Puppeteer timeout
  at recorder.js:59 ...
```

Every message that currently flows through the `onProgress` callback is written as a timestamped line. On job failure the caught error message and full stack trace are appended before the stream is closed.

## Backend Changes

### `api/queue.js`
- When a job transitions to `running`, open a `fs.createWriteStream` on `$DATA_DIR/logs/<job-id>.log`.
- Wrap the existing `onProgress` callback: each message is written as `[<ISO timestamp>] <msg>\n`.
- In the `catch` block: write `[<ISO timestamp>] ERROR: <err.message>\n` followed by the stack trace.
- In the `finally` block: close the write stream.

### `api/routes/admin.js`
- Add new admin-authenticated endpoint:
  ```
  GET /admin/jobs/:id/log
  ```
  Reads `$DATA_DIR/logs/<id>.log` and returns it as `text/plain; charset=utf-8`.
  Returns HTTP 404 with body `{"error":"no log available"}` if the file does not exist.
- In the existing `DELETE /admin/jobs/:id` handler: after the `rm(output_path)` call, add `rm($DATA_DIR/logs/<id>.log)` with `{ force: true }` so it is a no-op if the file does not exist.

### `api/cleanup.js`
- In the 48-hour expiry loop, alongside the existing `rm(job.output_path)` call, add `rm($DATA_DIR/logs/<job.id>.log, { force: true })`.

### `src/render.js`
No changes. Log messages already flow through the `onProgress` callback passed by `queue.js`.

## Dashboard Changes (`admin/index.html`)

### Log button
A **Log** button is added to every job row in the actions column, placed before the existing Kill/Delete buttons. It is always visible regardless of job status.

### Log modal
Clicking Log:
1. Calls `GET /admin/jobs/:id/log`.
2. Opens a modal (using the existing WoxGUI modal pattern) with:
   - Title: `Log — <job-id short>`
   - Body: `<pre>` block with monospace log text, or the message _"Nessun log disponibile"_ on 404.
   - A **Refresh** button in the modal header.
3. If the job status is `running` at the time the modal opens, starts a 3-second auto-refresh interval that re-fetches the log. The interval is cleared when the modal is closed or when the job status becomes `completed` or `failed`.

## Deletion Guarantees

| Trigger | MP4 deleted | Log deleted |
|---------|-------------|-------------|
| Manual delete (dashboard) | yes (existing) | yes (new) |
| Bulk delete (dashboard) | yes (existing) | yes (new) |
| 48-hour automatic cleanup | yes (existing) | yes (new) |
| Job killed while running | file not yet present or partial | deleted if present |

## Error Handling

- Log directory creation failure: propagate as job error (same severity as being unable to write output).
- Log read failure on `GET /admin/jobs/:id/log`: return 500 with error message.
- Log delete failure on job deletion: log warning to server console, do not fail the deletion request.
