import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTORS,
  ALLOWED_TRANSITIONS,
  formatAuditEntry,
  getNextStatus,
  isActor,
  isTaskStatus,
  isValidTransition,
  TASK_STATUSES,
} from "../src/index.js";

describe("status flow", () => {
  it("allows only one forward step", () => {
    assert.equal(getNextStatus("to_do"), "pending");
    assert.equal(getNextStatus("pending"), "in_progress");
    assert.equal(getNextStatus("in_progress"), "done");
    assert.equal(getNextStatus("done"), null);

    assert.equal(isValidTransition("to_do", "pending"), true);
    assert.equal(isValidTransition("pending", "in_progress"), true);
    assert.equal(isValidTransition("in_progress", "done"), true);

    assert.equal(isValidTransition("to_do", "in_progress"), false);
    assert.equal(isValidTransition("to_do", "done"), false);
    assert.equal(isValidTransition("pending", "to_do"), false);
    assert.equal(isValidTransition("pending", "done"), false);
    assert.equal(isValidTransition("in_progress", "pending"), false);
    assert.equal(isValidTransition("done", "to_do"), false);
    assert.equal(isValidTransition("done", "pending"), false);
    assert.equal(isValidTransition("done", "in_progress"), false);
    assert.equal(isValidTransition("done", "done"), false);
    assert.equal(isValidTransition("to_do", "to_do"), false);
  });

  it("maps every status exactly once", () => {
    assert.deepEqual(Object.keys(ALLOWED_TRANSITIONS).sort(), [...TASK_STATUSES].sort());
  });
});

describe("actors and statuses", () => {
  it("accepts only the predefined actor list", () => {
    for (const actor of ACTORS) {
      assert.equal(isActor(actor), true);
    }
    assert.equal(isActor("ghost"), false);
    assert.equal(isActor(""), false);
    assert.equal(isActor(null), false);
  });

  it("accepts only known task statuses", () => {
    for (const status of TASK_STATUSES) {
      assert.equal(isTaskStatus(status), true);
    }
    assert.equal(isTaskStatus("nope"), false);
    assert.equal(isTaskStatus("TO_DO"), false);
  });
});

describe("audit log wording", () => {
  it("matches the product example sentence", () => {
    const sentence = formatAuditEntry(
      {
        id: 1,
        taskId: "t1",
        taskTitle: "Prepare Invoice",
        actor: "john.doe",
        fromStatus: "pending",
        toStatus: "in_progress",
        createdAt: "2025-01-01T10:00:00.000Z",
      },
      () => "2025-01-01 10:00",
    );
    assert.equal(
      sentence,
      'User "john.doe" changed Task "Prepare Invoice" status from "pending" to "in_progress" at 2025-01-01 10:00',
    );
  });

  it("describes the creation entry", () => {
    const sentence = formatAuditEntry(
      {
        id: 1,
        taskId: "t1",
        taskTitle: "Prepare Invoice",
        actor: "john.doe",
        fromStatus: null,
        toStatus: "to_do",
        createdAt: "2025-01-01T10:00:00.000Z",
      },
      () => "2025-01-01 10:00",
    );
    assert.equal(
      sentence,
      'User "john.doe" created Task "Prepare Invoice" with status "to_do" at 2025-01-01 10:00',
    );
  });
});
