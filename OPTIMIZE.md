# Optimization TODO

> Generated on 2026-06-15. Items sorted by importance.

## Critical

- [x] **Path traversal in Content-Disposition** — `apps/wow3-renderer/src/api/routes/jobs.js:110` uses `job.wow3a_name` (user-controlled) directly in header without sanitization
- [x] **Timing attack on admin credentials** — `apps/wow3-renderer/src/api/routes/admin.js:27` uses plain string comparison for username/password, vulnerable to timing attacks
- [x] **Missing rate limiting** — No rate limiting on job creation endpoint allows abuse and resource exhaustion

## High

- [x] **Cookie missing Secure flag** — `apps/wow3-renderer/src/api/routes/admin.js:31` sets `admin_session` cookie without `secure: true`, transmitting over HTTP
- [ ] **Full JSON in history stack** — `apps/wow3/js/controllers/EditorController.js:777` stores complete presentation JSON for each undo step; use delta diffs instead
- [x] **Missing Content-Security-Policy** — `apps/wow3-renderer/src/server.js` serves static files without CSP headers
- [x] **Synchronous CDN scripts** — `apps/wow3/index.html:281-296` loads 5 external scripts synchronously, blocking rendering

## Medium

- [x] **Inefficient DOM queries in hot paths** — `document.getElementById` called once per selected element per nudge keydown at `apps/wow3/js/controllers/ElementController.js:936`; with keyboard repeat this fires many times/sec
- [x] **Missing error boundaries in playback** — `apps/wow3/js/controllers/PlaybackController.js` has no try/catch around animation execution
- [x] **No lazy loading for images** — Editor doesn't lazy load images, causing memory issues with large presentations
- [x] **Unused code paths** — `apps/wow3/js/models/Presentation.js:267` `getStatistics()` method unused
- [x] **Magic numbers throughout** — Hardcoded values like `250` (poll interval), `1000` (fade duration) in multiple files
- [x] **Missing cleanup on controller destroy** — Controllers don't implement proper cleanup methods
- [x] **Inefficient event system** — Custom EventEmitter in `packages/wow-core/src/utils/events.js` could use WeakRef for listeners
- [x] **No input validation on job ID** — `apps/wow3-renderer/src/api/routes/jobs.js:84` uses `request.params.id` directly in DB query without UUID format validation
- [x] **Missing CORS configuration** — No explicit CORS headers configured on API server

## Low / Nice to have

- [ ] **Deprecated animation types** — `packages/wow-core/src/utils/constants.js:7-20` still exports deprecated `AnimationType` enum
- [ ] **Inconsistent naming** — Mix of `camelCase` and `snake_case` in database columns and model properties
- [x] **Missing JSDoc on some functions** — Several utility functions in `packages/wow-core/src/utils/dom.js` lack parameter documentation (all functions already have JSDoc)
- [ ] **No TypeScript types** — Entire codebase is plain JavaScript; adding types would prevent many bugs
- [ ] **Missing tests for renderer API** — `apps/wow3-renderer/test/` exists but coverage is minimal
- [x] **Console.log statements** — Debug logging left in production code (`packages/wow-core/src/managers/AudioManager.js:61,174`)
- [x] **No connection pooling for SQLite** — `apps/wow3-renderer/src/api/db.js` creates single connection without pooling considerations (WAL mode already enabled)
- [x] **Missing health check endpoint** — No `/health` or `/ready` endpoint for monitoring
