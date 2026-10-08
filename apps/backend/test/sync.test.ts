import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { TaskService } from "../src/services/tasks.js";
import { openDb } from "../src/db/connection.js";

describe("task status and audit log stay in sync", () => {
  it("writes the task and creation log in one transaction", () => {
    const db = openDb(":memory:");
    try {
      const service = new TaskService(db);
      const task = service.create({ title: "Atomic create", description: undefined, actor: "john.doe" });
      const row = db.prepare("SELECT status FROM tasks WHERE id = ?").get(task.id) as { status: string };
      const logs = db
        .prepare("SELECT from_status, to_status FROM audit_logs WHERE task_id = ? ORDER BY id")
        .all(task.id) as { from_status: string | null; to_status: string }[];
      assert.equal(row.status, "to_do");
      assert.equal(logs.length, 1);
      assert.equal(logs[0].from_status, null);
      assert.equal(logs[0].to_status, "to_do");
    } finally {
      db.close();
    }
  });

  it("rolls back the status change if the audit insert cannot run", () => {
    const db = openDb(":memory:");
    try {
      const service = new TaskService(db);
      const task = service.create({ title: "Rollback", description: undefined, actor: "john.doe" });
      db.exec("DROP TRIGGER IF EXISTS audit_logs_no_update");
      db.exec("DROP TRIGGER IF EXISTS audit_logs_no_delete");
      db.exec("DELETE FROM audit_logs");
      db.exec("DROP TABLE audit_logs");

      assert.throws(() => service.updateStatus(task.id, "pending", "john.doe"));

      const row = db.prepare("SELECT status, updated_at FROM tasks WHERE id = ?").get(task.id) as {
        status: string;
        updated_at: string;
      };
      assert.equal(row.status, "to_do");
      assert.equal(row.updated_at, task.updatedAt);
    } finally {
      db.close();
    }
  });

  it("reloads tasks and logs from a SQLite file after close", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mtm-persist-"));
    const file = path.join(dir, "app.db");
    try {
      const first = openDb(file);
      const created = new TaskService(first).create({
        title: "Survives restart",
        description: "file db",
        actor: "john.doe",
      });
      first.close();

      const second = openDb(file);
      try {
        const listed = new TaskService(second).list();
        assert.equal(listed.length, 1);
        assert.equal(listed[0].id, created.id);
        assert.equal(listed[0].title, "Survives restart");
        const logs = new TaskService(second).listAuditLogs(created.id);
        assert.equal(logs.length, 1);
        assert.equal(logs[0].toStatus, "to_do");
      } finally {
        second.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
