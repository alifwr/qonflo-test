import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import type Database from "better-sqlite3";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/connection.js";

type Json = unknown;

type HttpResult = {
  status: number;
  body: Json;
};

let db: Database.Database;
let server: Server;
let base: string;

function listen(app: ReturnType<typeof createApp>): Promise<{ server: Server; base: string }> {
  return new Promise((resolve, reject) => {
    const httpServer = createServer(app);
    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("server did not bind a TCP port"));
        return;
      }
      resolve({ server: httpServer, base: `http://127.0.0.1:${addr.port}/api` });
    });
  });
}

async function request(
  method: string,
  path: string,
  payload?: Record<string, unknown>,
): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (res.status === 204) {
    return { status: res.status, body: null };
  }
  const text = await res.text();
  if (text.length === 0) {
    return { status: res.status, body: null };
  }
  try {
    return { status: res.status, body: JSON.parse(text) as Json };
  } catch {
    return { status: res.status, body: text };
  }
}

function asRecord(value: Json): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.ok(value !== null);
  return value as Record<string, unknown>;
}

function errorOf(result: HttpResult): { code: string; message: string } {
  const body = asRecord(result.body);
  const error = asRecord(body.error);
  assert.equal(typeof error.code, "string");
  assert.equal(typeof error.message, "string");
  return { code: error.code as string, message: error.message as string };
}

before(async () => {
  db = openDb(":memory:");
  const started = await listen(createApp(db));
  server = started.server;
  base = started.base;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  db.close();
});

describe("create and list", () => {
  it("creates a task as to_do with a creation audit log", async () => {
    const created = await request("POST", "/tasks", {
      title: "  Prepare Invoice  ",
      description: "optional",
      actor: "john.doe",
    });
    assert.equal(created.status, 201);
    const task = asRecord(created.body);
    assert.equal(typeof task.id, "string");
    assert.equal(task.title, "Prepare Invoice");
    assert.equal(task.description, "optional");
    assert.equal(task.status, "to_do");
    assert.equal(typeof task.createdAt, "string");
    assert.equal(task.updatedAt, task.createdAt);

    const list = await request("GET", "/tasks");
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body));
    const found = (list.body as Record<string, unknown>[]).find((row) => row.id === task.id);
    assert.ok(found);
    assert.equal(found.status, "to_do");

    const logs = await request("GET", `/tasks/${task.id}/audit-logs`);
    assert.equal(logs.status, 200);
    assert.ok(Array.isArray(logs.body));
    assert.equal((logs.body as unknown[]).length, 1);
    const first = asRecord((logs.body as Json[])[0]);
    assert.equal(first.actor, "john.doe");
    assert.equal(first.fromStatus, null);
    assert.equal(first.toStatus, "to_do");
    assert.equal(first.taskTitle, "Prepare Invoice");
  });

  it("rejects invalid create payloads", async () => {
    const missingTitle = await request("POST", "/tasks", { actor: "john.doe" });
    assert.equal(missingTitle.status, 400);
    assert.equal(errorOf(missingTitle).code, "VALIDATION_ERROR");

    const blankTitle = await request("POST", "/tasks", { title: "   ", actor: "john.doe" });
    assert.equal(blankTitle.status, 400);
    assert.equal(errorOf(blankTitle).code, "VALIDATION_ERROR");

    const badActor = await request("POST", "/tasks", { title: "x", actor: "ghost" });
    assert.equal(badActor.status, 400);
    assert.equal(errorOf(badActor).code, "INVALID_ACTOR");
  });
});

