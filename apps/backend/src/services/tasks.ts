import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { AuditLog, Task, TaskStatus, UpdateStatusResponse } from "@mtm/shared";
import { isValidTransition } from "@mtm/shared";
import { AuditLogRepository } from "../repositories/audit-logs.js";
import { TaskRepository, toPublicTask } from "../repositories/tasks.js";
import { invalidTransition, notFound } from "../middleware/errors.js";

export class TaskService {
  private readonly tasks: TaskRepository;
  private readonly auditLogs: AuditLogRepository;

  constructor(private readonly db: Database.Database) {
    this.tasks = new TaskRepository(db);
    this.auditLogs = new AuditLogRepository(db);
  }

  list(): Task[] {
    return this.tasks.listActive().map(toPublicTask);
  }

  create(input: { title: string; description: string | undefined; actor: string }): Task {
    const id = randomUUID();
    const now = new Date().toISOString();
    const description = input.description ?? null;

    const run = this.db.transaction(() => {
      this.tasks.insert({
        id,
        title: input.title,
        description,
        status: "to_do",
        createdAt: now,
        updatedAt: now,
      });
      this.auditLogs.append({
        taskId: id,
        taskTitle: input.title,
        actor: input.actor,
        fromStatus: null,
        toStatus: "to_do",
        createdAt: now,
      });
    });
    run();

    const task: Task = {
      id,
      title: input.title,
      status: "to_do",
      createdAt: now,
      updatedAt: now,
    };
    if (input.description) {
      task.description = input.description;
    }
    return task;
  }

  updateStatus(id: string, status: TaskStatus, actor: string): UpdateStatusResponse {
    const run = this.db.transaction((): UpdateStatusResponse => {
      const existing = this.tasks.getById(id);
      if (!existing || existing.deletedAt) {
        throw notFound();
      }
      if (existing.status === status) {
        return { task: toPublicTask(existing), changed: false };
      }
      if (!isValidTransition(existing.status, status)) {
        throw invalidTransition(existing.status, status);
      }
      const now = new Date().toISOString();
      this.tasks.updateStatus(id, status, now);
      this.auditLogs.append({
        taskId: existing.id,
        taskTitle: existing.title,
        actor,
        fromStatus: existing.status,
        toStatus: status,
        createdAt: now,
      });
      return {
        task: toPublicTask({ ...existing, status, updatedAt: now }),
        changed: true,
      };
    });
    return run();
  }

  delete(id: string): void {
    const existing = this.tasks.getById(id);
    if (!existing || existing.deletedAt) {
      throw notFound();
    }
    this.tasks.softDelete(id, new Date().toISOString());
  }

  listAuditLogs(id: string): AuditLog[] {
    const existing = this.tasks.getById(id);
    if (!existing) {
      throw notFound();
    }
    return this.auditLogs.listByTaskId(id);
  }
}
