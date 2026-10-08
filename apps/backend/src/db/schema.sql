CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  status      TEXT NOT NULL CHECK (status IN ('to_do','pending','in_progress','done')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  task_title  TEXT NOT NULL,
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
