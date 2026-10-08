# Mini Task Manager – Specification

## 1. Purpose

An internal tool for managing simple tasks with a traceable history of status changes.

Every status change records who changed what and when, and the history is visible per task.

## 2. Scope

### In scope
- Create task
- List all tasks
- Update task status (strict sequential flow)
- Delete task
- Audit log per task (append-only, chronological)
- Actor selection via dropdown (hardcoded user list)

### Out of scope
- Authentication / authorization / roles
- Complex UI, pagination, search, filtering
- Multi-tenant or real-time sync

## 3. Tech Stack

| Layer    | Technology                                   |
|----------|----------------------------------------------|
| Frontend | React + TypeScript                           |
| Backend  | Node.js + Express + TypeScript               |
| Storage  | SQLite via `better-sqlite3` (synchronous API, simple transactions) |
| Repo     | Monorepo using npm workspaces (single repository, single `npm install`) |

## 4. Domain Model

### 4.1 Task

| Field       | Type                     | Notes                              |
|-------------|--------------------------|------------------------------------|
| `id`        | string (UUID)            | Server-generated                   |
| `title`     | string                   | Required, non-empty, trimmed       |
| `description` | string (optional)      |                                    |
| `status`    | `TaskStatus`             | Defaults to `to_do` on creation    |
| `createdAt` | ISO 8601 string          | Server-generated                   |
| `updatedAt` | ISO 8601 string          | Updated on status change           |

```ts
type TaskStatus = "to_do" | "pending" | "in_progress" | "done";
```

### 4.2 Status Flow

Only forward, one step at a time:

```
to_do → pending → in_progress → done
```

| From          | Allowed To    |
|---------------|---------------|
| `to_do`       | `pending`     |
| `pending`     | `in_progress` |
| `in_progress` | `done`        |
| `done`        | (none, terminal) |

Rejected: skipping steps (e.g. `to_do → in_progress`), going backwards, any transition out of `done`.
Same-status update is **not** an error: it is a no-op (see 6.1).

### 4.3 Audit Log

| Field        | Type            | Notes                                           |
|--------------|-----------------|-------------------------------------------------|
| `id`         | integer         | Auto-increment; also defines chronological order |
| `taskId`     | string          | Which task changed                              |
| `taskTitle`  | string          | Snapshot at time of change (readable after deletion) |
| `actor`      | string          | Who made the change (from predefined user list) |
| `fromStatus` | `TaskStatus \| null` | `null` for the creation entry              |
| `toStatus`   | `TaskStatus`    | New status                                      |
| `createdAt`  | ISO 8601 string | When the change occurred (server time)          |

Example rendering:

> User "john.doe" changed Task "Prepare Invoice" status from "pending" to "in_progress" at 2025-01-01 10:00

### 4.4 Actors

Hardcoded list defined once in `packages/shared` and used by the frontend (dropdown) and the backend (validation), e.g.:

```ts
const ACTORS = ["john.doe", "jane.smith", "budi.santoso", "siti.rahma"];
```

The backend must reject any actor not in the list.

## 5. API Design

Base path: `/api`. JSON request/response.

| Method | Endpoint                  | Description                                  |
|--------|---------------------------|----------------------------------------------|
| GET    | `/tasks`                  | List all tasks                               |
| POST   | `/tasks`                  | Create a task                                |
| PUT    | `/tasks/:id/status`       | Update task status                           |
| DELETE | `/tasks/:id`              | Delete a task                                |
| GET    | `/tasks/:id/audit-logs`   | Get audit logs of a task (chronological)     |

### 5.1 Request/Response Contracts

**POST `/tasks`**
```json
// request
{ "title": "Prepare Invoice", "description": "optional", "actor": "john.doe" }
// 201 response
{ "id": "…", "title": "Prepare Invoice", "status": "to_do", "createdAt": "…", "updatedAt": "…" }
```

**PUT `/tasks/:id/status`**
```json
// request
{ "status": "pending", "actor": "john.doe" }
// 200 response
{ "task": { "...": "..." }, "changed": true }
```
If the status equals the current status: `200` with `"changed": false` and **no** audit log created.

**GET `/tasks/:id/audit-logs`** → `200` array of audit logs, ascending by `createdAt` (oldest first).

**DELETE `/tasks/:id`** → `204`.

### 5.2 Error Handling

Consistent error shape:
```json
{ "error": { "code": "INVALID_TRANSITION", "message": "Cannot change status from to_do to in_progress" } }
```

