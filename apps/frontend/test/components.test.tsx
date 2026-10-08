import { ACTORS } from "@mtm/shared";
import type { AuditLog, Task } from "@mtm/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditLogView } from "../src/components/AuditLogView";
import { StatusControl } from "../src/components/StatusControl";
import { TaskForm } from "../src/components/TaskForm";
import { TaskList } from "../src/components/TaskList";

afterEach(() => {
  cleanup();
});

const sampleTask: Task = {
  id: "task-1",
  title: "Prepare Invoice",
  description: "Q4 billing",
  status: "pending",
  createdAt: "2025-01-01T09:00:00.000Z",
  updatedAt: "2025-01-01T10:00:00.000Z",
};

describe("TaskForm", () => {
  it("offers only predefined actors and submits create with the selected actor", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<TaskForm busy={false} onCreate={onCreate} />);

    const options = screen.getAllByRole("option").map((el) => el.textContent);
    expect(options).toEqual([...ACTORS]);

    await user.type(screen.getByPlaceholderText("Prepare Invoice"), "Prepare Invoice");
    await user.selectOptions(screen.getByRole("combobox"), "jane.smith");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith({
      title: "Prepare Invoice",
      description: undefined,
      actor: "jane.smith",
    });
  });

  it("shows a backend create error", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockRejectedValue(new Error("title is required"));
    render(<TaskForm busy={false} onCreate={onCreate} />);
    await user.type(screen.getByPlaceholderText("Prepare Invoice"), "x");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("title is required")).toBeTruthy();
  });
});

describe("StatusControl", () => {
  it("offers only the next valid status and an actor dropdown", async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(<StatusControl task={sampleTask} busy={false} onAdvance={onAdvance} />);

    expect(screen.getByRole("button", { name: "Move to in_progress" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Move to done/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Move to to_do/ })).toBeNull();

    const actorSelect = screen.getByLabelText("Actor for status change");
    expect([...actorSelect.querySelectorAll("option")].map((o) => o.value)).toEqual([...ACTORS]);

    await user.selectOptions(actorSelect, "budi.santoso");
    await user.click(screen.getByRole("button", { name: "Move to in_progress" }));
    expect(onAdvance).toHaveBeenCalledWith("task-1", "budi.santoso");
  });

  it("does not offer a transition from done", () => {
    render(
      <StatusControl
        task={{ ...sampleTask, status: "done" }}
        busy={false}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.getByText("Terminal status")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a backend status error", async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn().mockRejectedValue(new Error("Cannot change status from pending to done"));
    render(<StatusControl task={sampleTask} busy={false} onAdvance={onAdvance} />);
    await user.click(screen.getByRole("button", { name: "Move to in_progress" }));
    expect(await screen.findByText("Cannot change status from pending to done")).toBeTruthy();
  });
});

describe("TaskList", () => {
  it("lists title, distinguishable status, and last updated", () => {
    render(
      <TaskList
        tasks={[sampleTask]}
        busyId={null}
        onAdvance={vi.fn()}
        onDelete={vi.fn()}
        onViewAudit={vi.fn()}
      />,
    );
    expect(screen.getByText("Prepare Invoice")).toBeTruthy();
    expect(screen.getByText("Q4 billing")).toBeTruthy();
    const badge = screen.getByText("pending");
    expect(badge.className).toContain("badge-pending");
    expect(screen.getByRole("button", { name: "History" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });
});

describe("AuditLogView", () => {
  it("renders per-task history in chronological readable form", () => {
    const logs: AuditLog[] = [
      {
        id: 1,
        taskId: "task-1",
        taskTitle: "Prepare Invoice",
        actor: "john.doe",
        fromStatus: null,
        toStatus: "to_do",
        createdAt: "2025-01-01T09:00:00.000Z",
      },
      {
        id: 2,
        taskId: "task-1",
        taskTitle: "Prepare Invoice",
        actor: "john.doe",
        fromStatus: "pending",
        toStatus: "in_progress",
        createdAt: "2025-01-01T10:00:00.000Z",
      },
    ];
    render(
      <AuditLogView
        task={sampleTask}
        logs={logs}
        loading={false}
        error={null}
        onClose={() => undefined}
      />,
    );
    const items = screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
    expect(items[0]).toContain('User "john.doe" created Task "Prepare Invoice" with status "to_do"');
    expect(items[1]).toContain(
      'User "john.doe" changed Task "Prepare Invoice" status from "pending" to "in_progress"',
    );
    expect(items[1]).toMatch(/at /);
  });

  it("closes the modal", () => {
    const onClose = vi.fn();
    render(
      <AuditLogView task={sampleTask} logs={[]} loading={false} error={null} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
