import type Database from "better-sqlite3";
import type { Task, TaskStatus } from "@mtm/shared";

export type TaskRecord = Task & { deletedAt: string | null };

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toRecord(row: TaskRow): TaskRecord {
  const record: TaskRecord = {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
  if (row.description) {
    record.description = row.description;
  }
  return record;
}

export function toPublicTask(record: TaskRecord): Task {
  const task: Task = {
    id: record.id,
    title: record.title,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  if (record.description) {
    task.description = record.description;
  }
  return task;
}

export class TaskRepository {
  private readonly insertStmt;
  private readonly listActiveStmt;
  private readonly getByIdStmt;
  private readonly updateStatusStmt;
  private readonly softDeleteStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO tasks (id, title, description, status, created_at, updated_at, deleted_at)
      VALUES (@id, @title, @description, @status, @createdAt, @updatedAt, NULL)
    `);
    this.listActiveStmt = db.prepare(`
      SELECT id, title, description, status, created_at, updated_at, deleted_at
      FROM tasks
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC
    `);
    this.getByIdStmt = db.prepare(`
      SELECT id, title, description, status, created_at, updated_at, deleted_at
      FROM tasks
      WHERE id = ?
    `);
    this.updateStatusStmt = db.prepare(`
      UPDATE tasks SET status = @status, updated_at = @updatedAt WHERE id = @id AND deleted_at IS NULL
    `);
    this.softDeleteStmt = db.prepare(`
      UPDATE tasks SET deleted_at = @deletedAt WHERE id = @id AND deleted_at IS NULL
    `);
  }

  insert(input: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    createdAt: string;
    updatedAt: string;
  }): void {
    this.insertStmt.run(input);
  }

  listActive(): TaskRecord[] {
    return (this.listActiveStmt.all() as TaskRow[]).map(toRecord);
  }

  getById(id: string): TaskRecord | undefined {
    const row = this.getByIdStmt.get(id) as TaskRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  updateStatus(id: string, status: TaskStatus, updatedAt: string): void {
    this.updateStatusStmt.run({ id, status, updatedAt });
  }

  softDelete(id: string, deletedAt: string): boolean {
    const result = this.softDeleteStmt.run({ id, deletedAt });
    return result.changes > 0;
  }
}
