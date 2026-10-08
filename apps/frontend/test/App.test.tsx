import type { AuditLog, Task } from "@mtm/shared";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const invoice: Task = {
  id: "task-1",
  title: "Prepare Invoice",
  status: "to_do",
  createdAt: "2025-01-01T09:00:00.000Z",
  updatedAt: "2025-01-01T09:00:00.000Z",
};

const pending: Task = { ...invoice, status: "pending", updatedAt: "2025-01-01T10:00:00.000Z" };

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
];

let tasks: Task[] = [];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  tasks = [invoice];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/tasks" && method === "GET") {
        return json(tasks);
      }
      if (url === "/api/tasks" && method === "POST") {
        const body = JSON.parse(String(init?.body)) as { title: string; actor: string };
        const created: Task = {
          id: "task-2",
          title: body.title,
          status: "to_do",
          createdAt: "2025-01-01T11:00:00.000Z",
          updatedAt: "2025-01-01T11:00:00.000Z",
        };
        tasks = [...tasks, created];
        return json(created, 201);
      }
      if (url === "/api/tasks/task-1/status" && method === "PUT") {
        tasks = tasks.map((t) => (t.id === "task-1" ? pending : t));
        return json({ task: pending, changed: true });
      }
      if (url === "/api/tasks/task-1" && method === "DELETE") {
        tasks = tasks.filter((t) => t.id !== "task-1");
        return new Response(null, { status: 204 });
      }
      if (url === "/api/tasks/task-1/audit-logs") {
        return json(logs);
      }
      return json({ error: { code: "NOT_FOUND", message: "not found" } }, 404);
    }),
  );
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("App", () => {
  it("lists tasks, creates, advances status, and opens history", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText("Prepare Invoice")).toBeTruthy();
    expect(screen.getByText("to_do")).toBeTruthy();

    await user.type(screen.getByPlaceholderText("Prepare Invoice"), "Second task");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Second task")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Move to pending" })[0]);
    expect(await screen.findByText("pending")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "History" })[0]);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/User "john.doe" created Task "Prepare Invoice"/)).toBeTruthy();
  });

  it("asks for confirmation before delete", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    render(<App />);
    expect(await screen.findByText("Prepare Invoice")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByText("Prepare Invoice")).toBeTruthy();
  });
});
