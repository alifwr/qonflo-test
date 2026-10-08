import type Database from "better-sqlite3";
import type { AuditLog, TaskStatus } from "@mtm/shared";

type AuditRow = {
  id: number;
  task_id: string;
  task_title: string;
  actor: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  created_at: string;
};

function toAuditLog(row: AuditRow): AuditLog {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    actor: row.actor,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    createdAt: row.created_at,
  };
}

export class AuditLogRepository {
  private readonly appendStmt;
  private readonly listByTaskIdStmt;

  constructor(db: Database.Database) {
    this.appendStmt = db.prepare(`
      INSERT INTO audit_logs (task_id, task_title, actor, from_status, to_status, created_at)
      VALUES (@taskId, @taskTitle, @actor, @fromStatus, @toStatus, @createdAt)
    `);
    this.listByTaskIdStmt = db.prepare(`
      SELECT id, task_id, task_title, actor, from_status, to_status, created_at
      FROM audit_logs
      WHERE task_id = ?
      ORDER BY id ASC
    `);
  }

  append(entry: {
    taskId: string;
    taskTitle: string;
    actor: string;
    fromStatus: TaskStatus | null;
    toStatus: TaskStatus;
    createdAt: string;
  }): void {
    this.appendStmt.run(entry);
  }

  listByTaskId(taskId: string): AuditLog[] {
    return (this.listByTaskIdStmt.all(taskId) as AuditRow[]).map(toAuditLog);
  }
}
