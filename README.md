# Mini Task Manager

Internal task list with a forward-only status flow and an append-only audit history.

## Run

Requires Node.js 20+.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173 (Vite proxies `/api` to the backend)
- Backend: http://localhost:3000

Local production-style start after a full build (API only):

```bash
npm run build
npm start   # Express on port 3000; it does not serve the UI
```

`npm start` is API-only because the SPA is a separate Vite build. For a single production entry point, use Docker Compose (nginx serves the UI and proxies `/api`).

```bash
docker compose up --build
```

- App: http://localhost:8080
- Health: http://localhost:8080/health
- SQLite: Docker volume `task-data` mounted at `/app/apps/backend/data`

Stop with `docker compose down`. The database volume is kept unless you pass `-v`.

SQLite file when running on the host: `apps/backend/data/app.db` (created on first start, git-ignored).

```bash
npm test
```

Runs:

- `@mtm/shared` — status matrix, actor list, and the audit-log sentence format
- `@mtm/backend` — create/list/update/delete, sequential status, idempotent updates, chronological immutable logs, SQLite persistence, triggers, transactional consistency
- `@mtm/frontend` — actor dropdowns, next-status-only control, readable task list, per-task history modal, delete confirmation

## Monorepo

npm workspaces, no Nx/Turborepo.

| Package | Path | Role |
|---------|------|------|
| `@mtm/shared` | `packages/shared` | Types, `ACTORS`, status transitions |
| `@mtm/backend` | `apps/backend` | Express + SQLite |
| `@mtm/frontend` | `apps/frontend` | React UI |

`@mtm/shared` is the single source of truth. Frontend and backend both import `TaskStatus`, request/response types, `ACTORS`, and `getNextStatus` / `isValidTransition` from it. Shared code is types and pure functions only.

## Architecture

```
UI  →  /api  →  controllers (parse/respond)
                 →  services (transitions, transactions)
                    →  repositories (prepared SQL)
                       →  SQLite (WAL, FK, append-only triggers)
```

Status change and audit insert run in one `better-sqlite3` transaction. Tasks are soft-deleted so `audit_logs.task_id` stays valid. Audit repository exposes only `append` and `listByTaskId`.

## Assumptions

- Creating a task writes `fromStatus: null → toStatus: to_do` with the submitted actor.
- `GET /tasks/:id/audit-logs` still works after a soft delete (row remains).
- Timestamps are server ISO 8601 UTC (`Date.toISOString()`).
- Same-status PUT is a no-op: `200 { changed: false }`, no log, `updatedAt` unchanged.
- UI only offers the next status; the backend still enforces the flow.

## Trade-offs

- SQLite + synchronous `better-sqlite3` keeps the implementation small and makes transactions trivial. It serializes writers and blocks the Node event loop.
- Hardcoded actors instead of auth (explicitly out of scope).
- Vite proxy instead of CORS configuration for local development.
- `postinstall` builds `@mtm/shared` so workspace imports resolve after `npm install`.

## If there were more time

- Replace SQLite with Postgres and an async driver once write concurrency matters.
- Browser end-to-end tests against a running stack.
- Serve the Vite build from the API process for a single-port deploy.

## Written answers

### How do you ensure the audit log cannot be modified?

Three layers, all required:

1. **API** — no PUT/PATCH/DELETE for logs.
2. **Code** — `AuditLogRepository` only has `append` and `listByTaskId`. Task delete is `deleted_at`, never `DELETE FROM tasks` / logs.
3. **Database** — `BEFORE UPDATE` and `BEFORE DELETE` triggers on `audit_logs` `RAISE(ABORT, ...)`. Foreign key `task_id → tasks(id)` plus soft delete keeps history after the task is hidden.

### Which part is riskiest with many concurrent users?

SQLite’s single-writer lock plus `better-sqlite3`’s synchronous calls. Readers can proceed under WAL, but every write queues, and each query occupies the event loop. Correctness of transitions is still protected by transactions (second writer sees the committed status). Throughput and latency are the failure mode, not silent log/status split.

### If this grows into a large system, what would you refactor first?

Persistence: move off process-local SQLite to a networked database with async I/O and connection pooling. The domain (one-step flow, append-only history, actor list) can stay. The current store is the first ceiling on concurrency, ops (backup, multi-instance), and event-loop health.

## AI assistance

The repo was implemented from `SPECS.md` with an AI coding assistant. Validation: `npm install`, `npm run typecheck`, `npm test` (shared, backend HTTP/SQLite, and frontend UI tests).