| Case                                   | HTTP | Code                 |
|----------------------------------------|------|----------------------|
| Missing/invalid body fields            | 400  | `VALIDATION_ERROR`   |
| Actor not in predefined list           | 400  | `INVALID_ACTOR`      |
| Unknown status value                   | 400  | `VALIDATION_ERROR`   |
| Task not found                         | 404  | `NOT_FOUND`          |
| Transition violates flow               | 409  | `INVALID_TRANSITION` |

There must be **no** endpoint to update or delete audit logs (PUT/PATCH/DELETE on logs are not exposed).

## 6. Business Rules & Non-Functional Requirements

### 6.1 Idempotent Update
Updating status to the current value must not create a new audit log and must not change `updatedAt`.

### 6.2 Data Consistency
Task status and audit log must always be in sync: a status change and its audit entry are written in **one SQLite transaction**. Either both succeed or neither does.

Status update flow (inside a single transaction):
1. Read the task; 404 if missing or soft-deleted.
2. If the new status equals the current one → return `changed: false`, write nothing.
3. If the transition is not allowed → `INVALID_TRANSITION`, write nothing.
4. Update `tasks.status` and `tasks.updated_at`.
5. Insert the row into `audit_logs`.

Create task works the same way: insert the task and its initial audit log in one transaction.

### 6.3 Audit Log Immutability
- Append-only: no code path updates or deletes an audit log row.
- Updating a task never touches existing logs.
- The log repository exposes only `append` and `listByTaskId`.
- Enforced at the database level with triggers that abort any `UPDATE` or `DELETE` on `audit_logs` (see 6.7).
- Foreign key from `audit_logs.task_id` to `tasks.id`; tasks are never hard-deleted (see 6.4).
- Logs are returned ordered by `id` ascending (oldest first).

### 6.4 Delete vs. Immutable Logs
Since logs must never be deleted "under any circumstances", deleting a task is a **soft delete** (`deletedAt` set; hidden from `GET /tasks`). Its audit logs are retained and still readable.

### 6.5 Creation Log (assumption)
Creating a task writes an initial audit entry (`fromStatus: null → toStatus: to_do`) so the history is complete from the start. Therefore `POST /tasks` also takes an `actor`.

### 6.6 Domain Validation
Transition rules are enforced on the **backend** (mandatory). Frontend validation is optional, but the UI should only offer the next valid status to keep UX clear.

### 6.7 Persistence (SQLite)

- Database file: `apps/backend/data/app.db` (git-ignored; created automatically on first start).
- Schema is applied on startup (`CREATE TABLE IF NOT EXISTS`), no migration tool.
- Enable `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` on connection.
- Use prepared statements only (no string-concatenated SQL).

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,                 -- UUID
  title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  status      TEXT NOT NULL CHECK (status IN ('to_do','pending','in_progress','done')),
  created_at  TEXT NOT NULL,                    -- ISO 8601
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT                              -- soft delete
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  task_title  TEXT NOT NULL,                    -- snapshot at time of change
  actor       TEXT NOT NULL,
  from_status TEXT CHECK (from_status IN ('to_do','pending','in_progress','done')),
  to_status   TEXT NOT NULL CHECK (to_status IN ('to_do','pending','in_progress','done')),
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id, id);

CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
```

Notes:
- `from_status` is `NULL` only for the creation entry.
- Timestamps are generated by the server, not the client.
- Column names are `snake_case` in SQL; the repository maps them to the `camelCase` types from `@mtm/shared`.

## 7. Frontend Requirements

- **Task list:** easy to read; shows title, status (clearly distinguishable, e.g. colored badge), and last updated.
- **Create task form:** title (required), optional description, actor dropdown.
- **Update status:** action that moves the task to the next valid status, with an actor dropdown. Show backend errors clearly.
- **Audit log view per task:** modal, expandable section, or separate page. Shows entries chronologically in readable form (actor, from → to, timestamp).
- **Delete:** with a basic confirmation.
- Handle loading and error states minimally.

## 8. Monorepo Structure

Single Git repository using **npm workspaces** (no Nx/Turborepo).

```
/
├── package.json                # root: workspaces + orchestration scripts
├── tsconfig.base.json          # shared TS compiler options
├── apps/
│   ├── backend/
│   │   ├── package.json        # @mtm/backend
│   │   ├── tsconfig.json       # extends ../../tsconfig.base.json
│   │   ├── data/               # app.db (git-ignored)
│   │   └── src/
│   │       ├── index.ts            # server bootstrap
│   │       ├── routes/             # route definitions
│   │       ├── controllers/        # HTTP layer (parse/respond)
│   │       ├── services/           # business rules (transition validation, atomic update)
│   │       ├── db/                 # SQLite connection + schema.sql
│   │       ├── repositories/       # SQL queries (tasks; audit logs: append/read only)
│   │       └── middleware/         # validation, error handler
│   └── frontend/
│       ├── package.json        # @mtm/frontend
│       ├── tsconfig.json
│       └── src/
│           ├── api/                # typed API client
│           ├── components/         # TaskList, TaskForm, StatusControl, AuditLogView
│           └── App.tsx
├── packages/
│   └── shared/
│       ├── package.json        # @mtm/shared
│       ├── tsconfig.json
│       └── src/
│           ├── types.ts            # Task, AuditLog, TaskStatus, API request/response types
│           ├── status-flow.ts      # allowed transitions + helper getNextStatus()
│           ├── actors.ts           # predefined ACTORS list
│           └── index.ts
├── README.md
└── specs.md
```

### 8.1 Shared Package (`@mtm/shared`)

The main reason for the monorepo: a single source of truth so frontend and backend cannot drift apart.

- Shared: `TaskStatus`, `Task`, `AuditLog`, request/response and error types, the `ACTORS` list, and the status transition map.
- Backend uses it to validate input and transitions (authoritative).
- Frontend uses it for the actor dropdown, typed API client, and to show only the next valid status (UX only, not a replacement for backend validation).
- Shared package contains **types and pure constants/functions only**: no Express, no React, no I/O.

### 8.2 Root Scripts

```jsonc
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w @mtm/backend\" \"npm run dev -w @mtm/frontend\"",
    "build": "npm run build -w @mtm/shared && npm run build -w @mtm/backend && npm run build -w @mtm/frontend",
    "typecheck": "tsc -b",
    "start": "npm run start -w @mtm/backend"
  }
}
```

Expected workflow: `npm install` at the root, then `npm run dev` starts both apps. Frontend dev server proxies `/api` to the backend (Vite proxy) to avoid CORS setup.

### 8.3 Monorepo Conventions

- Internal dependencies referenced as `"@mtm/shared": "*"` in each app's `package.json`.
- Use TypeScript project references (or path aliases) so `@mtm/shared` resolves in both apps and in `tsc -b`.
- One shared `tsconfig.base.json`; each package only overrides what differs (e.g. `jsx` for frontend, `module` for backend).
- Single lockfile at the root.

## 9. Deliverables

1. Public GitHub repository.
2. `README.md` containing:
   - How to run frontend and backend (from the monorepo root, e.g. `npm install` then `npm run dev`)
   - Monorepo layout and what `@mtm/shared` is used for
   - Brief architecture explanation
   - Assumptions made
   - Trade-offs made
   - What would be improved with more time
3. Answers (in README or a separate file):
   - How do you ensure the audit log cannot be modified?
   - Which part of the solution is riskiest with many concurrent users?
   - If this grows into a large system, which part would you refactor first, and why?
4. If AI was used: which parts were AI-assisted and how they were validated.

## 10. Acceptance Criteria

- [ ] Can create a task (starts as `to_do`).
- [ ] Can list all tasks with clearly visible status.
- [ ] Status can only move `to_do → pending → in_progress → done`; skipping/backward/after-`done` returns an error.
- [ ] Each valid status change creates exactly one new audit log with task, actor, from → to, timestamp.
- [ ] Updating to the same status creates no new log.
- [ ] Actor is chosen via dropdown from a predefined list and validated by the backend.
- [ ] Audit logs are shown per task in chronological order.
- [ ] No endpoint or code path can edit/delete audit logs; deleting a task keeps its logs.
- [ ] Task status and audit logs never go out of sync (status update and log insert run in one transaction).
- [ ] Data persists in SQLite across server restarts.
- [ ] Attempting `UPDATE` or `DELETE` on `audit_logs` fails at the database level (triggers).
- [ ] TypeScript used in both frontend and backend.
- [ ] Monorepo with npm workspaces: `apps/backend`, `apps/frontend`, `packages/shared`.
- [ ] Status flow, types, and actor list are defined once in `@mtm/shared` and imported by both apps (no duplicated definitions).
- [ ] `npm install` and `npm run dev` from the root start both frontend and backend.
- [ ] README and written answers submitted.