describe("status updates", () => {
  it("moves only to_do → pending → in_progress → done", async () => {
    const created = await request("POST", "/tasks", { title: "Flow", actor: "budi.santoso" });
    const id = asRecord(created.body).id as string;

    const skip = await request("PUT", `/tasks/${id}/status`, {
      status: "in_progress",
      actor: "budi.santoso",
    });
    assert.equal(skip.status, 409);
    assert.equal(errorOf(skip).code, "INVALID_TRANSITION");

    const pending = await request("PUT", `/tasks/${id}/status`, {
      status: "pending",
      actor: "siti.rahma",
    });
    assert.equal(pending.status, 200);
    const pendingBody = asRecord(pending.body);
    assert.equal(pendingBody.changed, true);
    assert.equal(asRecord(pendingBody.task).status, "pending");

    const progress = await request("PUT", `/tasks/${id}/status`, {
      status: "in_progress",
      actor: "siti.rahma",
    });
    assert.equal(asRecord(progress.body).changed, true);

    const done = await request("PUT", `/tasks/${id}/status`, {
      status: "done",
      actor: "john.doe",
    });
    assert.equal(asRecord(done.body).changed, true);

    const afterDone = await request("PUT", `/tasks/${id}/status`, {
      status: "pending",
      actor: "john.doe",
    });
    assert.equal(afterDone.status, 409);
    assert.equal(errorOf(afterDone).code, "INVALID_TRANSITION");

    const logs = await request("GET", `/tasks/${id}/audit-logs`);
    const entries = logs.body as Record<string, unknown>[];
    assert.equal(entries.length, 4);
    assert.deepEqual(
      entries.map((row) => [row.fromStatus, row.toStatus, row.actor]),
      [
        [null, "to_do", "budi.santoso"],
        ["to_do", "pending", "siti.rahma"],
        ["pending", "in_progress", "siti.rahma"],
        ["in_progress", "done", "john.doe"],
      ],
    );
    const ids = entries.map((row) => row.id as number);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
    assert.equal(typeof entries[1].createdAt, "string");
    assert.equal(entries[1].taskTitle, "Flow");
  });

  it("keeps older audit rows when a later status change is written", async () => {
    const created = await request("POST", "/tasks", { title: "Keep old logs", actor: "john.doe" });
    const id = asRecord(created.body).id as string;
    const before = await request("GET", `/tasks/${id}/audit-logs`);
    const first = asRecord((before.body as Json[])[0]);

    await request("PUT", `/tasks/${id}/status`, { status: "pending", actor: "jane.smith" });
    const after = await request("GET", `/tasks/${id}/audit-logs`);
    const rows = after.body as Record<string, unknown>[];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, first.id);
    assert.equal(rows[0].fromStatus, first.fromStatus);
    assert.equal(rows[0].toStatus, first.toStatus);
    assert.equal(rows[0].actor, first.actor);
    assert.equal(rows[0].createdAt, first.createdAt);
  });

  it("does not write a log when the transition is rejected", async () => {
    const created = await request("POST", "/tasks", { title: "Skip no log", actor: "john.doe" });
    const id = asRecord(created.body).id as string;
    await request("PUT", `/tasks/${id}/status`, { status: "done", actor: "john.doe" });
    const logs = await request("GET", `/tasks/${id}/audit-logs`);
    assert.equal((logs.body as unknown[]).length, 1);
  });

  it("treats same-status updates as a no-op without a new log", async () => {
    const created = await request("POST", "/tasks", { title: "Noop", actor: "jane.smith" });
    const task = asRecord(created.body);
    const id = task.id as string;
    const updatedAt = task.updatedAt;

    const noop = await request("PUT", `/tasks/${id}/status`, {
      status: "to_do",
      actor: "jane.smith",
    });
    assert.equal(noop.status, 200);
    const body = asRecord(noop.body);
    assert.equal(body.changed, false);
    assert.equal(asRecord(body.task).updatedAt, updatedAt);

    const logs = await request("GET", `/tasks/${id}/audit-logs`);
    assert.equal((logs.body as unknown[]).length, 1);
  });

  it("validates actor and status on update", async () => {
    const created = await request("POST", "/tasks", { title: "Validate", actor: "john.doe" });
    const id = asRecord(created.body).id as string;

    const unknownStatus = await request("PUT", `/tasks/${id}/status`, {
      status: "nope",
      actor: "john.doe",
    });
    assert.equal(unknownStatus.status, 400);
    assert.equal(errorOf(unknownStatus).code, "VALIDATION_ERROR");

    const unknownActor = await request("PUT", `/tasks/${id}/status`, {
      status: "pending",
      actor: "nobody",
    });
    assert.equal(unknownActor.status, 400);
    assert.equal(errorOf(unknownActor).code, "INVALID_ACTOR");

    const missing = await request("PUT", "/tasks/00000000-0000-0000-0000-000000000000/status", {
      status: "pending",
      actor: "john.doe",
    });
    assert.equal(missing.status, 404);
    assert.equal(errorOf(missing).code, "NOT_FOUND");
  });
});

describe("delete and audit immutability", () => {
  it("soft-deletes a task but keeps audit logs readable", async () => {
    const created = await request("POST", "/tasks", { title: "Keep history", actor: "john.doe" });
    const id = asRecord(created.body).id as string;
    await request("PUT", `/tasks/${id}/status`, { status: "pending", actor: "jane.smith" });

    const del = await request("DELETE", `/tasks/${id}`);
    assert.equal(del.status, 204);

    const list = await request("GET", "/tasks");
    assert.ok(Array.isArray(list.body));
    assert.equal(
      (list.body as Record<string, unknown>[]).some((row) => row.id === id),
      false,
    );

    const secondDelete = await request("DELETE", `/tasks/${id}`);
    assert.equal(secondDelete.status, 404);

    const logs = await request("GET", `/tasks/${id}/audit-logs`);
    assert.equal(logs.status, 200);
    assert.equal((logs.body as unknown[]).length, 2);

    const statusAfterDelete = await request("PUT", `/tasks/${id}/status`, {
      status: "in_progress",
      actor: "john.doe",
    });
    assert.equal(statusAfterDelete.status, 404);
  });

  it("does not expose audit log mutation endpoints", async () => {
    const created = await request("POST", "/tasks", { title: "No mutate", actor: "john.doe" });
    const id = asRecord(created.body).id as string;
    const put = await request("PUT", `/tasks/${id}/audit-logs`, { actor: "john.doe" });
    const patch = await request("PATCH", `/tasks/${id}/audit-logs`, {});
    const del = await request("DELETE", `/tasks/${id}/audit-logs`);
    assert.equal(put.status, 404);
    assert.equal(patch.status, 404);
    assert.equal(del.status, 404);
  });

  it("aborts UPDATE and DELETE on audit_logs at the database", () => {
    assert.throws(() => db.exec("UPDATE audit_logs SET actor = 'x' WHERE id = 1"), /append-only/);
    assert.throws(() => db.exec("DELETE FROM audit_logs WHERE id = 1"), /append-only/);
    const count = db.prepare("SELECT COUNT(*) AS n FROM audit_logs").get() as { n: number };
    assert.ok(count.n > 0);
  });
});
